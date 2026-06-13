import { NextRequest, NextResponse } from "next/server";
import { TeacherPayrollService } from "@/modules/finance/teacher-payroll/services/teacher-payroll.service";
import { teacherPayrollFilterSchema } from "@/modules/finance/teacher-payroll/schemas/teacher-payroll.schema";

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

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch payrolls";
    console.error("Teacher payroll API error:", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { teacherId, month } = body;

    if (!teacherId || !month) {
      return NextResponse.json(
        { error: "teacherId and month are required" },
        { status: 400 }
      );
    }

    const payroll = await TeacherPayrollService.calculateMonthlyPayroll(teacherId, month);

    return NextResponse.json(payroll, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to calculate payroll";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
