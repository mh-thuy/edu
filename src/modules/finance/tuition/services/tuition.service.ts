import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { PaymentBatchStatus, Prisma, TuitionFeeStatus, TuitionPaymentStatus } from "@prisma/client";
import type { TuitionFeeCreate, TuitionFeeUpdate, TuitionPaymentCreate } from "@/modules/finance/tuition/schemas/tuition.schema";

const feeInclude = {
  student: true,
  class: true,
  enrollment: true,
  items: { orderBy: { displayOrder: "asc" as const } },
  adjustments: true,
  payments: { where: { paymentStatus: TuitionPaymentStatus.SUCCESS }, include: { receipt: true } },
};

function amount(data: Pick<TuitionFeeCreate, "originalAmount" | "discountAmount" | "additionalAmount">) {
  return new Prisma.Decimal(data.originalAmount).sub(data.discountAmount).add(data.additionalAmount);
}

async function generateFeeNo(tx: Prisma.TransactionClient) {
  const prefix = `HP-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = `${prefix}-${Math.floor(100000 + Math.random() * 900000)}`;
    if (!(await tx.tuitionFee.findUnique({ where: { feeNo: candidate }, select: { id: true } }))) return candidate;
  }
  throw new ConflictError("Không thể tạo mã học phí tự động, vui lòng thử lại");
}

export class TuitionService {
  static async listFees(params: { studentCode?: string; classId?: string; status?: TuitionFeeStatus; page: number; pageSize: number }) {
    const page = Number.isFinite(params.page) ? Math.max(Math.floor(params.page), 1) : 1;
    const pageSize = Number.isFinite(params.pageSize) ? Math.min(Math.max(Math.floor(params.pageSize), 1), 10000) : 50;
    const where: Prisma.TuitionFeeWhereInput = {
      ...(params.status ? { status: params.status } : {}),
      ...(params.studentCode ? { student: { code: { equals: params.studentCode, mode: "insensitive" } } } : {}),
      ...(params.classId ? { classId: params.classId } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.tuitionFee.findMany({ where, include: feeInclude, orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }], skip: (page - 1) * pageSize, take: pageSize }),
      prisma.tuitionFee.count({ where }),
    ]);
    return { items, total, page, pageSize, pages: Math.ceil(total / pageSize) };
  }

  static async getFee(id: string) {
    const fee = await prisma.tuitionFee.findUnique({ where: { id }, include: feeInclude });
    if (!fee) throw new NotFoundError("Không tìm thấy khoản học phí");
    return fee;
  }

  static async createFee(data: TuitionFeeCreate, actorId: string) {
    const finalAmount = amount(data);
    if (finalAmount.isNegative()) throw new ConflictError("Số tiền cuối phải lớn hơn hoặc bằng 0");
    return prisma.$transaction(async (tx) => {
      const enrollment = await tx.classStudent.findUnique({
        where: { id: data.enrollmentId },
        select: { studentId: true, classId: true },
      });
      if (!enrollment) throw new NotFoundError("Không tìm thấy đăng ký lớp học");
      if (enrollment.studentId !== data.studentId || enrollment.classId !== data.classId) {
        throw new ConflictError("Đăng ký lớp học không thuộc đúng học viên và lớp học");
      }

      const feeNo = await generateFeeNo(tx);
      const fee = await tx.tuitionFee.create({ data: { ...data, feeNo, dueDate: data.dueDate ? new Date(`${data.dueDate}T00:00:00.000Z`) : undefined, finalAmount, createdBy: actorId, updatedBy: actorId, items: { create: data.items } }, include: feeInclude });
      await tx.tuitionAuditLog.create({ data: { entityType: "TUITION_FEE", entityId: fee.id, action: "CREATE", dataAfter: fee as unknown as Prisma.InputJsonValue, performedBy: actorId } });
      return fee;
    });
  }

  static async updateFee(id: string, data: TuitionFeeUpdate, actorId: string) {
    return prisma.$transaction(async (tx) => {
      const current = await tx.tuitionFee.findUnique({ where: { id }, include: { payments: { where: { paymentStatus: TuitionPaymentStatus.SUCCESS } } } });
      if (!current) throw new NotFoundError("Không tìm thấy khoản học phí");
      if (current.version !== data.version) throw new ConflictError("Khoản học phí đã thay đổi, vui lòng tải lại");
      if (current.payments.length) throw new ConflictError("Không thể sửa khoản học phí đã thanh toán");
      const finalAmount = current.originalAmount.sub(data.discountAmount ?? current.discountAmount).add(data.additionalAmount ?? current.additionalAmount);
      if (finalAmount.isNegative()) throw new ConflictError("Số tiền cuối không hợp lệ");
      const updated = await tx.tuitionFee.update({ where: { id }, data: { discountAmount: data.discountAmount, additionalAmount: data.additionalAmount, finalAmount, dueDate: data.dueDate === undefined ? undefined : data.dueDate ? new Date(`${data.dueDate}T00:00:00.000Z`) : null, note: data.note, version: { increment: 1 }, updatedBy: actorId }, include: feeInclude });
      await tx.tuitionAuditLog.create({ data: { entityType: "TUITION_FEE", entityId: id, action: "UPDATE", reason: data.reason, dataBefore: current as unknown as Prisma.InputJsonValue, dataAfter: updated as unknown as Prisma.InputJsonValue, performedBy: actorId } });
      return updated;
    });
  }

  static async createPayment(data: TuitionPaymentCreate, actorId: string) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.tuitionPayment.findUnique({ where: { idempotencyKey: data.idempotencyKey }, include: { tuitionFee: true, receipt: true } });
      if (existing) return existing;
      const fee = await tx.tuitionFee.findUnique({ where: { id: data.tuitionFeeId }, include: { payments: { where: { paymentStatus: TuitionPaymentStatus.SUCCESS } }, paymentAllocations: { where: { paymentBatch: { status: PaymentBatchStatus.PENDING } }, select: { paymentBatch: { select: { batchNo: true } } } } } });
      if (!fee) throw new NotFoundError("Không tìm thấy khoản học phí");
      if (fee.status === TuitionFeeStatus.CANCELLED) throw new ConflictError("TUITION_CANCELLED");
      if (fee.status === TuitionFeeStatus.EXEMPTED) throw new ConflictError("TUITION_EXEMPTED");
      if (fee.payments.length > 0 || fee.status === TuitionFeeStatus.PAID) throw new ConflictError("TUITION_ALREADY_PAID");
      const pendingBatch = fee.paymentAllocations[0]?.paymentBatch.batchNo;
      if (pendingBatch) throw new ConflictError(`Khoản học phí đang chờ thanh toán trong batch ${pendingBatch}`);
      const payment = await tx.tuitionPayment.create({ data: { paymentNo: `PAY-${Date.now()}-${Math.floor(Math.random() * 10000)}`, tuitionFeeId: fee.id, studentId: fee.studentId, amount: fee.finalAmount, paymentMethod: data.paymentMethod, paymentStatus: TuitionPaymentStatus.SUCCESS, idempotencyKey: data.idempotencyKey, paymentDate: data.paymentDate ? new Date(data.paymentDate) : undefined, bankAccountId: data.bankAccountId, transactionReference: data.transactionReference, payerName: data.payerName, paymentContent: data.paymentContent, note: data.note, receivedBy: actorId, confirmedBy: actorId, confirmedAt: new Date(), createdBy: actorId, updatedBy: actorId } });
      await tx.tuitionFee.update({ where: { id: fee.id }, data: { status: TuitionFeeStatus.PAID, version: { increment: 1 }, updatedBy: actorId } });
      const receipt = await tx.tuitionReceipt.create({ data: { receiptNo: `REC-${Date.now()}-${Math.floor(Math.random() * 10000)}`, paymentId: payment.id, issuedBy: actorId, receiverName: data.payerName || fee.studentId, amount: fee.finalAmount } });
      await tx.tuitionAuditLog.create({ data: { entityType: "TUITION_PAYMENT", entityId: payment.id, action: "SUCCESS", dataAfter: payment as unknown as Prisma.InputJsonValue, performedBy: actorId } });
      return { payment, receipt };
    });
  }
}
