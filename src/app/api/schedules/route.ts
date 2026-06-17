import { NextRequest, NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/errors";
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
      limit: parseInt(searchParams.get("limit") || "20"),
    });

    const result = await getSchedules(filter);
    return NextResponse.json(result);
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = classScheduleCreateSchema.parse(body);

    const { schedule } = await createClassSchedule(data);
    return NextResponse.json(
      { schedule, conflicts: null },
      { status: 201 }
    );
  } catch (error: unknown) {
    if (error instanceof ScheduleConflictError) {
      return NextResponse.json(
        {
          error: error.message,
          conflicts: error.conflicts,
        },
        { status: 409 },
      );
    }

    return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 });
  }
}
