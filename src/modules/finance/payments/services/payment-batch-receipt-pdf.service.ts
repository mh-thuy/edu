import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { auditFields, type AuditContext } from "@/lib/audit";
import { renderReceiptPdf } from "./receipt-pdf-layout";
import {
  getPaymentBatchReceiptSnapshot,
  parseBatchReceiptSnapshot,
  savePaymentBatchReceiptSnapshot,
  toFeeSnapshot,
} from "./payment-document-snapshot";

const displayReceiverName = (receiverName: string | null | undefined, student: { fullName: string }) => {
  const name = receiverName?.trim();
  return name && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(name)
    ? name
    : student.fullName;
};

export async function generatePaymentBatchReceiptPdf(
  receiptId: string,
  actorId: string,
  auditContext?: AuditContext,
  markPrinted = false,
) {
  const receiptRef = await prisma.paymentBatchReceipt.findUnique({
    where: { id: receiptId },
    select: { paymentBatchId: true },
  });
  if (!receiptRef) throw new NotFoundError("Không tìm thấy biên lai tổng");

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw(
      Prisma.sql`SELECT id FROM tuition_payments WHERE payment_batch_id = ${receiptRef.paymentBatchId}::uuid ORDER BY id FOR UPDATE`,
    );
    await tx.$executeRaw(
      Prisma.sql`SELECT id FROM payment_batches WHERE id = ${receiptRef.paymentBatchId}::uuid FOR UPDATE`,
    );
    return generatePaymentBatchReceiptPdfWithClient(tx, receiptId, actorId, auditContext, markPrinted);
  });
}

async function generatePaymentBatchReceiptPdfWithClient(
  client: Prisma.TransactionClient,
  receiptId: string,
  actorId: string,
  auditContext?: AuditContext,
  markPrinted = false,
) {
  const receipt = await client.paymentBatchReceipt.findUnique({
    where: { id: receiptId },
    include: {
      paymentBatch: {
        include: {
          student: true,
          allocations: {
            include: {
              tuitionFee: {
                include: {
                  class: true,
                  items: {
                    include: { classSubject: { include: { subject: true } } },
                    orderBy: { displayOrder: "asc" },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!receipt) throw new NotFoundError("Không tìm thấy biên lai tổng");
  if (receipt.paymentBatch.status !== "SUCCESS") {
    throw new ConflictError("Biên lai tổng đã bị hủy và không thể xuất PDF");
  }
  const parsedSnapshot = parseBatchReceiptSnapshot(
    await getPaymentBatchReceiptSnapshot(receipt.id, client),
  );
  if (parsedSnapshot?.status === "CANCELLED") {
    throw new ConflictError("Biên lai tổng đã được hủy và không thể xuất PDF");
  }
  const student = parsedSnapshot?.student ?? receipt.paymentBatch.student;
  const receiverName = displayReceiverName(parsedSnapshot?.receiverName ?? receipt.receiverName, student);
  const snapshot = parsedSnapshot ?? {
    version: 1 as const,
    receiptNo: receipt.receiptNo,
    issuedAt: receipt.issuedAt.toISOString(),
    student: { code: student.code, fullName: student.fullName },
    receiverName,
    fees: receipt.paymentBatch.allocations.map((allocation) =>
      toFeeSnapshot(allocation.tuitionFee, allocation.amount),
    ),
    amount: receipt.paymentBatch.totalAmount.toString(),
    paymentMethod: receipt.paymentBatch.paymentMethod,
  };
  if (!parsedSnapshot) {
    await savePaymentBatchReceiptSnapshot(client, receipt.id, snapshot);
  }
  const fees = snapshot.fees;

  const pdfBuffer = await renderReceiptPdf({
    receiptNo: receipt.receiptNo,
    collectedAt: receipt.paymentBatch.paymentDate,
    student,
    fees: fees.map((allocation) => {
      const payableAmount = Number(allocation.payableAmount ?? allocation.finalAmount);
      const isPartialReceipt = payableAmount < Number(allocation.finalAmount);
      return {
        label: `${allocation.feeNo} — ${allocation.className || "Chưa có lớp"}`,
        amount: payableAmount,
        adjustments: isPartialReceipt
          ? []
          : [
              ...(Number(allocation.discountAmount) > 0
                ? [{ label: "Giảm giá", amount: Number(allocation.discountAmount), negative: true }]
                : []),
              ...(Number(allocation.additionalAmount) > 0
                ? [{ label: "Phụ thu", amount: Number(allocation.additionalAmount) }]
                : []),
            ],
      };
    }),
    amount: receipt.amount.toString(),
    paymentMethod: receipt.paymentBatch.paymentMethod,
    paymentReference: receipt.paymentBatch.bankTransactionNo ?? receipt.paymentBatch.transactionReference,
  });
  const printedAt = markPrinted ? new Date() : null;
  if (printedAt) {
    await client.$executeRaw(
      Prisma.sql`UPDATE payment_batch_receipts SET printed_at = ${printedAt} WHERE id = ${receipt.id}::uuid`,
    );
  }
  await client.tuitionAuditLog.create({
    data: {
      entityType: "PAYMENT_BATCH",
      entityId: receipt.paymentBatchId,
      action: markPrinted ? "RECEIPT_PDF_PRINTED" : "RECEIPT_PDF_EXPORTED",
      dataAfter: {
        receiptNo: receipt.receiptNo,
        ...(printedAt ? { printedAt: printedAt.toISOString() } : {}),
        snapshotUsed: Boolean(snapshot),
      },
      performedBy: actorId,
      ...auditFields(auditContext),
    },
  });
  return {
    pdf: pdfBuffer,
    batchNo: receipt.paymentBatch.batchNo,
  };
}
