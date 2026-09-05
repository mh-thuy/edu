import { PaymentBatchStatus, TuitionPaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError } from "@/lib/errors";
import type { ClassTuitionReportInput } from "@/modules/finance/reports/schemas/class-tuition-report.schema";

export type ClassTuitionReportRow = {
  studentCode: string;
  givenName: string;
  familyName: string;
  paidAmount: number;
};

export type ClassTuitionReport = {
  classCode: string;
  className: string;
  subjectCode: string;
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
  const start = new Date(`${month}-01T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return { start, end };
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
      subject: { select: { code: true, name: true } },
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

  if (classSubject.teacher.status !== "ACTIVE") {
    throw new ConflictError("Giáo viên phụ trách đang không hoạt động");
  }

  const enrollments = await prisma.classStudent.findMany({
    where: {
      classId: input.classId,
      status: "ACTIVE",
      subjects: {
        some: {
          classSubjectId: input.classSubjectId,
          status: "ACTIVE",
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
    subjectCode: classSubject.subject.code,
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
        (total, fee) =>
          total + fee.payments.reduce((feeTotal, payment) => feeTotal + Number(payment.amount), 0),
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
