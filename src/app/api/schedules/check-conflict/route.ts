import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, handleApiError } from "@/lib/api";
import { getScheduleConflicts } from "@/modules/schedule/services/schedule.service";

const checkScheduleConflictSchema = z
  .object({
    roomId: z.string().min(1, "roomId is invalid").optional(),
    teacherId: z.string().min(1, "teacherId is invalid").optional(),
    dayOfWeek: z.number().int().min(0).max(6),
    startMinute: z.number().int().min(0).max(1439),
    endMinute: z.number().int().min(0).max(1439),
    excludeScheduleId: z.string().optional(),
  })
  .refine((data) => Boolean(data.roomId || data.teacherId), {
    message: "roomId hoặc teacherId là bắt buộc",
    path: ["roomId"],
  })
  .refine((data) => data.startMinute < data.endMinute, {
    message: "endMinute must be greater than startMinute",
    path: ["endMinute"],
  });

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();

    const data = checkScheduleConflictSchema.parse(body);

    const conflicts = await getScheduleConflicts(
      {
        roomId: data.roomId,
        teacherId: data.teacherId,
        dayOfWeek: data.dayOfWeek,
        startMinute: data.startMinute,
        endMinute: data.endMinute,
      },
      data.excludeScheduleId,
    );

    return apiSuccess({
      hasConflict: conflicts.length > 0,
      conflicts,
    });
  } catch (error: unknown) {
    return handleApiError(error, "Failed to check schedule conflict");
  }
}
