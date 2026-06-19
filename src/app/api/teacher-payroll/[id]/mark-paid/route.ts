import { NextRequest } from "next/server";
import { TeacherPayrollService } from "@/modules/finance/teacher-payroll/services/teacher-payroll.service";
import { requireApiRole } from "@/lib/api-auth";
import { apiSuccess, handleApiError } from "@/lib/api";

type Params = Promise<{ id: string }>;

export async function POST(
  _request: NextRequest,
  { params }: { params: Params },
) {
  try {
    const user = await requireApiRole(["ADMIN"]);
    if (user instanceof Response) {
      return user;
    }

    const { id } = await params;
    const payroll = await TeacherPayrollService.markPayrollAsPaid(id);

    return apiSuccess(payroll);
  } catch (error) {
    return handleApiError(error, "Failed to mark payroll as paid");
  }
}
