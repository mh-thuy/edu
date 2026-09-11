import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError } from "@/lib/errors";
import {
  PaymentBatchStatus,
  Prisma,
  TuitionFeeBillingType,
  TuitionFeeStatus,
  TuitionPaymentStatus,
} from "@prisma/client";
import type {
  TuitionFeeUpdate,
  TuitionPaymentCreate,
} from "@/modules/finance/tuition/schemas/tuition.schema";

const feeInclude = {
  student: true,
  class: true,
  enrollment: true,
  items: { orderBy: { displayOrder: "asc" as const } },
  payments: {
    where: { paymentStatus: TuitionPaymentStatus.SUCCESS },
    include: { receipt: true },
  },
  paymentAllocations: {
    where: { paymentBatch: { status: PaymentBatchStatus.PENDING } },
    select: {
      paymentBatch: { select: { id: true, batchNo: true, status: true } },
    },
  },
};

export type TuitionBillingPeriod = {
  billingYear: number;
  billingMonth: number;
};

async function generateTuitionFeeNo(
  tx: Prisma.TransactionClient,
  period: TuitionBillingPeriod,
) {
  const prefix = `HP-${period.billingYear}${String(period.billingMonth).padStart(2, "0")}`;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = `${prefix}-${Math.floor(100000 + Math.random() * 900000)}`;
    if (
      !(await tx.tuitionFee.findUnique({
        where: { feeNo: candidate },
        select: { id: true },
      }))
    )
      return candidate;
  }
  throw new ConflictError("Không thể tạo mã học phí tự động, vui lòng thử lại");
}

