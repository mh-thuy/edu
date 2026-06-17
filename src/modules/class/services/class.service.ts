import { prisma } from "@/lib/prisma";
import type { Class, Prisma } from "@prisma/client";
import type {
  ClassCreate,
  ClassFilter,
  ClassUpdate,
} from "@/modules/class/schemas/class.schema";
import type {
  ClassListItem,
  ClassStudentWithRelations,
  ClassStudentWithStudent,
  ClassWithRelations,
} from "@/types/prisma";

function toNullableString(value?: string | null): string | null | undefined {
  if (value === undefined) return undefined;
  return value || null;
}

function toNullableDate(value?: string): Date | undefined {
  return value ? new Date(value) : undefined;
}

function buildClassCreateInput(data: ClassCreate): Prisma.ClassUncheckedCreateInput {
  return {
    code: data.code,
    name: data.name,
    teacherId: toNullableString(data.teacherId),
    roomId: toNullableString(data.roomId),
    tuitionFee: data.tuitionFee,
    totalSessions: data.totalSessions,
    maxStudents: data.maxStudents,
    startDate: toNullableDate(data.startDate),
    endDate: toNullableDate(data.endDate),
    status: data.status,
  };
}

function buildClassUpdateInput(data: ClassUpdate): Prisma.ClassUncheckedUpdateInput {
  return {
    ...(data.code !== undefined && { code: data.code }),
    ...(data.name !== undefined && { name: data.name }),
    ...(data.teacherId !== undefined && {
      teacherId: toNullableString(data.teacherId),
    }),
    ...(data.roomId !== undefined && {
      roomId: toNullableString(data.roomId),
    }),
    ...(data.tuitionFee !== undefined && { tuitionFee: data.tuitionFee }),
    ...(data.totalSessions !== undefined && { totalSessions: data.totalSessions }),
    ...(data.maxStudents !== undefined && { maxStudents: data.maxStudents }),
    ...(data.startDate !== undefined && {
      startDate: data.startDate ? new Date(data.startDate) : null,
    }),
    ...(data.endDate !== undefined && {
      endDate: data.endDate ? new Date(data.endDate) : null,
    }),
    ...(data.status !== undefined && { status: data.status }),
  };
}

export async function createClass(data: ClassCreate): Promise<Class> {
  return prisma.class.create({
    data: buildClassCreateInput(data),
  });
}

export async function getClassById(id: string): Promise<ClassWithRelations | null> {
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

  const where: Prisma.ClassWhereInput = {
    ...(search && {
      OR: [
        { code: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
      ],
    }),
    ...(status && { status }),
  };

  const [classes, total]: [ClassListItem[], number] = await Promise.all([
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
    data: buildClassUpdateInput(data),
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
): Promise<ClassStudentWithRelations> {
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

export async function getClassStudents(
  classId: string,
): Promise<ClassStudentWithStudent[]> {
  return prisma.classStudent.findMany({
    where: { classId },
    include: { student: true },
  });
}
