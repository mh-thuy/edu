import { NextRequest, NextResponse } from "next/server";
import { TeacherPayrollService } from "@/modules/finance/teacher-payroll/services/teacher-payroll.service";

type Params = Promise<{ id: string }>;

export async function POST(request: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const payroll = await TeacherPayrollService.approvePayroll(id);

    return NextResponse.json(payroll);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to approve payroll";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
