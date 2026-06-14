/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { classScheduleUpdateSchema } from "@/modules/schedule/schemas/schedule.schema";
import {
  getClassScheduleById,
  updateClassSchedule,
  deleteClassSchedule,
} from "@/modules/schedule/services/schedule.service";
import { prisma } from "@/lib/prisma";

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
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
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

    await updateClassSchedule(id, data);
    // Return with relations
    const schedule = await prisma.classSchedule.findUnique({
      where: { id },
      include: { class: true, room: true },
    });
    return NextResponse.json(schedule);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Params },
) {
  try {
    const { id } = await params;
    const schedule = await deleteClassSchedule(id);
    return NextResponse.json(schedule);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
