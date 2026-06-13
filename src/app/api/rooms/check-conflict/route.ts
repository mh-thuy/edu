/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { checkRoomConflict } from "@/modules/room/services/room.service";

export async function POST(request: NextRequest) {
  try {
    const { roomId, dayOfWeek, startTime, endTime } = await request.json();

    const hasConflict = await checkRoomConflict(roomId, dayOfWeek, startTime, endTime);
    return NextResponse.json({ hasConflict });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
