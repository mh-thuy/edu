import { prisma } from "@/lib/prisma";
import { ConflictError } from "@/lib/errors";
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
      students: { include: { student: true } },
      schedules: true,
    },
  });
}

export async function getClasses(filter: ClassFilter) {
  const { search, status, page, pageSize } = filter;
  const skip = (page - 1) * pageSize;

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
      take: pageSize,
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
    pageSize,
    pages: Math.ceil(total / pageSize),
  };
}

export async function getClassesByTeacherUserId(
  userId: string,
  filter: ClassFilter,
) {
  const { search, status, page, pageSize } = filter;
  const skip = (page - 1) * pageSize;

  const where: Prisma.ClassWhereInput = {
    teacher: {
      userId,
    },
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
      take: pageSize,
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
    pageSize,
    pages: Math.ceil(total / pageSize),
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
  const classData = await prisma.class.findUnique({
    where: { id },
    select: {
      fees: {
        where: {
          payments: {
            some: {},
          },
        },
        select: {
          id: true,
            payments: {
              select: {
                receipt: {
                  select: {
                    id: true,
                  },
              },
            },
            take: 1,
          },
        },
        take: 1,
      },
    },
  });

  if (!classData) {
    throw new Error("Class not found");
  }

  if (classData.fees.length > 0) {
    throw new ConflictError(
      "Cannot delete class with student fees that already have payments or receipts",
    );
  }

  return prisma.class.delete({
    where: { id },
  });
}

export async function assignStudentToClass(
  classId: string,
  studentId: string,
): Promise<ClassStudentWithRelations> {
  const existing = await prisma.classStudent.findUnique({
    where: { classId_studentId: { classId, studentId } },
    include: { student: true, class: true },
  });

  if (existing) {
    return existing;
  }

  const classData = await prisma.class.findUnique({
    where: { id: classId },
    select: {
      maxStudents: true,
      _count: {
        select: {
          students: true,
        },
      },
    },
  });

  if (!classData) {
    throw new Error("Class not found");
  }

  if (classData._count.students >= classData.maxStudents) {
    throw new ConflictError("Cannot enroll student: class is full");
  }

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
  options?: { force?: boolean; isAdmin?: boolean },
): Promise<void> {
  const hasStudentFees = await prisma.studentFee.count({
    where: { classId, studentId },
  });

  if (
    hasStudentFees > 0 &&
    !(options?.force === true && options?.isAdmin === true)
  ) {
    throw new ConflictError(
      "Cannot remove student from class with existing student fees",
    );
  }

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
