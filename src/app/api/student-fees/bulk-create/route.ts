import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api";
import { requireApiRole } from "@/lib/api-auth";
import { StudentFeeService } from "@/modules/finance/student-fees/services/student-fee.service";
import { bulkCreateStudentFeesSchema } from "@/modules/finance/student-fees/schemas/student-fee.schema";

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiRole(["ADMIN", "STAFF"]);
    if (user instanceof Response) {
      return user;
    }

    const body = await request.json();

    // Validate the request body with bulk create schema
    const validated = bulkCreateStudentFeesSchema.parse(body);

    // Parse dueDate from string to Date
    const dueDate = new Date(validated.dueDate);
    if (isNaN(dueDate.getTime())) {
      throw new Error("Ngày hạn thanh toán không hợp lệ");
    }

    // Create bulk fees for all students in the class
    const result = await StudentFeeService.createBulkFeesForClass({
      classId: validated.classId,
      studentIds: validated.studentIds,
      month: validated.month,
      amount: validated.amount,
      discount: validated.discount || 0,
      dueDate,
      note: validated.note,
    });

    return apiSuccess(result, 201);
  } catch (error) {
    return handleApiError(error, "Tạo hóa đơn hàng loạt thất bại");
  }
}
