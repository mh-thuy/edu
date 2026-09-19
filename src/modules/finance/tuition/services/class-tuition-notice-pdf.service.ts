import { PDFDocument } from "pdf-lib";
import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { PaymentBatchStatus } from "@prisma/client";
import { TuitionFeeStatus } from "@prisma/client";
import { TuitionFeeBillingType } from "@prisma/client";
import { generatePaymentBatchNoticePdf } from "@/modules/finance/payments/services/payment-batch-notice-pdf.service";
import { createPaymentBatch } from "@/modules/finance/payments/services/payment-batch.service";
import {
  TuitionService,
  type TuitionBillingPeriod,
} from "@/modules/finance/tuition/services/tuition.service";

export async function createClassPaymentBatches(
  classId: string,
  actorId: string,
  period: TuitionBillingPeriod,
  bankAccountId: string,
) {
  return prisma.$transaction(async (tx) => {
    await TuitionService.createClassTuitionFees(classId, period, actorId, tx);

    const bankAccount = await tx.bankAccount.findUnique({
      where: { id: bankAccountId },
      select: { id: true, isActive: true },
    });
    if (!bankAccount || !bankAccount.isActive) {
      throw new ConflictError("Tài khoản nhận tiền không hoạt động hoặc không tồn tại");
    }

    const existingPendingBatches = await tx.paymentBatch.findMany({
      where: {
        status: PaymentBatchStatus.PENDING,
        allocations: {
          some: {
            tuitionFee: {
              classId,
              billingYear: period.billingYear,
              billingMonth: period.billingMonth,
              billingType: TuitionFeeBillingType.MONTHLY,
            },
          },
        },
      },
      select: {
        batchNo: true,
        paymentMethod: true,
        bankAccountId: true,
        allocations: {
          select: {
            tuitionFee: {
              select: {
                classId: true,
                billingYear: true,
                billingMonth: true,
                billingType: true,
              },
            },
          },
        },
      },
    });
    const incompatibleBatch = existingPendingBatches.find(
      (batch) =>
        batch.paymentMethod !== "BANK_TRANSFER" ||
        batch.bankAccountId !== bankAccount.id ||
        batch.allocations.some(
          ({ tuitionFee }) =>
            tuitionFee.classId !== classId ||
            tuitionFee.billingYear !== period.billingYear ||
            tuitionFee.billingMonth !== period.billingMonth ||
            tuitionFee.billingType !== TuitionFeeBillingType.MONTHLY,
        ),
    );
    if (incompatibleBatch) {
      throw new ConflictError(
        `Đợt ${incompatibleBatch.batchNo} đã chờ xử lý nhưng không phù hợp với tài khoản, phương thức hoặc phạm vi lớp/kỳ đang chọn`,
      );
    }

    const fees = await tx.tuitionFee.findMany({
    where: {
      classId,
      billingYear: period.billingYear,
      billingMonth: period.billingMonth,
      billingType: TuitionFeeBillingType.MONTHLY,
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
        {
          tuitionFeeIds: feeIds,
          paymentMethod: "BANK_TRANSFER",
          bankAccountId: bankAccount.id,
        },
        actorId,
        tx,
      );
    }
  }
  });
}

export async function generateClassTuitionNoticePdf(
  classId: string,
  exportedByName: string,
  exportedById: string,
  period: TuitionBillingPeriod,
) {
  const classData = await prisma.class.findUnique({
    where: { id: classId },
    select: { code: true },
  });
  if (!classData) throw new NotFoundError("Không tìm thấy lớp học");

  const batches = await prisma.paymentBatch.findMany({
    where: {
      status: PaymentBatchStatus.PENDING,
      paymentMethod: "BANK_TRANSFER",
      allocations: {
        every: {
          tuitionFee: {
            classId,
            billingYear: period.billingYear,
            billingMonth: period.billingMonth,
            billingType: TuitionFeeBillingType.MONTHLY,
          },
        },
        some: {
          tuitionFee: {
            classId,
            billingYear: period.billingYear,
            billingMonth: period.billingMonth,
            billingType: TuitionFeeBillingType.MONTHLY,
          },
        },
      },
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
      exportedById,
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
