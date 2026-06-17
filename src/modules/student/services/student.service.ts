import { prisma } from "@/lib/prisma";
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
    include: { classStudents: { include: { class: true } } },
  });
}

export async function getStudents(filter: StudentFilter) {
  const { search, status, page, limit } = filter;
  const skip = (page - 1) * limit;

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
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.student.count({ where }),
  ]);

  return {
    items: students,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
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
  return prisma.student.delete({
    where: { id },
  });
}
