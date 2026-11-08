import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError } from "@/lib/errors";
import type { AuditContext } from "@/lib/audit";
import { assignStudentToClass } from "@/modules/class/services/class.service";

export type BulkEnrollmentInput = {
  studentId: string;
  classes: Array<{ classId: string; classSubjectIds: string[] }>;
};

export type BulkEnrollmentResult = {
  classId: string;
  status: "SUCCESS" | "FAILED";
  enrollmentId?: string;
  alreadyEnrolled?: boolean;
  message?: string;
};

export type StudentEnrollmentPreview = {
  classId: string;
  enrollmentId: string | null;
  enrollmentStatus: "ACTIVE" | "COMPLETED" | "LEFT" | "SUSPENDED" | null;
  activeClassSubjectIds: string[];
};

export async function getStudentEnrollmentPreview(
  studentId: string,
  classIds: string[],
): Promise<StudentEnrollmentPreview[]> {
  const enrollments = await prisma.classStudent.findMany({
    where: { studentId, classId: { in: classIds } },
    select: {
      id: true,
      classId: true,
      status: true,
      subjects: {
        where: { status: "ACTIVE" },
        select: { classSubjectId: true },
      },
    },
  });
  const enrollmentByClassId = new Map(enrollments.map((item) => [item.classId, item]));

  return classIds.map((classId) => {
    const enrollment = enrollmentByClassId.get(classId);
    return {
      classId,
      enrollmentId: enrollment?.id ?? null,
      enrollmentStatus: enrollment?.status ?? null,
      activeClassSubjectIds:
        enrollment?.status === "ACTIVE"
          ? enrollment.subjects.map((item) => item.classSubjectId)
          : [],
    };
  });
}

function getFailureMessage(error: unknown): string {
  if (error instanceof ConflictError || error instanceof NotFoundError) {
    return error.message;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") return "Không tìm thấy dữ liệu đăng ký";
    if (error.code === "P2002") return "Dữ liệu đăng ký đã tồn tại";
  }
  return "Không thể xử lý lớp này. Vui lòng thử lại.";
}

export async function registerStudentToClasses(
  input: BulkEnrollmentInput,
  actorId: string,
  auditContext?: AuditContext,
): Promise<BulkEnrollmentResult[]> {
  const student = await prisma.student.findUnique({
    where: { id: input.studentId },
    select: { id: true, status: true },
  });
  if (!student) throw new NotFoundError("Không tìm thấy học viên");
  if (student.status !== "ACTIVE") {
    throw new ConflictError("Không thể đăng ký học viên đã ngừng hoạt động");
  }

  const results: BulkEnrollmentResult[] = [];

  for (const item of input.classes) {
    try {
      const classData = await prisma.class.findUnique({
        where: { id: item.classId },
        select: { status: true },
      });
      if (!classData) throw new NotFoundError("Không tìm thấy lớp học");
      if (classData.status !== "ACTIVE") {
        throw new ConflictError("Chỉ có thể đăng ký vào lớp đang hoạt động");
      }
      const existingEnrollment = await prisma.classStudent.findUnique({
        where: {
          classId_studentId: {
            classId: item.classId,
            studentId: input.studentId,
          },
        },
        select: {
          id: true,
          status: true,
          subjects: {
            where: { status: "ACTIVE" },
            select: { classSubjectId: true },
          },
        },
      });
      const activeSubjectIds = new Set(
        existingEnrollment?.status === "ACTIVE"
          ? existingEnrollment.subjects.map((subject) => subject.classSubjectId)
          : [],
      );
      const newSubjectIds = item.classSubjectIds.filter(
        (subjectId) => !activeSubjectIds.has(subjectId),
      );

      if (existingEnrollment?.status === "ACTIVE" && newSubjectIds.length === 0) {
        results.push({
          classId: item.classId,
          status: "SUCCESS",
          enrollmentId: existingEnrollment.id,
          alreadyEnrolled: true,
          message: "Enrollment hiện có đã bao gồm các môn đã chọn",
        });
        continue;
      }

      const enrollment = await assignStudentToClass(
        item.classId,
        input.studentId,
        newSubjectIds,
        actorId,
        auditContext,
        { activeOnly: true },
      );
      results.push({
        classId: item.classId,
        status: "SUCCESS",
        enrollmentId: enrollment.id,
      });
    } catch (error) {
      results.push({
        classId: item.classId,
        status: "FAILED",
        message: getFailureMessage(error),
      });
    }
  }

  return results;
}
