import { NextRequest } from "next/server";
import { apiError, apiSuccess, handleApiError } from "@/lib/api";
import { requireApiRole } from "@/lib/api-auth";
import { TuitionService } from "@/modules/finance/tuition/services/tuition.service";

type Params = Promise<{
  id: string;
  studentId: string;
}>;

export async function POST(
  _request: NextRequest,
  context: { params?: Params },
) {
  try {
    const user = await requireApiRole(["ADMIN", "STAFF"]);
    if (user instanceof Response) return user;

    const routeParams = await context.params;
    if (!routeParams?.id || !routeParams.studentId) {
      return apiError("BAD_REQUEST", "Thiếu mã lớp hoặc học viên", 400);
    }

    const fee = await TuitionService.createFromEnrollment(
      { classId: routeParams.id, studentId: routeParams.studentId },
      user.id,
    );
    return apiSuccess(fee, 201);
  } catch (error: unknown) {
    return handleApiError(error, "Không thể tạo học phí từ đăng ký");
  }
}
