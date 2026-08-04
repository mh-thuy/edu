import { PDFDocument } from "pdf-lib";
import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { PaymentBatchStatus } from "@prisma/client";
import { TuitionFeeStatus } from "@prisma/client";
import { generatePaymentBatchNoticePdf } from "@/modules/finance/payments/services/payment-batch-notice-pdf.service";
import { createPaymentBatch } from "@/modules/finance/payments/services/payment-batch.service";

export async function createClassPaymentBatches(
  classId: string,
  actorId: string,
) {
  const fees = await prisma.tuitionFee.findMany({
    where: {
      classId,
      status: { in: [TuitionFeeStatus.UNPAID, TuitionFeeStatus.OVERDUE] },
    },
    select: {
      id: true,
      studentId: true,
      paymentAllocations: {
        where: { paymentBatch: { status: PaymentBatchStatus.PENDING } },
        select: { paymentBatchId: true },
      },
    },
  });
  const feeGroups = new Map<string, typeof fees>();
  for (const fee of fees) {
    const group = feeGroups.get(fee.studentId) || [];
    group.push(fee);
    feeGroups.set(fee.studentId, group);
  }

  for (const group of feeGroups.values()) {
    const pendingFeeIds = new Set(
      group.flatMap((fee) => (fee.paymentAllocations.length ? [fee.id] : [])),
    );
    const feeIds = group
      .filter((fee) => !pendingFeeIds.has(fee.id))
      .map((fee) => fee.id);
    if (feeIds.length) {
      await createPaymentBatch(
        { tuitionFeeIds: feeIds, paymentMethod: "BANK_TRANSFER" },
        actorId,
      );
    }
  }
}

export async function generateClassTuitionNoticePdf(
  classId: string,
  exportedByName: string,
) {
  const classData = await prisma.class.findUnique({
    where: { id: classId },
    select: { code: true },
  });
  if (!classData) throw new NotFoundError("Không tìm thấy lớp học");

  const batches = await prisma.paymentBatch.findMany({
    where: {
      status: PaymentBatchStatus.PENDING,
      allocations: { some: { tuitionFee: { classId } } },
    },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!batches.length)
    throw new ConflictError("Lớp chưa có thông báo thanh toán đang chờ");

  const combinedPdf = await PDFDocument.create();
  for (const batch of batches) {
    const notice = await generatePaymentBatchNoticePdf(
      batch.id,
      exportedByName,
    );
    const sourcePdf = await PDFDocument.load(notice.pdf);
    const pages = await combinedPdf.copyPages(
      sourcePdf,
      sourcePdf.getPageIndices(),
    );
    for (const page of pages) combinedPdf.addPage(page);
  }

  return {
    pdf: Buffer.from(await combinedPdf.save()),
    classCode: classData.code,
  };
}
