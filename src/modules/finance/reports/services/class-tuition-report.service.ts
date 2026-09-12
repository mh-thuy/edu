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
    .reduce((total, item) => total + Number(item.amount), 0);
  if (subjectGross <= 0) return 0;

  const originalAmount = Number(fee.originalAmount);
  const adjustmentRatio = originalAmount > 0
    ? Math.min(Math.max(subjectGross / originalAmount, 0), 1)
    : 1;
  const subjectFinal = Math.max(
    0,
    subjectGross
      - Number(fee.discountAmount) * adjustmentRatio
      + Number(fee.additionalAmount) * adjustmentRatio,
  );
  const finalAmount = Number(fee.finalAmount);
  const paymentRatio = finalAmount > 0 ? subjectFinal / finalAmount : 0;

  return fee.payments.reduce(
    (total, payment) => total + Number(payment.amount) * paymentRatio,
    0,
  );
}

export async function getClassTuitionReport(
  input: ClassTuitionReportInput,
): Promise<ClassTuitionReport> {
  const { start, end } = getMonthRange(input.month);
  const classSubject = await prisma.classSubject.findFirst({
    where: {
      id: input.classSubjectId,
      classId: input.classId,
      status: "ACTIVE",
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

  if (!classSubject) {
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
    rows: enrollments.map((enrollment) => {
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
    }),
  };
}
