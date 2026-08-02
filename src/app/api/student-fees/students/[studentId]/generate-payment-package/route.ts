import { apiSuccess, handleApiError } from "@/lib/api";
import { StudentFeeService } from "@/modules/finance/student-fees/services/student-fee.service";
import { z } from "zod";

type Params = Promise<{ studentId: string }>;

export async function POST(request: Request, { params }: { params: Params }) {
  try {
    const { studentId } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      feeIds?: unknown;
    };
    const feeIds =
      body.feeIds === undefined
        ? undefined
        : z.array(z.string().min(1)).min(1).parse(body.feeIds);

    return apiSuccess(
      await StudentFeeService.generateStudentPaymentPackage(studentId, feeIds),
    );
  } catch (error) {
    return handleApiError(error, "Không thể tạo bộ thanh toán");
  }
}
