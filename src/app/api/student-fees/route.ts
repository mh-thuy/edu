import { NextRequest, NextResponse } from "next/server";
import { StudentFeeService } from "@/modules/finance/student-fees/services/student-fee.service";
import {
  studentFeeFilterSchema,
  studentFeeCreateSchema,
} from "@/modules/finance/student-fees/schemas/student-fee.schema";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filter = {
      page: searchParams.get("page") || "1",
      limit: searchParams.get("limit") || "10",
      search: searchParams.get("search") || undefined,
      status: searchParams.get("status") || undefined,
      classId: searchParams.get("classId") || undefined,
      studentId: searchParams.get("studentId") || undefined,
      month: searchParams.get("month") || undefined,
    };

    const validated = studentFeeFilterSchema.parse(filter);
    const result = await StudentFeeService.getStudentFees(validated);

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch student fees";
    console.error("Student fees API error:", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate the request body with create schema
    const validated = studentFeeCreateSchema.parse(body);

    // Create a single student fee
    const result = await StudentFeeService.createStudentFee({
      studentId: validated.studentId,
      classId: validated.classId,
      month: validated.month,
      amount: validated.amount,
      dueDate: new Date(validated.dueDate),
      status: "UNPAID", // Default status for new fees
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create student fee";
    console.error("Student fee creation error:", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
