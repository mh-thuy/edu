import { NextRequest, NextResponse } from "next/server";
import { TeacherPayrollService } from "@/modules/finance/teacher-payroll/services/teacher-payroll.service";

type Params = Promise<{ id: string }>;

function buildPayrollSuccessResponse<T>(items: T[], total: number) {
  return {
    success: true,
    data: {
      items,
      total,
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

export async function GET(
  _request: NextRequest,
  { params }: { params: Params },
) {
  try {
    const { id } = await params;
    const payroll = await TeacherPayrollService.getPayrollById(id);

    if (!payroll) {
      return NextResponse.json(buildPayrollErrorResponse("Payroll not found"), {
        status: 404,
      });
    }

    return NextResponse.json(buildPayrollSuccessResponse([payroll], 1));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch payroll";
    return NextResponse.json(buildPayrollErrorResponse(message), {
      status: 400,
    });
  }
}
