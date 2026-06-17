import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { checkRoomConflict } from "@/modules/room/services/room.service";

const checkRoomConflictSchema = z.object({
  roomId: z.string().min(1, "roomId is required"),
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "startTime is invalid"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "endTime is invalid"),
  excludeScheduleId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = checkRoomConflictSchema.parse(body);

    const hasConflict = await checkRoomConflict(
      data.roomId,
      data.dayOfWeek,
      data.startTime,
      data.endTime,
      data.excludeScheduleId,
    );

    return NextResponse.json({ hasConflict });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Invalid request body",
          details: error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
