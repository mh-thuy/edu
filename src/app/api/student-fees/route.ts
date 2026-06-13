import { NextRequest, NextResponse } from "next/server";
import { StudentFeeService } from "@/modules/finance/student-fees/services/student-fee.service";
import { studentFeeFilterSchema } from "@/modules/finance/student-fees/schemas/student-fee.schema";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filter = {
      page: searchParams.get("page") || "1",
      limit: searchParams.get("limit") || "10",
      status: searchParams.get("status"),
      classId: searchParams.get("classId"),
      studentId: searchParams.get("studentId"),
      month: searchParams.get("month"),
    };

    const validated = studentFeeFilterSchema.parse(filter);
    const result = await StudentFeeService.getStudentFees(validated);

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch student fees";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Support bulk creation or single creation
    if (body.classId && body.month && body.amount) {
      // Bulk creation for entire class
      const result = await StudentFeeService.createBulkFeesForClass(
        body.classId,
        body.month,
        body.amount,
        new Date(body.dueDate)
      );
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { error: "Missing required fields for bulk creation" },
      { status: 400 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create student fees";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
