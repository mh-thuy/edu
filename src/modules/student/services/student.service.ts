import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError } from "@/lib/errors";
import type { Prisma, Student } from "@prisma/client";
import type {
  StudentCreate,
  StudentFilter,
  StudentUpdate,
} from "@/modules/student/schemas/student.schema";
import type { StudentWithClasses } from "@/types/prisma";

function buildStudentCreateInput(data: StudentCreate): Prisma.StudentCreateInput {
  return {
    code: "",
    fullName: data.fullName,
    phone: data.phone || null,
    birthday: data.birthday ? new Date(data.birthday) : null,
    parentName: data.parentName || null,
    address: data.address || null,
    status: data.status,
  };
}

export async function generateStudentCode(
  client: typeof prisma | Prisma.TransactionClient = prisma,
) {
  const prefix = `HS-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = `${prefix}-${Math.floor(100000 + Math.random() * 900000)}`;
    if (!(await client.student.findUnique({ where: { code }, select: { id: true } }))) return code;
  }
  throw new ConflictError("Không thể tạo mã học viên tự động, vui lòng thử lại");
}

function buildStudentUpdateInput(data: StudentUpdate): Prisma.StudentUpdateInput {
  return {
    ...(data.code !== undefined && { code: data.code }),
    ...(data.fullName !== undefined && { fullName: data.fullName }),
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
  const code = await generateStudentCode(prisma);
  return prisma.student.create({
    data: { ...buildStudentCreateInput(data), code },
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
          tuitionFees: true,
        },
      },
    },
  });

  if (!student) {
    throw new NotFoundError("Không tìm thấy học viên");
  }

  if (student._count.enrollments > 0) {
    throw new ConflictError("Cannot delete student with class enrollments");
  }

  if (student._count.tuitionFees > 0) {
    throw new ConflictError("Cannot delete student with tuition fees");
  }

  return prisma.student.delete({
    where: { id },
  });
}
