import { Prisma, TuitionFeeStatus, TuitionPaymentStatus, PaymentBatchStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError } from "@/lib/errors";
import type { PaymentBatchCreate } from "../schemas/payment-batch.schema";
import { buildVietQrUrl } from "@/modules/finance/tuition/services/vietqr.service";

async function generateBatchNo(tx: Prisma.TransactionClient) {
  const prefix = `PB-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;
  for (let index = 0; index < 5; index += 1) {
    const candidate = `${prefix}-${Math.floor(100000 + Math.random() * 900000)}`;
    if (!(await tx.paymentBatch.findUnique({ where: { batchNo: candidate }, select: { id: true } }))) return candidate;
  }
  throw new ConflictError("Không thể tạo mã thanh toán tổng, vui lòng thử lại");
}

export async function completePaymentBatch(tx: Prisma.TransactionClient, batchId: string, actorId: string, data?: { paymentDate?: Date; bankAccountId?: string; bankTransactionNo?: string; transactionReference?: string; paymentContent?: string }) {
  const batch = await tx.paymentBatch.findUnique({ where: { id: batchId }, include: { allocations: { include: { tuitionFee: true } } } });
  if (!batch) throw new NotFoundError("Không tìm thấy batch thanh toán");
  if (batch.status === PaymentBatchStatus.SUCCESS) return batch;
  if (batch.status !== PaymentBatchStatus.PENDING) throw new ConflictError("Batch thanh toán không còn chờ xử lý");
  for (const allocation of batch.allocations) {
    if (allocation.tuitionFee.status === TuitionFeeStatus.PAID || allocation.tuitionFee.status === TuitionFeeStatus.CANCELLED || allocation.tuitionFee.status === TuitionFeeStatus.EXEMPTED) throw new ConflictError(`Học phí ${allocation.tuitionFee.feeNo} không còn đủ điều kiện thanh toán`);
    if (!allocation.amount.equals(allocation.tuitionFee.finalAmount)) throw new ConflictError(`Số tiền phân bổ của ${allocation.tuitionFee.feeNo} không khớp`);
  }
  const paymentDate = data?.paymentDate || batch.paymentDate;
  for (const [index, allocation] of batch.allocations.entries()) {
    const sequence = String(index + 1).padStart(3, "0");
    const batchToken = batch.batchNo.slice(-20);
    const payment = await tx.tuitionPayment.create({ data: { paymentNo: `PAY-${batchToken}-${sequence}`, tuitionFeeId: allocation.tuitionFeeId, studentId: batch.studentId, paymentBatchId: batch.id, paymentDate, amount: allocation.amount, paymentMethod: batch.paymentMethod, paymentStatus: TuitionPaymentStatus.SUCCESS, bankAccountId: data?.bankAccountId || batch.bankAccountId, bankTransactionNo: data?.bankTransactionNo, transactionReference: data?.transactionReference || batch.transactionReference, payerName: batch.payerName, paymentContent: data?.paymentContent || batch.paymentContent, receivedBy: actorId, confirmedBy: actorId, confirmedAt: new Date(), createdBy: actorId, updatedBy: actorId } });
    await tx.tuitionReceipt.create({ data: { receiptNo: `REC-${batchToken}-${sequence}`, paymentId: payment.id, issuedBy: actorId, receiverName: batch.payerName || batch.studentId, amount: allocation.amount } });
    await tx.tuitionFee.update({ where: { id: allocation.tuitionFeeId }, data: { status: TuitionFeeStatus.PAID, version: { increment: 1 }, updatedBy: actorId } });
  }
  await tx.paymentBatchReceipt.create({ data: { receiptNo: `BRC-${batch.batchNo}`.slice(0, 40), paymentBatchId: batch.id, issuedBy: actorId, receiverName: batch.payerName || batch.studentId, amount: batch.totalAmount } });
  return tx.paymentBatch.update({ where: { id: batch.id }, data: { status: PaymentBatchStatus.SUCCESS, paymentDate, bankAccountId: data?.bankAccountId || batch.bankAccountId, bankTransactionNo: data?.bankTransactionNo, transactionReference: data?.transactionReference || batch.transactionReference, paymentContent: data?.paymentContent || batch.paymentContent, confirmedBy: actorId, confirmedAt: new Date(), updatedBy: actorId }, include: { allocations: true, receipt: true } });
}

export async function createPaymentBatch(data: PaymentBatchCreate, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const fees = await tx.tuitionFee.findMany({ where: { id: { in: data.tuitionFeeIds } }, include: { student: true } });
    if (fees.length !== data.tuitionFeeIds.length) throw new NotFoundError("Không tìm thấy đầy đủ các khoản học phí");
    const studentId = fees[0]?.studentId;
    if (!studentId || fees.some((fee) => fee.studentId !== studentId)) throw new ConflictError("Chỉ được gom học phí của cùng một học viên");
    if (fees.some((fee) => fee.status !== TuitionFeeStatus.UNPAID && fee.status !== TuitionFeeStatus.OVERDUE)) throw new ConflictError("Danh sách có học phí không còn đủ điều kiện thanh toán");
    await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${studentId}))`);
    const paid = await tx.tuitionPayment.findMany({ where: { tuitionFeeId: { in: data.tuitionFeeIds }, paymentStatus: TuitionPaymentStatus.SUCCESS }, select: { tuitionFeeId: true } });
    if (paid.length) throw new ConflictError("Một hoặc nhiều học phí đã được thanh toán");
    const totalAmount = fees.reduce((sum, fee) => sum.add(fee.finalAmount), new Prisma.Decimal(0));
    const selectedFeeIds = new Set(data.tuitionFeeIds);
    const pendingBatches = await tx.paymentBatch.findMany({ where: { studentId, status: PaymentBatchStatus.PENDING }, include: { allocations: true, receipt: true } });
    const duplicate = pendingBatches.find((candidate) => candidate.allocations.length === selectedFeeIds.size && candidate.allocations.every((allocation) => selectedFeeIds.has(allocation.tuitionFeeId)));
    if (duplicate) return duplicate;
    if (pendingBatches.some((candidate) => candidate.allocations.some((allocation) => selectedFeeIds.has(allocation.tuitionFeeId)))) throw new ConflictError("Một hoặc nhiều học phí đang thuộc batch chờ đối soát");
    const batch = await tx.paymentBatch.create({ data: { batchNo: await generateBatchNo(tx), studentId, totalAmount, paymentMethod: data.paymentMethod, status: PaymentBatchStatus.PENDING, bankAccountId: data.bankAccountId, transactionReference: data.transactionReference, payerName: data.payerName, paymentContent: data.note, createdBy: actorId, updatedBy: actorId, allocations: { create: fees.map((fee) => ({ tuitionFeeId: fee.id, amount: fee.finalAmount })) } }, include: { allocations: { include: { tuitionFee: true } }, student: true } });
    if (data.paymentMethod === "CASH" || data.paymentMethod === "OTHER") return completePaymentBatch(tx, batch.id, actorId);
    return batch;
  });
}

