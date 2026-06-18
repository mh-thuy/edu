import { prisma } from "@/lib/prisma";
import type { ClassSchedule, Prisma } from "@prisma/client";
import type {
  ClassScheduleCreate,
  ClassScheduleUpdate,
  ScheduleFilter,
} from "@/modules/schedule/schemas/schedule.schema";

type ClassScheduleWithRelations = Prisma.ClassScheduleGetPayload<{
  include: {
    class: true;
    room: true;
    teacher: true;
  };
}>;

type ScheduleConflict = ClassScheduleWithRelations;

export class ScheduleConflictError extends Error {
  conflicts: ScheduleConflict[];

  constructor(conflicts: ScheduleConflict[]) {
    super("Phát hiện lịch học bị trùng");
    this.name = "ScheduleConflictError";
    this.conflicts = conflicts;
  }
}

function timeToMinutes(time: string): number {
  const [hours = "0", minutes = "0"] = time.split(":");
  return Number(hours) * 60 + Number(minutes);
}

function hasTimeConflict(
  startTime1: string,
  endTime1: string,
  startTime2: string,
  endTime2: string,
): boolean {
  const start1 = timeToMinutes(startTime1);
  const end1 = timeToMinutes(endTime1);
  const start2 = timeToMinutes(startTime2);
  const end2 = timeToMinutes(endTime2);

  return start1 < end2 && start2 < end1;
}

function toClassScheduleCreateInput(
  data: ClassScheduleCreate,
): Prisma.ClassScheduleUncheckedCreateInput {
  return {
    classId: data.classId,
    roomId: data.roomId || null,
    teacherId: data.teacherId || null,
    dayOfWeek: data.dayOfWeek,
    startTime: data.startTime,
    endTime: data.endTime,
  };
}

function toClassScheduleUpdateInput(
  data: ClassScheduleUpdate,
): Prisma.ClassScheduleUncheckedUpdateInput {
  return {
    ...(data.classId !== undefined && { classId: data.classId }),
    ...(data.roomId !== undefined && { roomId: data.roomId || null }),
    ...(data.teacherId !== undefined && { teacherId: data.teacherId || null }),
    ...(data.dayOfWeek !== undefined && { dayOfWeek: data.dayOfWeek }),
    ...(data.startTime !== undefined && { startTime: data.startTime }),
    ...(data.endTime !== undefined && { endTime: data.endTime }),
  };
}

export async function getScheduleConflicts(
  data: {
    roomId?: string | null;
    teacherId?: string | null;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  },
  excludeId?: string,
): Promise<ScheduleConflict[]> {
  const where: Prisma.ClassScheduleWhereInput = {
    dayOfWeek: data.dayOfWeek,
    ...(excludeId && {
      id: {
        not: excludeId,
      },
    }),
    OR: [
      ...(data.roomId ? [{ roomId: data.roomId }] : []),
      ...(data.teacherId ? [{ teacherId: data.teacherId }] : []),
    ],
  };

  if (!where.OR?.length) return [];

  const schedules = await prisma.classSchedule.findMany({
    where,
    include: {
      class: true,
      room: true,
      teacher: true,
    },
  });

  return schedules.filter((schedule) =>
    hasTimeConflict(
      data.startTime,
      data.endTime,
      schedule.startTime,
      schedule.endTime,
    ),
  );
}

export async function createClassSchedule(data: ClassScheduleCreate): Promise<{
  schedule: ClassScheduleWithRelations;
  conflicts: ScheduleConflict[];
}> {
  const conflicts = await getScheduleConflicts(data);
  if (conflicts.length > 0) {
    throw new ScheduleConflictError(conflicts);
  }

  const schedule = await prisma.classSchedule.create({
    data: toClassScheduleCreateInput(data),
    include: {
      class: true,
      room: true,
      teacher: true,
    },
  });

  return {
    schedule,
    conflicts,
  };
}

export async function getClassScheduleById(
  id: string,
): Promise<ClassScheduleWithRelations | null> {
  return prisma.classSchedule.findUnique({
    where: { id },
    include: {
      class: true,
      room: true,
      teacher: true,
    },
  });
}

export async function getSchedules(filter: ScheduleFilter) {
  const page = Math.max(filter.page ?? 1, 1);
  const pageSize = Math.max(filter.pageSize ?? 10, 1);
  const skip = (page - 1) * pageSize;

  const where: Prisma.ClassScheduleWhereInput = {
    ...(filter.classId && { classId: filter.classId }),
    ...(filter.dayOfWeek !== undefined && { dayOfWeek: filter.dayOfWeek }),
  };

  const [schedules, total] = await Promise.all([
    prisma.classSchedule.findMany({
      where,
      skip,
      take: pageSize,
      include: {
        class: true,
        room: true,
        teacher: true,
      },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    }),
    prisma.classSchedule.count({ where }),
  ]);

  return {
    items: schedules,
    total,
    page,
    pageSize,
    pages: Math.ceil(total / pageSize),
  };
}

export async function getSchedulesByTeacherUserId(
  userId: string,
  filter: ScheduleFilter,
) {
  const page = Math.max(filter.page ?? 1, 1);
  const pageSize = Math.max(filter.pageSize ?? 10, 1);
  const skip = (page - 1) * pageSize;

  const where: Prisma.ClassScheduleWhereInput = {
    teacher: {
      userId,
    },
    ...(filter.classId && { classId: filter.classId }),
    ...(filter.dayOfWeek !== undefined && { dayOfWeek: filter.dayOfWeek }),
  };

  const [schedules, total] = await Promise.all([
    prisma.classSchedule.findMany({
      where,
      skip,
      take: pageSize,
      include: {
        class: true,
        room: true,
        teacher: true,
      },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    }),
    prisma.classSchedule.count({ where }),
  ]);

  return {
    items: schedules,
    total,
    page,
    pageSize,
    pages: Math.ceil(total / pageSize),
  };
}

export async function updateClassSchedule(
  id: string,
  data: ClassScheduleUpdate,
): Promise<{
  schedule: ClassScheduleWithRelations;
  conflicts: ScheduleConflict[];
}> {
  const current = await prisma.classSchedule.findUnique({
    where: { id },
  });

  if (!current) {
    throw new Error("Schedule not found");
  }

  const merged = {
    classId: data.classId ?? current.classId,
    roomId: data.roomId !== undefined ? data.roomId || null : current.roomId,
    teacherId:
      data.teacherId !== undefined ? data.teacherId || null : current.teacherId,
    dayOfWeek: data.dayOfWeek ?? current.dayOfWeek,
    startTime: data.startTime ?? current.startTime,
    endTime: data.endTime ?? current.endTime,
  };

  const conflicts = await getScheduleConflicts(merged, id);
  if (conflicts.length > 0) {
    throw new ScheduleConflictError(conflicts);
  }

  const schedule = await prisma.classSchedule.update({
    where: { id },
    data: toClassScheduleUpdateInput(data),
    include: {
      class: true,
      room: true,
      teacher: true,
    },
  });

  return {
    schedule,
    conflicts,
  };
}

export async function deleteClassSchedule(id: string): Promise<ClassSchedule> {
  return prisma.classSchedule.delete({
    where: { id },
  });
}

export async function getWeeklySchedule(
  startDate: Date,
): Promise<ClassScheduleWithRelations[]> {
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 7);

  return prisma.classSchedule.findMany({
    where: {
      class: {
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
    },
    include: {
      class: true,
      room: true,
      teacher: true,
    },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });
}
