import { NextRequest, NextResponse } from "next/server";
import { TeacherPayrollService } from "@/modules/finance/teacher-payroll/services/teacher-payroll.service";

type Params = Promise<{ id: string }>;

export async function GET(request: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const payroll = await TeacherPayrollService.getPayrollById(id);

    if (!payroll) {
      return NextResponse.json({ error: "Payroll not found" }, { status: 404 });
    }

    return NextResponse.json(payroll);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch payroll";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
