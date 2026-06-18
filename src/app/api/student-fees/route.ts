import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api";
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
      pageSize: searchParams.get("pageSize") || "10",
      search: searchParams.get("search") || undefined,
      status: searchParams.get("status") || undefined,
      classId: searchParams.get("classId") || undefined,
      studentId: searchParams.get("studentId") || undefined,
      month: searchParams.get("month") || undefined,
    };

    const validated = studentFeeFilterSchema.parse(filter);
    const result = await StudentFeeService.getStudentFees(validated);

    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error, "Failed to fetch student fees");
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

    return apiSuccess(result, 201);
  } catch (error) {
    return handleApiError(error, "Failed to create student fee");
  }
}
