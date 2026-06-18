import { NextRequest } from "next/server";
import { apiError, apiSuccess, handleApiError } from "@/lib/api";
import { TeacherPayrollService } from "@/modules/finance/teacher-payroll/services/teacher-payroll.service";

type Params = Promise<{ id: string }>;

export async function GET(
  _request: NextRequest,
  { params }: { params: Params },
) {
  try {
    const { id } = await params;
    const payroll = await TeacherPayrollService.getPayrollById(id);

    if (!payroll) {
      return apiError("NOT_FOUND", "Payroll not found", 404);
    }

    return apiSuccess(payroll);
  } catch (error) {
    return handleApiError(error, "Failed to fetch payroll");
  }
}
