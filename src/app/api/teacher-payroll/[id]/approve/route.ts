import { NextRequest, NextResponse } from "next/server";
import { TeacherPayrollService } from "@/modules/finance/teacher-payroll/services/teacher-payroll.service";
import { ForbiddenError } from "@/lib/errors";
import { getSessionFromCookie } from "@/lib/session";

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

export async function POST(
  _request: NextRequest,
  { params }: { params: Params },
) {
  try {
    const session = await getSessionFromCookie();
    if (!session?.user?.id) {
      return NextResponse.json(buildPayrollErrorResponse("Unauthorized"), {
        status: 401,
      });
    }
    if (session.user.role !== "ADMIN") {
      throw new ForbiddenError("Only ADMIN can approve payroll");
    }

    const { id } = await params;
    const payroll = await TeacherPayrollService.approvePayroll(
      id,
      session.user.id,
    );

    return NextResponse.json(buildPayrollSuccessResponse([payroll], 1));
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json(buildPayrollErrorResponse(error.message), {
        status: 403,
      });
    }
    const message =
      error instanceof Error ? error.message : "Failed to approve payroll";
    return NextResponse.json(buildPayrollErrorResponse(message), {
      status: 400,
    });
  }
}
