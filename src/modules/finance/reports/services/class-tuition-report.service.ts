import { PaymentBatchStatus, Prisma, TuitionPaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError } from "@/lib/errors";
import type { ClassTuitionReportInput } from "@/modules/finance/reports/schemas/class-tuition-report.schema";
import { getVietnamMonthRange } from "@/lib/vietnam-time";

export type ClassTuitionReportRow = {
  studentCode: string;
  givenName: string;
  familyName: string;
  paidAmount: number;
};

export type ClassTuitionReport = {
  classCode: string;
  className: string;
  subjectName: string;
  teacherCode: string;
  teacherName: string;
  commissionPercent: number;
  month: string;
  rows: ClassTuitionReportRow[];
};

function splitStudentName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const familyName = parts.pop() ?? "";

  return {
    givenName: parts.join(" "),
    familyName,
  };
}

function getMonthRange(month: string) {
  const range = getVietnamMonthRange(month);
  if (!range) throw new ConflictError("Kỳ báo cáo không hợp lệ");
  return range;
}

function getSubjectPaidAmount(
  fee: {
    originalAmount: Prisma.Decimal;
    discountAmount: Prisma.Decimal;
    additionalAmount: Prisma.Decimal;
    finalAmount: Prisma.Decimal;
    items: Array<{ classSubjectId: string | null; amount: Prisma.Decimal }>;
    payments: Array<{ amount: Prisma.Decimal }>;
  },
  classSubjectId: string,
) {
  const subjectGross = fee.items
    .filter((item) => item.classSubjectId === classSubjectId)
    .reduce((total, item) => total.add(item.amount), new Prisma.Decimal(0));
  if (!subjectGross.greaterThan(0)) return 0;

  const originalAmount = fee.originalAmount;
  const adjustmentRatio = originalAmount.greaterThan(0)
    ? Prisma.Decimal.min(Prisma.Decimal.max(subjectGross.div(originalAmount), 0), 1)
    : new Prisma.Decimal(1);
  const subjectFinal = Prisma.Decimal.max(
    subjectGross
      .minus(fee.discountAmount.mul(adjustmentRatio))
      .plus(fee.additionalAmount.mul(adjustmentRatio)),
    0,
  );
  const finalAmount = fee.finalAmount;
  const paymentRatio = finalAmount.greaterThan(0)
    ? subjectFinal.div(finalAmount)
    : new Prisma.Decimal(0);

  return fee.payments
    .reduce(
      (total, payment) => total.plus(payment.amount.mul(paymentRatio)),
      new Prisma.Decimal(0),
    )
    .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP)
    .toNumber();
}

export async function getClassTuitionReport(
  input: ClassTuitionReportInput,
): Promise<ClassTuitionReport> {
  const { start, end } = getMonthRange(input.month);
  const classSubject = await prisma.classSubject.findFirst({
    where: {
      id: input.classSubjectId,
      classId: input.classId,
    },
    include: {
      class: { select: { code: true, name: true } },
      subject: { select: { name: true } },
      teacher: {
        select: {
          id: true,
          code: true,
          fullName: true,
          commissionPercent: true,
          status: true,
        },
      },
    },
  });

  if (!classSubject || !["ACTIVE", "COMPLETED"].includes(classSubject.status)) {
    throw new NotFoundError("Không tìm thấy môn học thuộc lớp đã chọn");
  }

  if (!classSubject.teacher) {
    throw new ConflictError("Môn học chưa được phân công giáo viên");
  }

  const enrollments = await prisma.classStudent.findMany({
    where: {
      classId: input.classId,
      tuitionFees: {
        some: {
          classId: input.classId,
          items: { some: { classSubjectId: input.classSubjectId } },
        },
      },
    },
    select: {
      student: { select: { code: true, fullName: true } },
      tuitionFees: {
        where: {
          classId: input.classId,
          items: { some: { classSubjectId: input.classSubjectId } },
        },
        select: {
          originalAmount: true,
          discountAmount: true,
          additionalAmount: true,
          finalAmount: true,
          items: {
            select: { classSubjectId: true, amount: true },
          },
          payments: {
            where: {
              paymentStatus: TuitionPaymentStatus.SUCCESS,
              paymentDate: { gte: start, lt: end },
              OR: [
                { paymentBatch: { is: null } },
                { paymentBatch: { status: PaymentBatchStatus.SUCCESS } },
              ],
            },
            select: { amount: true },
          },
        },
      },
    },
    orderBy: { student: { fullName: "asc" } },
  });

  return {
    classCode: classSubject.class.code,
    className: classSubject.class.name,
    subjectName: classSubject.subject.name,
    teacherCode: classSubject.teacher.code,
    teacherName: classSubject.teacher.fullName,
    commissionPercent: Number(classSubject.teacher.commissionPercent),
    month: input.month,
    rows: enrollments
      .map((enrollment) => {
        const { givenName, familyName } = splitStudentName(
          enrollment.student.fullName,
        );
        const paidAmount = enrollment.tuitionFees.reduce(
          (total, fee) => total + getSubjectPaidAmount(fee, input.classSubjectId),
          0,
        );

        return {
          studentCode: enrollment.student.code,
          givenName,
          familyName,
          paidAmount,
        };
      })
      .filter((row) => row.paidAmount > 0),
  };
}
