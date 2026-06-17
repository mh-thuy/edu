import { NextRequest, NextResponse } from "next/server";
import { StudentFeeService } from "@/modules/finance/student-fees/services/student-fee.service";
import { studentFeeUpdateSchema } from "@/modules/finance/student-fees/schemas/student-fee.schema";

type Params = Promise<{ id: string }>;

export async function GET(request: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const fee = await StudentFeeService.getStudentFeeById(id);

    if (!fee) {
      return NextResponse.json({ error: "Student fee not found" }, { status: 404 });
    }

    return NextResponse.json(fee);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch student fee";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const body = await request.json();

    const validated = studentFeeUpdateSchema.parse(body);
    const updated = await StudentFeeService.updateStudentFee(id, {
      ...validated,
      dueDate: validated.dueDate ? new Date(validated.dueDate) : undefined,
    });

    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update student fee";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    await StudentFeeService.deleteStudentFee(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete student fee";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