export async function listPaymentBatches(params: { studentCode?: string; status?: PaymentBatchStatus; page: number; pageSize: number }) {
  const page = Number.isFinite(params.page) ? Math.max(Math.floor(params.page), 1) : 1;
  const pageSize = Number.isFinite(params.pageSize) ? Math.min(Math.max(Math.floor(params.pageSize), 1), 100) : 20;
  const where: Prisma.PaymentBatchWhereInput = {
    ...(params.status ? { status: params.status } : {}),
    ...(params.studentCode ? { student: { code: { contains: params.studentCode, mode: "insensitive" } } } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.paymentBatch.findMany({ where, include: { student: true, receipt: true, allocations: { include: { tuitionFee: { include: { class: true } } } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.paymentBatch.count({ where }),
  ]);
  return { items, total, page, pageSize, pages: Math.ceil(total / pageSize) };
}

export async function cancelPaymentBatch(batchId: string, actorId: string, reason: string) {
  return prisma.$transaction(async (tx) => {
    const batch = await tx.paymentBatch.findUnique({ where: { id: batchId }, include: { allocations: true } });
    if (!batch) throw new NotFoundError("Không tìm thấy batch thanh toán");
    if (batch.status !== PaymentBatchStatus.PENDING) throw new ConflictError("Chỉ có thể hủy batch đang chờ đối soát");

    const cancelled = await tx.paymentBatch.update({
      where: { id: batchId },
      data: { status: PaymentBatchStatus.CANCELLED, updatedBy: actorId },
      include: { allocations: true, student: true },
    });
    await tx.bankStatementTransaction.updateMany({
      where: { paymentBatchId: batchId, paymentId: null },
      data: { paymentBatchId: null, matchedStudentId: null, matchedTuitionFeeId: null, matchScore: null, matchMethod: null, reconciliationStatus: "UNMATCHED" },
    });
    await tx.tuitionAuditLog.create({
      data: { entityType: "PAYMENT_BATCH", entityId: batchId, action: "CANCEL", reason, dataBefore: batch as unknown as Prisma.InputJsonValue, dataAfter: cancelled as unknown as Prisma.InputJsonValue, performedBy: actorId },
    });
    return cancelled;
  });
}

export async function getPaymentBatchQr(batchId: string) {
  const batch = await prisma.paymentBatch.findUnique({ where: { id: batchId }, include: { student: true } });
  if (!batch) throw new NotFoundError("Không tìm thấy batch thanh toán");
  if (batch.status !== PaymentBatchStatus.PENDING) throw new ConflictError("Batch thanh toán không còn hiệu lực");
  const account = await prisma.bankAccount.findFirst({ where: { id: batch.bankAccountId || undefined, isActive: true }, orderBy: { createdAt: "asc" } });
  if (!account) throw new ConflictError("Chưa cấu hình tài khoản ngân hàng nhận học phí");
  return { batchNo: batch.batchNo, amount: batch.totalAmount, account, qrUrl: buildVietQrUrl({ bankCode: account.bankCode, accountNo: account.accountNo, accountName: account.accountName, amount: Number(batch.totalAmount), addInfo: `PB ${batch.batchNo}` }) };
}
