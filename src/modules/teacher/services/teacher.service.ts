/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma";
import type { Teacher } from "@prisma/client";
import type { TeacherCreate, TeacherFilter, TeacherUpdate } from "@/modules/teacher/schemas/teacher.schema";

export async function createTeacher(data: TeacherCreate): Promise<Teacher> {
  return prisma.teacher.create({
    data: data as any,
  });
}

export async function getTeacherById(id: string): Promise<any> {
  return prisma.teacher.findUnique({
    where: { id },
    include: { user: true, classes: true },
  });
}

export async function getTeachers(filter: TeacherFilter) {
  const { search, status, page, limit } = filter;
  const skip = (page - 1) * limit;

  const where: any = {};
  if (search) {
    where.OR = [
      { code: { contains: search, mode: "insensitive" } },
      { user: { fullName: { contains: search, mode: "insensitive" } } },
    ];
  }
  if (status) {
    where.status = status;
  }

  const [teachers, total] = await Promise.all([
    prisma.teacher.findMany({
      where,
      skip,
      take: limit,
      include: { user: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.teacher.count({ where }),
  ]);

  return {
    teachers,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  };
}

export async function updateTeacher(id: string, data: TeacherUpdate): Promise<Teacher> {
  return prisma.teacher.update({
    where: { id },
    data,
    include: { user: true },
  });
}

export async function deleteTeacher(id: string): Promise<Teacher> {
  return prisma.teacher.delete({
    where: { id },
  });
}

export async function checkTeacherScheduleConflict(teacherId: string, dayOfWeek: number, startTime: string, endTime: string): Promise<boolean> {
  // Check for schedule conflicts
  const schedules = await prisma.classSchedule.findMany({
    where: {
      dayOfWeek,
    },
  });

  const conflict = schedules.find((s: any) => {
    if (s.teacherId !== teacherId) return false;
    // Check time overlap
    return (
      (s.startTime <= startTime && s.endTime > startTime) ||
      (s.startTime < endTime && s.endTime >= endTime)
    );
  });

  return !!conflict;
}
