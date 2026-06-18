import { NextRequest } from "next/server";
import { TeacherPayrollService } from "@/modules/finance/teacher-payroll/services/teacher-payroll.service";
import { ForbiddenError } from "@/lib/errors";
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
    if (session.user.role !== "ADMIN") {
      throw new ForbiddenError("Only ADMIN can approve payroll");
    }

    const { id } = await params;
    const payroll = await TeacherPayrollService.approvePayroll(
      id
    );

    return apiSuccess(payroll);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return apiError("FORBIDDEN", error.message, 403);
    }
    return handleApiError(error, "Failed to approve payroll");
  }
}
