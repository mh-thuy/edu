import { NextRequest } from "next/server";
import { TeacherPayrollService } from "@/modules/finance/teacher-payroll/services/teacher-payroll.service";
import { getSessionFromCookie } from "@/lib/session";
import { apiError, apiSuccess, handleApiError } from "@/lib/api";

type Params = Promise<{ id: string }>;

export async function POST(
  _request: NextRequest,
  { params }: { params: Params },
) {
  try {
    const session = await getSessionFromCookie();
    if (!session?.user?.id) {
      return apiError("UNAUTHORIZED", "Unauthorized", 401);
    }

    const { id } = await params;
    const payroll = await TeacherPayrollService.markPayrollAsPaid(
      id,
      session.user.id,
    );

    return apiSuccess(payroll);
  } catch (error) {
    return handleApiError(error, "Failed to mark payroll as paid");
  }
}
