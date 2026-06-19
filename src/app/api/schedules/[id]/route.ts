import { NextRequest } from "next/server";
import { classScheduleUpdateSchema } from "@/modules/schedule/schemas/schedule.schema";
import { apiError, apiSuccess, handleApiError } from "@/lib/api";
import {
  getClassScheduleById,
  updateClassSchedule,
  deleteClassSchedule,
  ScheduleConflictError,
} from "@/modules/schedule/services/schedule.service";

type Params = Promise<{
  id: string;
}>;

export async function GET(
  request: NextRequest,
  { params }: { params: Params },
) {
  try {
    const { id } = await params;
    const schedule = await getClassScheduleById(id);
    if (!schedule) {
      return apiError("NOT_FOUND", "Schedule not found", 404);
    }
    return apiSuccess(schedule);
  } catch (error: unknown) {
    return handleApiError(error, "Failed to fetch schedule");
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Params },
) {
  try {
    const { id } = await params;
    const existingSchedule = await getClassScheduleById(id);
    if (!existingSchedule) {
      return apiError("NOT_FOUND", "Không tìm thấy lịch học", 404);
    }

    const body = await request.json();
    const data = classScheduleUpdateSchema.parse(body);

    const { schedule } = await updateClassSchedule(id, data);
    return apiSuccess(schedule);
  } catch (error: unknown) {
    if (error instanceof ScheduleConflictError) {
      return apiError("CONFLICT", error.message, 409, {
        conflicts: error.conflicts,
      });
    }

    return handleApiError(error, "Failed to update schedule");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Params },
) {
  try {
    const { id } = await params;
    const schedule = await deleteClassSchedule(id);
    return apiSuccess(schedule);
  } catch (error: unknown) {
    return handleApiError(error, "Failed to delete schedule");
  }
}
