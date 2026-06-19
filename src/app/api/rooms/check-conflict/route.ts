import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess, handleApiError } from "@/lib/api";
import { checkRoomConflict } from "@/modules/room/services/room.service";

const checkRoomConflictSchema = z.object({
  roomId: z.string().min(1, "roomId is required"),
  dayOfWeek: z.number().int().min(0).max(6),
  startMinute: z.number().int().min(0).max(1439),
  endMinute: z.number().int().min(0).max(1439),
  excludeScheduleId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = checkRoomConflictSchema.parse(body);

    const hasConflict = await checkRoomConflict(
      data.roomId,
      data.dayOfWeek,
      data.startMinute,
      data.endMinute,
      data.excludeScheduleId,
    );

    return apiSuccess({ hasConflict });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(
        "VALIDATION_ERROR",
        "Validation failed",
        422,
        error.flatten(),
      );
    }
    return handleApiError(error, "Failed to check room conflict");
  }
}
