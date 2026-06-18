import { prisma } from "@/lib/prisma";
import { ConflictError } from "@/lib/errors";
import type { Prisma, Student } from "@prisma/client";
import type {
  StudentCreate,
  StudentFilter,
  StudentUpdate,
} from "@/modules/student/schemas/student.schema";
import type { StudentWithClasses } from "@/types/prisma";

function buildStudentCreateInput(data: StudentCreate): Prisma.StudentCreateInput {
  return {
    code: data.code,
    fullName: data.fullName,
    email: data.email || null,
    phone: data.phone || null,
    birthday: data.birthday ? new Date(data.birthday) : null,
    parentName: data.parentName || null,
    address: data.address || null,
    status: data.status,
  };
}

function buildStudentUpdateInput(data: StudentUpdate): Prisma.StudentUpdateInput {
  return {
    ...(data.code !== undefined && { code: data.code }),
    ...(data.fullName !== undefined && { fullName: data.fullName }),
    ...(data.email !== undefined && { email: data.email || null }),
    ...(data.phone !== undefined && { phone: data.phone || null }),
    ...(data.birthday !== undefined && {
      birthday: data.birthday ? new Date(data.birthday) : null,
    }),
    ...(data.parentName !== undefined && {
      parentName: data.parentName || null,
    }),
    ...(data.address !== undefined && { address: data.address || null }),
    ...(data.status !== undefined && { status: data.status }),
  };
}

export async function createStudent(data: StudentCreate): Promise<Student> {
  return prisma.student.create({
    data: buildStudentCreateInput(data),
  });
}

export async function getStudentById(id: string): Promise<StudentWithClasses | null> {
  return prisma.student.findUnique({
    where: { id },
    include: { enrollments: { include: { class: true } } },
  });
}

export async function getStudents(filter: StudentFilter) {
  const { search, status, page, pageSize } = filter;
  const skip = (page - 1) * pageSize;

  const where: Prisma.StudentWhereInput = {
    ...(search && {
      OR: [
        { code: { contains: search, mode: "insensitive" } },
        { fullName: { contains: search, mode: "insensitive" } },
      ],
    }),
    ...(status && { status }),
  };

  const [students, total] = await Promise.all([
    prisma.student.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
    }),
    prisma.student.count({ where }),
  ]);

  return {
    items: students,
    total,
    page,
    pageSize,
    pages: Math.ceil(total / pageSize),
  };
}

export async function updateStudent(
  id: string,
  data: StudentUpdate,
): Promise<Student> {
  return prisma.student.update({
    where: { id },
    data: buildStudentUpdateInput(data),
  });
}

export async function deleteStudent(id: string): Promise<Student> {
  const student = await prisma.student.findUnique({
    where: { id },
    select: {
      _count: {
        select: {
          enrollments: true,
          fees: true,
        },
      },
      fees: {
        select: {
          payments: {
            select: { id: true },
            take: 1,
          },
        },
        take: 1,
      },
    },
  });

  if (!student) {
    throw new Error("Student not found");
  }

  if (student._count.enrollments > 0) {
    throw new ConflictError("Cannot delete student with class enrollments");
  }

  if (student._count.fees > 0) {
    throw new ConflictError("Cannot delete student with student fees");
  }

  if (student.fees.some((fee) => fee.payments.length > 0)) {
    throw new ConflictError("Cannot delete student with payments");
  }

  return prisma.student.delete({
    where: { id },
  });
}
