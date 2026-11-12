import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { auditFields, type AuditContext } from "@/lib/audit";
import {
  getTuitionReceiptSnapshot,
  parseReceiptSnapshot,
  saveTuitionReceiptSnapshot,
  toFeeSnapshot,
} from "@/modules/finance/payments/services/payment-document-snapshot";
import { renderReceiptPdf } from "@/modules/finance/payments/services/receipt-pdf-layout";

const displayReceiverName = (receiverName: string | null | undefined, student: { fullName: string }) => {
  const name = receiverName?.trim();
  return name && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(name)
    ? name
    : student.fullName;
};

export async function generateTuitionReceiptPdf(
  receiptId: string,
  actorId: string,
  auditContext?: AuditContext,
  markPrinted = false,
) {
  const receiptRef = await prisma.tuitionReceipt.findUnique({
    where: { id: receiptId },
    select: { paymentId: true },
  });
  if (!receiptRef) throw new NotFoundError("Không tìm thấy biên lai");

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw(
      Prisma.sql`SELECT id FROM tuition_payments WHERE id = ${receiptRef.paymentId}::uuid FOR UPDATE`,
    );
    return generateTuitionReceiptPdfWithClient(tx, receiptId, actorId, auditContext, markPrinted);
  });
}

async function generateTuitionReceiptPdfWithClient(
  client: Prisma.TransactionClient,
  receiptId: string,
  actorId: string,
  auditContext?: AuditContext,
  markPrinted = false,
) {
  const receipt = await client.tuitionReceipt.findUnique({
    where: { id: receiptId },
    include: {
      payment: {
        include: {
          tuitionFee: {
            include: {
              student: true,
              class: true,
              items: {
                orderBy: { displayOrder: "asc" },
                include: { classSubject: { include: { subject: true } } },
              },
            },
          },
        },
      },
    },
  });
  if (!receipt) throw new NotFoundError("Không tìm thấy biên lai");
  if (receipt.status === "CANCELLED")
    throw new ConflictError("Biên lai đã được hủy và không thể xuất PDF");
  const parsedSnapshot = parseReceiptSnapshot(
    await getTuitionReceiptSnapshot(receipt.id, client),
  );
  const student = parsedSnapshot?.student ?? receipt.payment.tuitionFee.student;
  const receiverName = displayReceiverName(parsedSnapshot?.receiverName ?? receipt.receiverName, student);
  const snapshot = parsedSnapshot ?? {
    version: 1 as const,
    receiptNo: receipt.receiptNo,
    issuedAt: receipt.issuedAt.toISOString(),
    student: { code: student.code, fullName: student.fullName },
    receiverName,
    tuitionFee: toFeeSnapshot(receipt.payment.tuitionFee, receipt.amount),
    amount: receipt.amount.toString(),
    paymentMethod: receipt.payment.paymentMethod,
  };
  if (!parsedSnapshot) {
    await saveTuitionReceiptSnapshot(client, receipt.id, snapshot);
  }
  const fee = snapshot.tuitionFee;
  const receiptFinalAmount = "finalAmount" in fee
    ? Number(fee.finalAmount)
    : Number(receipt.amount);
  const receiptPayableAmount = "payableAmount" in fee
    ? Number(fee.payableAmount)
    : Number(receipt.amount);
  const isPartialReceipt = receiptPayableAmount < receiptFinalAmount;
  const adjustments = isPartialReceipt
    ? []
    : [
        ...(Number(fee.discountAmount) > 0
          ? [{ label: "Giảm giá", amount: Number(fee.discountAmount), negative: true }]
          : []),
        ...(Number(fee.additionalAmount) > 0
          ? [{ label: "Phụ thu", amount: Number(fee.additionalAmount) }]
          : []),
      ];
  const pdfBuffer = await renderReceiptPdf({
    receiptNo: receipt.receiptNo,
    collectedAt: receipt.payment.paymentDate,
    student,
    fees: [{ label: `${fee.feeNo} — ${fee.className || "Chưa có lớp"}`, adjustments }],
    amount: receipt.amount.toString(),
    amountLabel: isPartialReceipt ? "SỐ TIỀN THU LẦN NÀY" : "TỔNG CỘNG",
    paymentMethod: receipt.payment.paymentMethod,
  });
  const printedAt = markPrinted ? new Date() : null;
  if (printedAt) {
    await client.$executeRaw(
      Prisma.sql`UPDATE tuition_receipts SET printed_at = ${printedAt} WHERE id = ${receipt.id}::uuid`,
    );
  }
  await client.tuitionAuditLog.create({
    data: {
      entityType: "TUITION_RECEIPT",
      entityId: receipt.id,
      action: markPrinted ? "PDF_PRINTED" : "PDF_EXPORTED",
      dataAfter: {
        receiptNo: receipt.receiptNo,
        ...(printedAt ? { printedAt: printedAt.toISOString() } : {}),
        snapshotUsed: Boolean(snapshot),
      },
      performedBy: actorId,
      ...auditFields(auditContext),
    },
  });
  return pdfBuffer;
}
