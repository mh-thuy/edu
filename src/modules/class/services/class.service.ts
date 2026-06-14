/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma";
import type { Class } from "@prisma/client";
import type {
  ClassCreate,
  ClassFilter,
  ClassUpdate,
} from "@/modules/class/schemas/class.schema";

export async function createClass(data: ClassCreate): Promise<Class> {
  return prisma.class.create({
    data,
  });
}

export async function getClassById(id: string): Promise<any> {
  return prisma.class.findUnique({
    where: { id },
    include: {
      teacher: { include: { user: true } },
      room: true,
      classStudents: { include: { student: true } },
      classSchedules: true,
    },
  });
}

export async function getClasses(filter: ClassFilter) {
  const { search, status, page, limit } = filter;
  const skip = (page - 1) * limit;

  const where: any = {};
  if (search) {
    where.OR = [
      { code: { contains: search, mode: "insensitive" } },
      { name: { contains: search, mode: "insensitive" } },
    ];
  }
  if (status) {
    where.status = status;
  }

  const [classes, total] = await Promise.all([
    prisma.class.findMany({
      where,
      skip,
      take: limit,
      include: {
        teacher: { include: { user: true } },
        room: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.class.count({ where }),
  ]);

  return {
    items: classes,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  };
}

export async function updateClass(
  id: string,
  data: ClassUpdate,
): Promise<Class> {
  return prisma.class.update({
    where: { id },
    data,
  });
}

export async function deleteClass(id: string): Promise<Class> {
  return prisma.class.delete({
    where: { id },
  });
}

export async function assignStudentToClass(
  classId: string,
  studentId: string,
): Promise<any> {
  return prisma.classStudent.upsert({
    where: { classId_studentId: { classId, studentId } },
    create: { classId, studentId },
    update: {},
    include: { student: true, class: true },
  });
}

export async function removeStudentFromClass(
  classId: string,
  studentId: string,
): Promise<void> {
  await prisma.classStudent.delete({
    where: { classId_studentId: { classId, studentId } },
  });
}

export async function getClassStudents(classId: string): Promise<any> {
  return prisma.classStudent.findMany({
    where: { classId },
    include: { student: true },
  });
}
