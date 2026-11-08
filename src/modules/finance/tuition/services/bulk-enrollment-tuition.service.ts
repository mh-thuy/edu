import { Prisma } from "@prisma/client";
import type { AuditContext } from "@/lib/audit";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { TuitionService } from "@/modules/finance/tuition/services/tuition.service";

export type BulkEnrollmentTuitionInput = {
  studentId: string;
  month: string;
  classIds: string[];
};

export type BulkEnrollmentTuitionResult = {
  classId: string;
  status: "SUCCESS" | "FAILED";
  tuitionFeeId?: string;
  feeNo?: string;
  finalAmount?: number;
  message?: string;
};

function getFailureMessage(error: unknown): string {
  if (error instanceof ConflictError || error instanceof NotFoundError) {
    return error.message;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") return "Không tìm thấy dữ liệu học phí";
    if (error.code === "P2002") return "Học phí kỳ này đã tồn tại";
  }
  return "Không thể tạo học phí cho lớp này. Vui lòng thử lại.";
}

export async function createEnrollmentTuitionFees(
  input: BulkEnrollmentTuitionInput,
  actorId: string,
  auditContext?: AuditContext,
): Promise<BulkEnrollmentTuitionResult[]> {
  const billingYear = Number(input.month.slice(0, 4));
  const billingMonth = Number(input.month.slice(5, 7));
  const results: BulkEnrollmentTuitionResult[] = [];

  for (const classId of input.classIds) {
    try {
      const fee = await TuitionService.createFromEnrollment(
        { classId, studentId: input.studentId, billingYear, billingMonth },
        actorId,
        undefined,
        { allowExistingComplete: true },
        auditContext,
      );
      results.push({
        classId,
        status: "SUCCESS",
        tuitionFeeId: fee.id,
        feeNo: fee.feeNo,
        finalAmount: Number(fee.finalAmount),
      });
    } catch (error) {
      results.push({
        classId,
        status: "FAILED",
        message: getFailureMessage(error),
      });
    }
  }

  return results;
}
