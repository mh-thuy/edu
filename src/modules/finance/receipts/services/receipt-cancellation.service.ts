import {
  PaymentBatchStatus,
  Prisma,
  ReceiptStatus,
  TuitionPaymentStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { getEffectiveTuitionFeeStatus } from "@/modules/finance/tuition/utils/tuition-status";

export async function cancelTuitionReceipt(
  receiptId: string,
  actorId: string,
  reason: string,
) {
  return prisma.$transaction(async (tx) => {
    const receipt = await tx.tuitionReceipt.findUnique({
      where: { id: receiptId },
      include: { payment: { include: { paymentBatch: true, tuitionFee: true } } },
    });
    if (!receipt) throw new NotFoundError("Không tìm thấy biên lai");
    if (receipt.status === ReceiptStatus.CANCELLED)
      throw new ConflictError("Biên lai đã được hủy");
    if (receipt.payment.paymentStatus !== TuitionPaymentStatus.SUCCESS)
      throw new ConflictError("Chỉ có thể hủy biên lai của thanh toán thành công");

    const batchId = receipt.payment.paymentBatchId;
    if (batchId) {
      await tx.$executeRaw(
        Prisma.sql`SELECT id FROM payment_batches WHERE id = ${batchId}::uuid FOR UPDATE`,
      );
      const batch = await tx.paymentBatch.findUnique({ where: { id: batchId } });
      if (!batch) throw new NotFoundError("Không tìm thấy đợt thanh toán");
      if (batch.status !== PaymentBatchStatus.SUCCESS)
        throw new ConflictError("Đợt thanh toán không còn ở trạng thái thành công");

      const payments = await tx.tuitionPayment.findMany({
        where: { paymentBatchId: batch.id },
        include: { receipt: true, tuitionFee: true },
      });
      if (
        payments.length === 0 ||
        payments.some((payment) => payment.paymentStatus !== TuitionPaymentStatus.SUCCESS)
      )
        throw new ConflictError("Đợt thanh toán không còn nhất quán để hoàn tác");

      for (const payment of payments) {
        const cancelledPayment = await tx.tuitionPayment.update({
          where: { id: payment.id },
          data: {
            paymentStatus: TuitionPaymentStatus.CANCELLED,
            cancellationReason: reason,
            updatedBy: actorId,
            version: { increment: 1 },
          },
        });
        const reopenedFee = await tx.tuitionFee.update({
          where: { id: payment.tuitionFeeId },
          data: {
            status: getEffectiveTuitionFeeStatus(
              "UNPAID",
              payment.tuitionFee.dueDate,
            ),
            version: { increment: 1 },
            updatedBy: actorId,
          },
        });
        const auditRows: Prisma.TuitionAuditLogCreateManyInput[] = [
          {
            entityType: "TUITION_PAYMENT",
            entityId: payment.id,
            action: "CANCEL",
            reason,
            dataBefore: payment as unknown as Prisma.InputJsonValue,
            dataAfter: cancelledPayment as unknown as Prisma.InputJsonValue,
            performedBy: actorId,
          },
          {
            entityType: "TUITION_FEE",
            entityId: payment.tuitionFeeId,
            action: "PAYMENT_REVERSED",
            reason,
            dataBefore: payment.tuitionFee as unknown as Prisma.InputJsonValue,
            dataAfter: reopenedFee as unknown as Prisma.InputJsonValue,
            performedBy: actorId,
          },
        ];
        if (payment.receipt) {
          const cancelledReceipt = await tx.tuitionReceipt.update({
            where: { id: payment.receipt.id },
            data: {
              status: ReceiptStatus.CANCELLED,
              cancellationReason: reason,
              cancelledBy: actorId,
              cancelledAt: new Date(),
            },
          });
          auditRows.push({
            entityType: "TUITION_RECEIPT",
            entityId: payment.receipt.id,
            action: "CANCEL",
            reason,
            dataBefore: payment.receipt as unknown as Prisma.InputJsonValue,
            dataAfter: cancelledReceipt as unknown as Prisma.InputJsonValue,
            performedBy: actorId,
          });
        }
        await tx.tuitionAuditLog.createMany({ data: auditRows });
      }

      const cancelledBatch = await tx.paymentBatch.update({
        where: { id: batch.id },
        data: { status: PaymentBatchStatus.CANCELLED, updatedBy: actorId },
      });
      await tx.tuitionAuditLog.create({
        data: {
          entityType: "PAYMENT_BATCH",
          entityId: batch.id,
          action: "CANCEL",
          reason,
          dataBefore: batch as unknown as Prisma.InputJsonValue,
          dataAfter: cancelledBatch as unknown as Prisma.InputJsonValue,
          performedBy: actorId,
        },
      });
      return tx.tuitionReceipt.findUnique({ where: { id: receiptId } });
    }

    const cancelledPayment = await tx.tuitionPayment.update({
      where: { id: receipt.payment.id },
      data: {
        paymentStatus: TuitionPaymentStatus.CANCELLED,
        cancellationReason: reason,
        updatedBy: actorId,
        version: { increment: 1 },
      },
    });
    const reopenedFee = await tx.tuitionFee.update({
      where: { id: receipt.payment.tuitionFeeId },
      data: {
        status: getEffectiveTuitionFeeStatus(
          "UNPAID",
          receipt.payment.tuitionFee.dueDate,
        ),
        version: { increment: 1 },
        updatedBy: actorId,
      },
    });
    const cancelledReceipt = await tx.tuitionReceipt.update({
      where: { id: receiptId },
      data: {
        status: ReceiptStatus.CANCELLED,
        cancellationReason: reason,
        cancelledBy: actorId,
        cancelledAt: new Date(),
      },
    });
    await tx.tuitionAuditLog.createMany({
      data: [
        {
          entityType: "TUITION_PAYMENT",
          entityId: receipt.payment.id,
          action: "CANCEL",
          reason,
          dataBefore: receipt.payment as unknown as Prisma.InputJsonValue,
          dataAfter: cancelledPayment as unknown as Prisma.InputJsonValue,
          performedBy: actorId,
        },
        {
          entityType: "TUITION_FEE",
          entityId: receipt.payment.tuitionFeeId,
          action: "PAYMENT_REVERSED",
          reason,
          dataBefore: receipt.payment.tuitionFee as unknown as Prisma.InputJsonValue,
          dataAfter: reopenedFee as unknown as Prisma.InputJsonValue,
          performedBy: actorId,
        },
        {
          entityType: "TUITION_RECEIPT",
          entityId: receiptId,
          action: "CANCEL",
          reason,
          dataBefore: receipt as unknown as Prisma.InputJsonValue,
          dataAfter: cancelledReceipt as unknown as Prisma.InputJsonValue,
          performedBy: actorId,
        },
      ],
    });
    return cancelledReceipt;
  });
}
