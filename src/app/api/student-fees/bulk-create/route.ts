import { NextRequest, NextResponse } from "next/server";
import { StudentFeeService } from "@/modules/finance/student-fees/services/student-fee.service";
import { bulkCreateStudentFeesSchema } from "@/modules/finance/student-fees/schemas/student-fee.schema";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate the request body with bulk create schema
    const validated = bulkCreateStudentFeesSchema.parse(body);

    // Parse dueDate from string to Date
    const dueDate = new Date(validated.dueDate);
    if (isNaN(dueDate.getTime())) {
      throw new Error("Ngày hạn thanh toán không hợp lệ");
    }

    // Create bulk fees for all students in the class
    const result = await StudentFeeService.createBulkFeesForClass(
      validated.classId,
      validated.month,
      validated.amount,
      validated.discount || 0,
      dueDate,
      validated.note,
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Tạo hóa đơn hàng loạt thất bại";
    console.error("Bulk create student fees error:", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
