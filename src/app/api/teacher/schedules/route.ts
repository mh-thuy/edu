import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api";
import { requireApiRole } from "@/lib/api-auth";
import { scheduleFilterSchema } from "@/modules/schedule/schemas/schedule.schema";
import { getSchedulesByTeacherUserId } from "@/modules/schedule/services/schedule.service";

export async function GET(request: NextRequest) {
  try {
    const user = await requireApiRole(["TEACHER"]);
    if (user instanceof Response) {
      return user;
    }

    const searchParams = request.nextUrl.searchParams;
    const filter = scheduleFilterSchema.parse({
      classId: searchParams.get("classId") || undefined,
      dayOfWeek: searchParams.get("dayOfWeek")
        ? parseInt(searchParams.get("dayOfWeek") || "0")
        : undefined,
      page: parseInt(searchParams.get("page") || "1"),
      pageSize: parseInt(searchParams.get("pageSize") || "20"),
    });

    const result = await getSchedulesByTeacherUserId(user.id, filter);
    return apiSuccess(result);
  } catch (error: unknown) {
    return handleApiError(error, "Failed to fetch teacher schedules");
  }
}
