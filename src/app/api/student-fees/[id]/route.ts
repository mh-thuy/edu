import { NextRequest } from "next/server";
import { apiError, apiSuccess, handleApiError } from "@/lib/api";
import { requireApiRole } from "@/lib/api-auth";
import { StudentFeeService } from "@/modules/finance/student-fees/services/student-fee.service";
import { studentFeeUpdateSchema } from "@/modules/finance/student-fees/schemas/student-fee.schema";

type Params = Promise<{ id: string }>;

export async function GET(request: NextRequest, { params }: { params: Params }) {
  try {
    const user = await requireApiRole(["ADMIN", "STAFF"]);
    if (user instanceof Response) {
      return user;
    }

    const { id } = await params;
    const fee = await StudentFeeService.getStudentFeeById(id);

    if (!fee) {
      return apiError("NOT_FOUND", "Student fee not found", 404);
    }

    return apiSuccess(fee);
  } catch (error) {
    return handleApiError(error, "Failed to fetch student fee");
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Params }) {
  try {
    const user = await requireApiRole(["ADMIN", "STAFF"]);
    if (user instanceof Response) {
      return user;
    }

    const { id } = await params;
    const body = await request.json();

    const validated = studentFeeUpdateSchema.parse(body);
    const updated = await StudentFeeService.updateStudentFee(id, {
      ...validated,
      status:
        validated.status && validated.status !== "OVERDUE"
          ? validated.status
          : undefined,
      dueDate: validated.dueDate ? new Date(validated.dueDate) : undefined,
    });

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error, "Failed to update student fee");
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Params }) {
  try {
    const user = await requireApiRole(["ADMIN"]);
    if (user instanceof Response) {
      return user;
    }

    const { id } = await params;
    await StudentFeeService.deleteStudentFee(id);

    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error, "Failed to delete student fee");
  }
}
