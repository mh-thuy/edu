import { NextRequest } from "next/server";
import { apiError, apiSuccess, handleApiError } from "@/lib/api";
import { classScheduleCreateSchema, scheduleFilterSchema } from "@/modules/schedule/schemas/schedule.schema";
import {
  createClassSchedule,
  getSchedules,
  ScheduleConflictError,
} from "@/modules/schedule/services/schedule.service";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const filter = scheduleFilterSchema.parse({
      classId: searchParams.get("classId") || undefined,
      dayOfWeek: searchParams.get("dayOfWeek") ? parseInt(searchParams.get("dayOfWeek")!) : undefined,
      page: parseInt(searchParams.get("page") || "1"),
      pageSize: parseInt(searchParams.get("pageSize") || "20"),
    });

    const result = await getSchedules(filter);
    return apiSuccess(result);
  } catch (error: unknown) {
    return handleApiError(error, "Failed to fetch schedules");
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = classScheduleCreateSchema.parse(body);

    const { schedule } = await createClassSchedule(data);
    return apiSuccess({ schedule, conflicts: null }, 201);
  } catch (error: unknown) {
    if (error instanceof ScheduleConflictError) {
      return apiError(
        "CONFLICT",
        error.message,
        409,
        { conflicts: error.conflicts },
      );
    }

    return handleApiError(error, "Failed to create schedule");
  }
}
