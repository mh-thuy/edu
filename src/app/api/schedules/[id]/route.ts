import { NextRequest, NextResponse } from "next/server";
import { classScheduleUpdateSchema } from "@/modules/schedule/schemas/schedule.schema";
import { getErrorMessage } from "@/lib/errors";
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
      return NextResponse.json(
        { error: "Schedule not found" },
        { status: 404 },
      );
    }
    return NextResponse.json(schedule);
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Params },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const data = classScheduleUpdateSchema.parse(body);

    const { schedule } = await updateClassSchedule(id, data);
    return NextResponse.json({ schedule, conflicts: null });
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

export const PATCH = PUT;

export async function DELETE(
  request: NextRequest,
  { params }: { params: Params },
) {
  try {
    const { id } = await params;
    const schedule = await deleteClassSchedule(id);
    return NextResponse.json(schedule);
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 });
  }
}
