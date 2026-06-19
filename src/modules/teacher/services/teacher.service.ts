import { prisma } from "@/lib/prisma";
import { ConflictError } from "@/lib/errors";
import type { Prisma, Teacher } from "@prisma/client";
import type {
  TeacherCreate,
  TeacherFilter,
  TeacherUpdate,
} from "@/modules/teacher/schemas/teacher.schema";
import type { TeacherWithUser } from "@/types/prisma";

function buildTeacherCreateInput(
  data: TeacherCreate,
): Prisma.TeacherCreateInput {
  return {
    fullName: data.fullName,
    code: data.code,
    phone: data.phone || null,
    email: data.email || null,
    bankAccount: data.bankAccount || null,
    specialty: data.specialty || null,
    status: data.status,
  };
}

function buildTeacherUpdateInput(
  data: TeacherUpdate,
): Prisma.TeacherUpdateInput {
  return {
    ...(data.fullName !== undefined && { fullName: data.fullName }),
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

export async function getTeacherById(
  id: string,
): Promise<TeacherWithUser | null> {
  return prisma.teacher.findUnique({
    where: { id },
    include: { user: true },
  });
}

export async function getTeachers(filter: TeacherFilter) {
  const { search, status, page, pageSize } = filter;
  const skip = (page - 1) * pageSize;

  const where: Prisma.TeacherWhereInput = {
    ...(search && {
      OR: [
        { code: { contains: search, mode: "insensitive" } },
        { user: { fullName: { contains: search, mode: "insensitive" } } },
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
      include: {
        user: {
          select: {
            fullName: true,
          },
        },
      },
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
    }),
    prisma.teacher.count({ where }),
  ]);

  return {
    teachers,
    total,
    page,
    pageSize,
    pages: Math.ceil(total / pageSize),
  };
}

export async function updateTeacher(
  id: string,
  data: TeacherUpdate,
): Promise<Teacher> {
  const currentTeacher = await prisma.teacher.findUnique({
    where: { id },
    select: {
      email: true,
      userId: true,
    },
  });

  if (!currentTeacher) {
    throw new Error("Teacher not found");
  }

  if (
    currentTeacher.userId &&
    data.email !== undefined &&
    data.email !== currentTeacher.email
  ) {
    throw new ConflictError(
      "Cannot update teacher email separately when teacher is linked to a user",
    );
  }

  return prisma.teacher.update({
    where: { id },
    data: buildTeacherUpdateInput(data),
  });
}

export async function deleteTeacher(id: string): Promise<Teacher> {
  const teacher = await prisma.teacher.findUnique({
    where: { id },
    select: {
      _count: {
        select: {
          classes: true,
          payrolls: true,
        },
      },
    },
  });

  if (!teacher) {
    throw new Error("Teacher not found");
  }

  if (teacher._count.classes > 0) {
    throw new ConflictError("Cannot delete teacher with class assignments");
  }

  if (teacher._count.payrolls > 0) {
    throw new ConflictError("Cannot delete teacher with payroll records");
  }

  return prisma.teacher.delete({
    where: { id },
  });
}

export async function checkTeacherScheduleConflict(
  teacherId: string,
  dayOfWeek: number,
  startMinute: number,
  endMinute: number,
): Promise<boolean> {
  const schedules = await prisma.classSchedule.findMany({
    where: {
      teacherId,
      dayOfWeek,
      startMinute: {
        lt: endMinute,
      },
      endMinute: {
        gt: startMinute,
      },
    },
  });

  return schedules.length > 0;
}
