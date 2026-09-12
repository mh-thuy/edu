import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess, handleApiError } from "@/lib/api";
import { requireApiUser } from "@/lib/api-auth";
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
    const user = await requireApiUser();
    if (user instanceof Response) return user;

    const routeParams = await context.params;
    if (!routeParams?.id || !routeParams.studentId) {
      return apiError("BAD_REQUEST", "Thiếu mã lớp hoặc học viên", 400);
    }
    const rawMonth = new URL(_request.url).searchParams.get("month");
    const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).safeParse(rawMonth);
    if (!month.success) {
      return apiError("VALIDATION_ERROR", "Kỳ học phí phải có định dạng YYYY-MM", 400);
    }
    const billingYear = Number(month.data.slice(0, 4));
    const billingMonth = Number(month.data.slice(5, 7));

    const fee = await TuitionService.createFromEnrollment(
      {
        classId: routeParams.id,
        studentId: routeParams.studentId,
        billingYear,
        billingMonth,
      },
      user.id,
    );
    return apiSuccess(fee, 201);
  } catch (error: unknown) {
    return handleApiError(error, "Không thể tạo học phí từ đăng ký");
  }
}
