import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { TuitionFeeStatus, TuitionPaymentStatus, TuitionRefundStatus, TuitionPaymentMethod } from "@prisma/client";

export async function completeFullRefund(paymentId: string, data: { refundMethod: TuitionPaymentMethod; reason: string; bankTransactionNo?: string }, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.tuitionPayment.findUnique({ where: { id: paymentId }, include: { tuitionFee: true, refunds: true } });
    if (!payment) throw new NotFoundError("Không tìm thấy payment");
    if (payment.paymentStatus !== TuitionPaymentStatus.SUCCESS) throw new ConflictError("Chỉ có thể hoàn tiền payment thành công");
    if (payment.refunds.some((refund) => refund.status === TuitionRefundStatus.COMPLETED)) throw new ConflictError("Payment đã được hoàn tiền");
    const refund = await tx.paymentRefund.create({ data: { refundNo: `REF-${Date.now()}-${Math.floor(Math.random() * 10000)}`, paymentId, amount: payment.amount, refundMethod: data.refundMethod, refundDate: new Date(), bankTransactionNo: data.bankTransactionNo, reason: data.reason, status: TuitionRefundStatus.COMPLETED, createdBy: actorId, approvedBy: actorId, completedAt: new Date() } });
    await tx.tuitionPayment.update({ where: { id: paymentId }, data: { paymentStatus: TuitionPaymentStatus.REFUNDED, version: { increment: 1 }, updatedBy: actorId } });
    await tx.tuitionFee.update({ where: { id: payment.tuitionFeeId }, data: { status: payment.tuitionFee.dueDate && payment.tuitionFee.dueDate < new Date() ? TuitionFeeStatus.OVERDUE : TuitionFeeStatus.UNPAID, version: { increment: 1 }, updatedBy: actorId } });
    await tx.tuitionReceipt.updateMany({ where: { paymentId }, data: { status: "CANCELLED", cancellationReason: data.reason, cancelledBy: actorId, cancelledAt: new Date() } });
    return refund;
  });
}
