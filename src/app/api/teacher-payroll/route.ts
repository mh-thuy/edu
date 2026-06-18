import { NextRequest } from "next/server";
import { apiError, apiSuccess, handleApiError } from "@/lib/api";
import { TeacherPayrollService } from "@/modules/finance/teacher-payroll/services/teacher-payroll.service";
import {
  teacherPayrollFilterSchema,
  teacherPayrollCreateSchema,
} from "@/modules/finance/teacher-payroll/schemas/teacher-payroll.schema";
import { getSessionFromCookie } from "@/lib/session";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filter = {
      page: searchParams.get("page") || "1",
      pageSize: searchParams.get("pageSize") || "10",
      teacherId: searchParams.get("teacherId") || undefined,
      month: searchParams.get("month") || undefined,
      status: searchParams.get("status") || undefined,
    };

    const validated = teacherPayrollFilterSchema.parse(filter);
    const result = await TeacherPayrollService.getPayrolls(validated);

    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error, "Failed to fetch payrolls");
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromCookie();
    if (!session?.user?.id) {
      return apiError("UNAUTHORIZED", "Unauthorized", 401);
    }

    const body = await request.json();
    const validated = teacherPayrollCreateSchema.parse(body);

    const payroll = await TeacherPayrollService.calculateMonthlyPayroll(
      validated.teacherId,
      validated.month,
    );

    return apiSuccess(payroll, 201);
  } catch (error) {
    return handleApiError(error, "Failed to calculate payroll");
  }
}
