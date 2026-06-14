/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma";
import type { Student } from "@prisma/client";
import type {
  StudentCreate,
  StudentFilter,
  StudentUpdate,
} from "@/modules/student/schemas/student.schema";

export async function createStudent(data: StudentCreate): Promise<Student> {
  return prisma.student.create({
    data,
  });
}

export async function getStudentById(id: string): Promise<any> {
  return prisma.student.findUnique({
    where: { id },
    include: { classStudents: { include: { class: true } } },
  });
}

export async function getStudents(filter: StudentFilter) {
  const { search, status, page, limit } = filter;
  const skip = (page - 1) * limit;

  const where: any = {};
  if (search) {
    where.OR = [
      { code: { contains: search, mode: "insensitive" } },
      { fullName: { contains: search, mode: "insensitive" } },
    ];
  }
  if (status) {
    where.status = status;
  }

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
    data,
  });
}

export async function deleteStudent(id: string): Promise<Student> {
  return prisma.student.delete({
    where: { id },
  });
}
