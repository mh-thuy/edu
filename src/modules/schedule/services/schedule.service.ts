/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma";
import type { ClassSchedule } from "@prisma/client";
import type { ClassScheduleCreate, ClassScheduleUpdate, ScheduleFilter } from "@/modules/schedule/schemas/schedule.schema";

function timeToMinutes(time: string): number {
  const parts = time.split(":");
  const hours = Number(parts[0]) || 0;
  const minutes = Number(parts[1]) || 0;
  return hours * 60 + minutes;
}

function hasTimeConflict(startTime1: string, endTime1: string, startTime2: string, endTime2: string): boolean {
  const start1 = timeToMinutes(startTime1);
  const end1 = timeToMinutes(endTime1);
  const start2 = timeToMinutes(startTime2);
  const end2 = timeToMinutes(endTime2);

  return start1 < end2 && start2 < end1;
}

export async function createClassSchedule(data: ClassScheduleCreate): Promise<{ schedule: ClassSchedule; conflicts: any[] }> {
  // Check room conflict
  const roomConflicts = data.roomId
    ? await prisma.classSchedule.findMany({
        where: {
          roomId: data.roomId,
          dayOfWeek: data.dayOfWeek,
        },
        include: { class: true, room: true },
      })
    : [];

  // Check teacher conflict
  let teacherConflicts: any[] = [];
  if (data.teacherId) {
    const allSchedules = await prisma.classSchedule.findMany({
      where: {
        dayOfWeek: data.dayOfWeek,
      },
    });
    // Filter by teacherId in memory
    teacherConflicts = allSchedules.filter((s: any) => s.teacherId === data.teacherId);
  }

  const allConflicts = [
    ...roomConflicts.filter((s) => hasTimeConflict(data.startTime, data.endTime, s.startTime, s.endTime)),
    ...teacherConflicts.filter((s) => hasTimeConflict(data.startTime, data.endTime, s.startTime, s.endTime)),
  ];

  const schedule = await prisma.classSchedule.create({
    data,
    include: { class: true, room: true },
  });

  return { schedule, conflicts: allConflicts };
}

export async function getClassScheduleById(id: string): Promise<any> {
  return prisma.classSchedule.findUnique({
    where: { id },
    include: { class: true, room: true },
  });
}

export async function getSchedules(filter: ScheduleFilter) {
  const { classId, dayOfWeek, page, limit } = filter;
  const skip = (page - 1) * limit;

  const where: any = {};
  if (classId) where.classId = classId;
  if (dayOfWeek !== undefined) where.dayOfWeek = dayOfWeek;

  const [schedules, total] = await Promise.all([
    prisma.classSchedule.findMany({
      where,
      skip,
      take: limit,
      include: { class: true, room: true },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    }),
    prisma.classSchedule.count({ where }),
  ]);

  return {
    schedules,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  };
}

export async function updateClassSchedule(id: string, data: ClassScheduleUpdate): Promise<ClassSchedule> {
  return prisma.classSchedule.update({
    where: { id },
    data,
  });
}

export async function deleteClassSchedule(id: string): Promise<ClassSchedule> {
  return prisma.classSchedule.delete({
    where: { id },
  });
}

export async function getWeeklySchedule(startDate: Date): Promise<any> {
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 7);

  return prisma.classSchedule.findMany({
    where: {
      class: {
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
    },
    include: { class: true, room: true },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });
}