export class TuitionService {
  static async listFees(params: {
    studentCode?: string;
    classId?: string;
    status?: TuitionFeeStatus;
    billingYear?: number;
    billingMonth?: number;
    page: number;
    pageSize: number;
  }) {
    const page = Number.isFinite(params.page)
      ? Math.max(Math.floor(params.page), 1)
      : 1;
    const pageSize = Number.isFinite(params.pageSize)
      ? Math.min(Math.max(Math.floor(params.pageSize), 1), 10000)
      : 50;
    const where: Prisma.TuitionFeeWhereInput = {
      ...(params.status ? { status: params.status } : {}),
      ...(params.studentCode
        ? {
            student: {
              code: { equals: params.studentCode, mode: "insensitive" },
            },
          }
        : {}),
      ...(params.classId ? { classId: params.classId } : {}),
      ...(params.billingYear ? { billingYear: params.billingYear } : {}),
      ...(params.billingMonth ? { billingMonth: params.billingMonth } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.tuitionFee.findMany({
        where,
        include: feeInclude,
        orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.tuitionFee.count({ where }),
    ]);
    return { items, total, page, pageSize, pages: Math.ceil(total / pageSize) };
  }

  static async getFee(id: string) {
    const fee = await prisma.tuitionFee.findUnique({
      where: { id },
      include: feeInclude,
    });
    if (!fee) throw new NotFoundError("Không tìm thấy khoản học phí");
    return fee;
  }

  static async createFromEnrollment(
    data: { classId: string; studentId: string } & TuitionBillingPeriod,
    actorId: string,
  ) {
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`${data.classId}:${data.billingYear}:${data.billingMonth}`}))`,
      );
      const enrollment = await tx.classStudent.findUnique({
        where: {
          classId_studentId: {
            classId: data.classId,
            studentId: data.studentId,
          },
        },
        include: {
          class: true,
          subjects: {
            where: { status: "ACTIVE" },
            include: { classSubject: { include: { subject: true } } },
          },
        },
      });
      if (!enrollment) {
        throw new NotFoundError("Không tìm thấy đăng ký học viên trong lớp");
      }
      if (enrollment.subjects.length === 0) {
        throw new ConflictError("Học viên chưa đăng ký môn học nào");
      }

      if (enrollment.status === "SUSPENDED") {
        throw new ConflictError("Học viên đang được bảo lưu trong tháng này");
      }
      if (enrollment.status !== "ACTIVE") {
        throw new ConflictError("Học viên không còn ở trạng thái đang học");
      }
      const periodStart = new Date(
        Date.UTC(data.billingYear, data.billingMonth - 1, 1),
      );
      const periodEnd = new Date(Date.UTC(data.billingYear, data.billingMonth, 0));
      const pause = await tx.enrollmentPause.findFirst({
        where: {
          enrollmentId: enrollment.id,
          startMonth: { lte: periodEnd },
          endMonth: { gte: periodStart },
        },
        select: { id: true },
      });
      if (pause) {
        throw new ConflictError(
          `Học viên đang tạm nghỉ trong tháng ${data.billingMonth}/${data.billingYear}`,
        );
      }

      const existingFee = await tx.tuitionFee.findFirst({
        where: {
          studentId: data.studentId,
          classId: data.classId,
          billingYear: data.billingYear,
          billingMonth: data.billingMonth,
          billingType: TuitionFeeBillingType.MONTHLY,
        },
        include: {
          items: { select: { classSubjectId: true } },
          payments: {
            where: { paymentStatus: TuitionPaymentStatus.SUCCESS },
            select: { id: true },
          },
          paymentAllocations: {
            where: { paymentBatch: { status: PaymentBatchStatus.PENDING } },
            select: { paymentBatchId: true },
          },
        },
      });
      const billedSubjectIds = new Set(
        (existingFee?.items ?? [])
          .map((item) => item.classSubjectId)
          .filter((value): value is string => Boolean(value)),
      );
      const subjectsToCalculate = enrollment.subjects.filter(
        (subject) => !billedSubjectIds.has(subject.classSubjectId),
      );
      if (subjectsToCalculate.length === 0 && existingFee) {
        const result = await tx.tuitionFee.findUnique({
          where: { id: existingFee.id },
          include: feeInclude,
        });
        if (!result) throw new NotFoundError("Không tìm thấy khoản học phí");
        return result;
      }

      if (
        existingFee &&
        (existingFee.payments.length > 0 ||
          existingFee.paymentAllocations.length > 0 ||
          existingFee.status === TuitionFeeStatus.PAID ||
          existingFee.status === TuitionFeeStatus.EXEMPTED ||
          existingFee.status === TuitionFeeStatus.CANCELLED)
      ) {
        throw new ConflictError(
          "Không thể bổ sung môn vào học phí tháng đã có thanh toán hoặc đang chờ thanh toán",
        );
      }

      const calculationItems = [];
      for (const subject of subjectsToCalculate) {
        const monthlyAmount =
          subject.tuitionFeeOverride ?? subject.classSubject.tuitionFee;
        const amount = monthlyAmount.toDecimalPlaces(0);
        if (amount.isZero()) continue;
        calculationItems.push({ subject, amount });
      }
      if (calculationItems.length === 0) {
        throw new ConflictError(
          `Không có buổi học đủ điều kiện để tạo học phí tháng ${data.billingMonth}/${data.billingYear}`,
        );
      }

      const originalAmount = calculationItems.reduce(
        (total, item) => total.add(item.amount),
        new Prisma.Decimal(0),
      );
      const classEnd = enrollment.class.endDate
        ? new Date(enrollment.class.endDate)
        : null;
      const dueDate = classEnd && classEnd < periodEnd ? classEnd : periodEnd;
      const fee = existingFee
        ? await tx.tuitionFee.update({
            where: { id: existingFee.id },
            data: {
              originalAmount: { increment: originalAmount },
              finalAmount: { increment: originalAmount },
              version: { increment: 1 },
              updatedBy: actorId,
            },
          })
        : await tx.tuitionFee.create({
            data: {
              feeNo: await generateTuitionFeeNo(tx, data),
              studentId: data.studentId,
              enrollmentId: enrollment.id,
              classId: data.classId,
              billingYear: data.billingYear,
              billingMonth: data.billingMonth,
              billingType: TuitionFeeBillingType.MONTHLY,
              originalAmount,
              discountAmount: 0,
              additionalAmount: 0,
              finalAmount: originalAmount,
              dueDate,
              createdBy: actorId,
              updatedBy: actorId,
            },
          });
      await tx.tuitionFeeItem.createMany({
        data: calculationItems.map((item, index) => ({
          tuitionFeeId: fee.id,
          classSubjectId: item.subject.classSubjectId,
          itemType: "TUITION" as const,
          itemName: `Học phí tháng ${String(data.billingMonth).padStart(2, "0")}/${data.billingYear} — ${item.subject.classSubject.subject.name}`,
          quantity: 1,
          unitPrice: item.amount,
          amount: item.amount,
          note: `Tính trọn học phí tháng ${String(data.billingMonth).padStart(2, "0")}/${data.billingYear}`,
          displayOrder: index,
        })),
      });
      await tx.tuitionAuditLog.create({
        data: {
          entityType: "ENROLLMENT",
          entityId: enrollment.id,
          action: "TUITION_FEE_CREATED",
          dataAfter: {
            classId: data.classId,
            studentId: data.studentId,
            classSubjectIds: calculationItems.map(
              (item) => item.subject.classSubjectId,
            ),
            tuitionFeeId: fee.id,
            billingYear: data.billingYear,
            billingMonth: data.billingMonth,
            calculationMode: "FULL_MONTH",
          },
          performedBy: actorId,
        },
      });
      await tx.tuitionAuditLog.create({
        data: {
          entityType: "TUITION_FEE",
          entityId: fee.id,
          action: existingFee ? "UPDATED_MONTHLY_FROM_ENROLLMENT" : "CREATED_MONTHLY_FROM_ENROLLMENT",
          dataAfter: {
            enrollmentId: enrollment.id,
            classId: data.classId,
            studentId: data.studentId,
            classSubjectIds: calculationItems.map(
              (item) => item.subject.classSubjectId,
            ),
            billingYear: data.billingYear,
            billingMonth: data.billingMonth,
            originalAmount: originalAmount.toString(),
            finalAmount: fee.finalAmount.toString(),
          },
          performedBy: actorId,
        },
      });

      const result = await tx.tuitionFee.findUnique({
        where: { id: fee.id },
        include: feeInclude,
      });
      if (!result) throw new NotFoundError("Không tìm thấy khoản học phí");
      return result;
    });
  }

  static async createClassTuitionFees(
    classId: string,
    period: TuitionBillingPeriod,
    actorId: string,
  ) {
    const enrollments = await prisma.classStudent.findMany({
      where: { classId, status: "ACTIVE" },
      select: {
        studentId: true,
        subjects: {
          where: { status: "ACTIVE" },
          select: { id: true },
        },
        pauses: {
          where: {
            startMonth: {
              lte: new Date(Date.UTC(period.billingYear, period.billingMonth, 0)),
            },
            endMonth: {
              gte: new Date(
                Date.UTC(period.billingYear, period.billingMonth - 1, 1),
              ),
            },
          },
          select: { id: true },
        },
      },
    });
    let created = 0;
    let skipped = 0;
    for (const enrollment of enrollments) {
      if (enrollment.pauses.length || enrollment.subjects.length === 0) {
        skipped += 1;
        continue;
      }
      await TuitionService.createFromEnrollment(
        { classId, studentId: enrollment.studentId, ...period },
        actorId,
      );
      created += 1;
    }
    return { created, skipped };
  }

  static async updateFee(id: string, data: TuitionFeeUpdate, actorId: string) {
    return prisma.$transaction(async (tx) => {
      const current = await tx.tuitionFee.findUnique({
        where: { id },
        include: {
          payments: { where: { paymentStatus: TuitionPaymentStatus.SUCCESS } },
          paymentAllocations: {
            where: { paymentBatch: { status: PaymentBatchStatus.PENDING } },
            select: { paymentBatch: { select: { batchNo: true } } },
          },
        },
      });
      if (!current) throw new NotFoundError("Không tìm thấy khoản học phí");
      if (current.version !== data.version)
        throw new ConflictError("Khoản học phí đã thay đổi, vui lòng tải lại");
      if (current.payments.length)
        throw new ConflictError("Không thể sửa khoản học phí đã thanh toán");
      if (current.paymentAllocations.length)
        throw new ConflictError(
          `Không thể sửa khoản học phí đang chờ thanh toán trong đợt ${current.paymentAllocations[0]?.paymentBatch.batchNo}`,
        );
      const finalAmount = current.originalAmount
        .sub(data.discountAmount ?? current.discountAmount)
        .add(data.additionalAmount ?? current.additionalAmount);
      if (finalAmount.isNegative())
        throw new ConflictError("Số tiền cuối không hợp lệ");
      const updated = await tx.tuitionFee.update({
        where: { id },
        data: {
          discountAmount: data.discountAmount,
          additionalAmount: data.additionalAmount,
          finalAmount,
          dueDate:
            data.dueDate === undefined
              ? undefined
              : data.dueDate
                ? new Date(`${data.dueDate}T00:00:00.000Z`)
                : null,
          note: data.note,
          version: { increment: 1 },
          updatedBy: actorId,
        },
        include: feeInclude,
      });
      await tx.tuitionAuditLog.create({
        data: {
          entityType: "TUITION_FEE",
          entityId: id,
          action: "UPDATE",
          reason: data.reason,
          dataBefore: current as unknown as Prisma.InputJsonValue,
          dataAfter: updated as unknown as Prisma.InputJsonValue,
          performedBy: actorId,
        },
      });
      return updated;
    });
  }

  static async createPayment(data: TuitionPaymentCreate, actorId: string) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.tuitionPayment.findUnique({
        where: { idempotencyKey: data.idempotencyKey },
        include: { tuitionFee: true, receipt: true },
      });
      if (existing) return existing;
      const fee = await tx.tuitionFee.findUnique({
        where: { id: data.tuitionFeeId },
        include: {
          payments: { where: { paymentStatus: TuitionPaymentStatus.SUCCESS } },
          paymentAllocations: {
            where: { paymentBatch: { status: PaymentBatchStatus.PENDING } },
            select: { paymentBatch: { select: { batchNo: true } } },
          },
        },
      });
      if (!fee) throw new NotFoundError("Không tìm thấy khoản học phí");
      if (fee.status === TuitionFeeStatus.CANCELLED)
        throw new ConflictError("TUITION_CANCELLED");
      if (fee.status === TuitionFeeStatus.EXEMPTED)
        throw new ConflictError("TUITION_EXEMPTED");
      if (fee.payments.length > 0 || fee.status === TuitionFeeStatus.PAID)
        throw new ConflictError("TUITION_ALREADY_PAID");
      const pendingBatch = fee.paymentAllocations[0]?.paymentBatch.batchNo;
      if (pendingBatch)
        throw new ConflictError(
          `Khoản học phí đang chờ thanh toán trong đợt ${pendingBatch}`,
        );
      const payment = await tx.tuitionPayment.create({
        data: {
          paymentNo: `PAY-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          tuitionFeeId: fee.id,
          studentId: fee.studentId,
          amount: fee.finalAmount,
          paymentMethod: data.paymentMethod,
          paymentStatus: TuitionPaymentStatus.SUCCESS,
          idempotencyKey: data.idempotencyKey,
          paymentDate: data.paymentDate
            ? new Date(data.paymentDate)
            : undefined,
          bankAccountId: data.bankAccountId,
          transactionReference: data.transactionReference,
          payerName: data.payerName,
          paymentContent: data.paymentContent,
          note: data.note,
          receivedBy: actorId,
          confirmedBy: actorId,
          confirmedAt: new Date(),
          createdBy: actorId,
          updatedBy: actorId,
        },
      });
      await tx.tuitionFee.update({
        where: { id: fee.id },
        data: {
          status: TuitionFeeStatus.PAID,
          version: { increment: 1 },
          updatedBy: actorId,
        },
      });
      const receipt = await tx.tuitionReceipt.create({
        data: {
          receiptNo: `REC-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          paymentId: payment.id,
          issuedBy: actorId,
          receiverName: data.payerName || fee.studentId,
          amount: fee.finalAmount,
        },
      });
      await tx.tuitionAuditLog.create({
        data: {
          entityType: "TUITION_PAYMENT",
          entityId: payment.id,
          action: "SUCCESS",
          dataAfter: payment as unknown as Prisma.InputJsonValue,
          performedBy: actorId,
        },
      });
      return { payment, receipt };
    });
  }
}
