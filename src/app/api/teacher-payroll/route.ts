import { NextRequest, NextResponse } from "next/server";
import { TeacherPayrollService } from "@/modules/finance/teacher-payroll/services/teacher-payroll.service";
import {
  teacherPayrollFilterSchema,
  teacherPayrollCreateSchema,
} from "@/modules/finance/teacher-payroll/schemas/teacher-payroll.schema";
import { getSessionFromCookie } from "@/lib/session";

function buildPayrollSuccessResponse<T>(
  items: T[],
  total: number,
  meta?: { page?: number; limit?: number; pages?: number },
) {
  return {
    success: true,
    data: {
      items,
      total,
      ...meta,
    },
  };
}

function buildPayrollErrorResponse(error: string) {
  return {
    success: false,
    data: {
      items: [],
      total: 0,
    },
    error,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filter = {
      page: searchParams.get("page") || "1",
      limit: searchParams.get("limit") || "10",
      teacherId: searchParams.get("teacherId") || undefined,
      month: searchParams.get("month") || undefined,
      status: searchParams.get("status") || undefined,
    };

    const validated = teacherPayrollFilterSchema.parse(filter);
    const result = await TeacherPayrollService.getPayrolls(validated);

    return NextResponse.json(
      buildPayrollSuccessResponse(result.items, result.total, {
        page: result.page,
        limit: result.limit,
        pages: result.pages,
      }),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch payrolls";
    console.error("Teacher payroll API error:", error);
    return NextResponse.json(buildPayrollErrorResponse(message), {
      status: 400,
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromCookie();
    if (!session?.user?.id) {
      return NextResponse.json(buildPayrollErrorResponse("Unauthorized"), {
        status: 401,
      });
    }

    const body = await request.json();
    const validated = teacherPayrollCreateSchema.parse(body);

    const payroll = await TeacherPayrollService.calculateMonthlyPayroll(
      validated.teacherId,
      validated.month,
    );

    return NextResponse.json(buildPayrollSuccessResponse([payroll], 1), {
      status: 201,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to calculate payroll";
    return NextResponse.json(buildPayrollErrorResponse(message), {
      status: 400,
    });
  }
}
