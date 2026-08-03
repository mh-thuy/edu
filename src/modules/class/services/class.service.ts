import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError } from "@/lib/errors";
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
    tuitionFee: data.tuitionFee,
    totalSessions: data.totalSessions,
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
    ...(data.tuitionFee !== undefined && { tuitionFee: data.tuitionFee }),
    ...(data.totalSessions !== undefined && { totalSessions: data.totalSessions }),
    ...(data.startDate !== undefined && {
      startDate: data.startDate ? new Date(data.startDate) : null,
    }),
    ...(data.endDate !== undefined && {
      endDate: data.endDate ? new Date(data.endDate) : null,
    }),
    ...(data.status !== undefined && { status: data.status }),
  };
}

async function generateTuitionFeeNo(tx: Prisma.TransactionClient) {
  const prefix = `HP-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = `${prefix}-${Math.floor(100000 + Math.random() * 900000)}`;
    if (!(await tx.tuitionFee.findUnique({ where: { feeNo: candidate }, select: { id: true } }))) return candidate;
  }
  throw new ConflictError("Không thể tạo mã học phí tự động, vui lòng thử lại");
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
        _count: { select: { students: true, schedules: true } },
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
        _count: { select: { students: true, schedules: true } },
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
  const current = await prisma.class.findUnique({
    where: { id },
    select: {
      status: true,
    },
  });

  if (!current) {
    throw new NotFoundError("Không tìm thấy lớp học");
  }

  if (data.status !== undefined && data.status !== current.status) {
    const allowedTransitions: Record<Class["status"], Class["status"][]> = {
      DRAFT: ["ACTIVE", "CANCELLED"],
      ACTIVE: ["COMPLETED", "CANCELLED"],
      COMPLETED: [],
      CANCELLED: [],
    };

    if (!allowedTransitions[current.status].includes(data.status)) {
      throw new ConflictError("Trạng thái lớp học không hợp lệ");
    }
  }

  return prisma.class.update({
    where: { id },
    data: buildClassUpdateInput(data),
  });
}

export async function deleteClass(id: string): Promise<Class> {
  const classData = await prisma.class.findUnique({
    where: { id },
    select: {
      tuitionFees: {
        take: 1,
      },
    },
  });

  if (!classData) {
    throw new NotFoundError("Không tìm thấy lớp học");
  }

  if (classData.tuitionFees.length > 0) {
    throw new ConflictError(
      "Không thể xóa lớp học đã phát sinh học phí",
    );
  }

  return prisma.class.delete({
    where: { id },
  });
}

export async function assignStudentToClass(
  classId: string,
  studentId: string,
  actorId?: string,
): Promise<ClassStudentWithRelations> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.classStudent.findUnique({
      where: { classId_studentId: { classId, studentId } },
      include: { student: true, class: true },
    });

    if (existing) {
      const existingFee = await tx.tuitionFee.findFirst({ where: { enrollmentId: existing.id }, select: { id: true } });
      if (!existingFee) {
        const feeNo = await generateTuitionFeeNo(tx);
        const tuitionAmount = existing.class.tuitionFee;
        await tx.tuitionFee.create({
          data: {
            feeNo,
            studentId,
            enrollmentId: existing.id,
            classId,
            originalAmount: tuitionAmount,
            discountAmount: 0,
            additionalAmount: 0,
            finalAmount: tuitionAmount,
            dueDate: existing.class.endDate,
            createdBy: actorId || studentId,
            updatedBy: actorId || studentId,
            items: { create: { itemType: "TUITION", itemName: `Học phí lớp ${existing.class.name}`, quantity: 1, unitPrice: tuitionAmount, amount: tuitionAmount, displayOrder: 0 } },
          },
        });
      }
      return existing;
    }

    const classData = await tx.class.findUnique({ where: { id: classId } });
    if (!classData) throw new NotFoundError("Không tìm thấy lớp học");
    const student = await tx.student.findUnique({ where: { id: studentId } });
    if (!student) throw new NotFoundError("Không tìm thấy học viên");

    const enrollment = await tx.classStudent.create({
      data: { classId, studentId },
      include: { student: true, class: true },
    });
    const feeNo = await generateTuitionFeeNo(tx);
    const tuitionAmount = classData.tuitionFee;
    await tx.tuitionFee.create({
      data: {
        feeNo,
        studentId,
        enrollmentId: enrollment.id,
        classId,
        originalAmount: tuitionAmount,
        discountAmount: 0,
        additionalAmount: 0,
        finalAmount: tuitionAmount,
        dueDate: classData.endDate,
        createdBy: actorId || studentId,
        updatedBy: actorId || studentId,
        items: {
          create: {
            itemType: "TUITION",
            itemName: `Học phí lớp ${classData.name}`,
            quantity: 1,
            unitPrice: tuitionAmount,
            amount: tuitionAmount,
            displayOrder: 0,
          },
        },
      },
    });
    return enrollment;
  });
}

export async function removeStudentFromClass(
  classId: string,
  studentId: string,
  options?: { force?: boolean; isAdmin?: boolean },
): Promise<void> {
  const hasTuitionFees = await prisma.tuitionFee.count({ where: { classId, studentId } });

  if (
    hasTuitionFees > 0 &&
    !(options?.force === true && options?.isAdmin === true)
  ) {
    throw new ConflictError(
      "Cannot remove student from class with existing tuition fees",
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
