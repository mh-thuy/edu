import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getErrorMessage } from "@/lib/errors";
import { getScheduleConflicts } from "@/modules/schedule/services/schedule.service";

const checkScheduleConflictSchema = z
  .object({
    roomId: z.string().min(1, "roomId is required"),
    teacherId: z.string().optional(),
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, "startTime is invalid"),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, "endTime is invalid"),
    excludeScheduleId: z.string().optional(),
  })
  .refine((data) => data.startTime < data.endTime, {
    message: "endTime must be greater than startTime",
    path: ["endTime"],
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
        startTime: data.startTime,
        endTime: data.endTime,
      },
      data.excludeScheduleId,
    );

    return NextResponse.json({
      hasConflict: conflicts.length > 0,
      conflicts,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Failed to check schedule conflict") },
      { status: 400 },
    );
  }
}
