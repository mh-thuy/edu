import { prisma } from "@/lib/prisma";
import type { Prisma, Teacher } from "@prisma/client";
import type {
  TeacherCreate,
  TeacherFilter,
  TeacherUpdate,
} from "@/modules/teacher/schemas/teacher.schema";
import type { TeacherWithUser } from "@/types/prisma";

function buildTeacherCreateInput(data: TeacherCreate): Prisma.TeacherCreateInput {
  return {
    code: data.code,
    phone: data.phone || null,
    email: data.email || null,
    bankAccount: data.bankAccount || null,
    specialty: data.specialty || null,
    status: data.status,
  };
}

function buildTeacherUpdateInput(data: TeacherUpdate): Prisma.TeacherUpdateInput {
  return {
    ...(data.code !== undefined && { code: data.code }),
    ...(data.phone !== undefined && { phone: data.phone || null }),
    ...(data.email !== undefined && { email: data.email || null }),
    ...(data.bankAccount !== undefined && {
      bankAccount: data.bankAccount || null,
    }),
    ...(data.specialty !== undefined && {
      specialty: data.specialty || null,
    }),
    ...(data.status !== undefined && { status: data.status }),
  };
}

export async function createTeacher(data: TeacherCreate): Promise<Teacher> {
  return prisma.teacher.create({
    data: buildTeacherCreateInput(data),
  });
}

export async function getTeacherById(id: string): Promise<TeacherWithUser | null> {
  return prisma.teacher.findUnique({
    where: { id },
    include: { user: true },
  });
}

export async function getTeachers(filter: TeacherFilter) {
  const { search, status, page, limit } = filter;
  const skip = (page - 1) * limit;

  const where: Prisma.TeacherWhereInput = {
    ...(search && {
      OR: [
        { code: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { specialty: { contains: search, mode: "insensitive" } },
      ],
    }),
    ...(status && { status }),
  };

  const [teachers, total] = await Promise.all([
    prisma.teacher.findMany({
      where,
      skip,
      take: limit,
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

export async function updateTeacher(
  id: string,
  data: TeacherUpdate,
): Promise<Teacher> {
  return prisma.teacher.update({
    where: { id },
    data: buildTeacherUpdateInput(data),
  });
}

export async function deleteTeacher(id: string): Promise<Teacher> {
  return prisma.teacher.delete({
    where: { id },
  });
}

export async function checkTeacherScheduleConflict(
  teacherId: string,
  dayOfWeek: number,
  startTime: string,
  endTime: string,
): Promise<boolean> {
  const schedules = await prisma.classSchedule.findMany({
    where: {
      teacherId,
      dayOfWeek,
      startTime: {
        lt: endTime,
      },
      endTime: {
        gt: startTime,
      },
    },
  });

  return schedules.length > 0;
}
