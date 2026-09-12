import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError } from "@/lib/errors";
import type { Prisma, Teacher } from "@prisma/client";
import type {
  TeacherCreate,
  TeacherFilter,
  TeacherUpdate,
} from "@/modules/teacher/schemas/teacher.schema";

function buildTeacherCreateInput(
  data: TeacherCreate,
): Prisma.TeacherCreateInput {
  return {
    fullName: data.fullName,
    code: "",
    phone: data.phone || null,
    bankAccount: data.bankAccount || null,
    specialty: data.specialty || null,
    commissionPercent: data.commissionPercent,
    status: data.status,
  };
}

async function generateTeacherCode() {
  const prefix = `GV-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = `${prefix}-${Math.floor(100000 + Math.random() * 900000)}`;
    if (!(await prisma.teacher.findUnique({ where: { code }, select: { id: true } }))) return code;
  }
  throw new ConflictError("Không thể tạo mã giáo viên tự động, vui lòng thử lại");
}

function buildTeacherUpdateInput(
  data: TeacherUpdate,
): Prisma.TeacherUpdateInput {
  return {
    ...(data.fullName !== undefined && { fullName: data.fullName }),
    ...(data.code !== undefined && { code: data.code }),
    ...(data.phone !== undefined && { phone: data.phone || null }),
    ...(data.bankAccount !== undefined && {
      bankAccount: data.bankAccount || null,
    }),
    ...(data.specialty !== undefined && {
      specialty: data.specialty || null,
    }),
    ...(data.commissionPercent !== undefined && {
      commissionPercent: data.commissionPercent,
    }),
    ...(data.status !== undefined && { status: data.status }),
    ...(data.status === "ACTIVE" && { deletedAt: null }),
  };
}

export async function createTeacher(data: TeacherCreate): Promise<Teacher> {
  const code = await generateTeacherCode();
  return prisma.teacher.create({
    data: { ...buildTeacherCreateInput(data), code },
  });
}

export async function getTeacherById(
  id: string,
): Promise<Teacher | null> {
  return prisma.teacher.findUnique({ where: { id } });
}

export async function getTeachers(filter: TeacherFilter) {
  const { search, status, page, pageSize } = filter;
  const skip = (page - 1) * pageSize;

  const where: Prisma.TeacherWhereInput = {
    ...(search && {
      OR: [
        { code: { contains: search, mode: "insensitive" } },
        { fullName: { contains: search, mode: "insensitive" } },
        { user: { fullName: { contains: search, mode: "insensitive" } } },
        { phone: { contains: search, mode: "insensitive" } },
        { specialty: { contains: search, mode: "insensitive" } },
      ],
    }),
    ...(status && { status }),
    ...(!status && { deletedAt: null }),
  };

  const [teachers, total] = await Promise.all([
    prisma.teacher.findMany({
      where,
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
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

export async function updateTeacher(
  id: string,
  data: TeacherUpdate,
): Promise<Teacher> {
  const currentTeacher = await prisma.teacher.findUnique({ where: { id } });

  if (!currentTeacher) {
    throw new NotFoundError("Không tìm thấy giáo viên");
  }

  return prisma.teacher.update({
    where: { id },
    data: buildTeacherUpdateInput(data),
  });
}

export async function deleteTeacher(id: string): Promise<Teacher> {
  const teacher = await prisma.teacher.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!teacher) {
    throw new NotFoundError("Không tìm thấy giáo viên");
  }

  return prisma.teacher.update({
    where: { id },
    data: { status: "INACTIVE", deletedAt: new Date() },
  });
}
