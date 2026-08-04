import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { Prisma, type Class } from "@prisma/client";
import { randomInt } from "node:crypto";
import type {
  ClassCreate,
  ClassFilter,
  ClassUpdate,
} from "@/modules/class/schemas/class.schema";
import type {
  ClassSubjectCreate,
  ClassSubjectUpdate,
  SubjectCreate,
  SubjectUpdate,
} from "@/modules/class/schemas/class-subject.schema";
import type {
  ClassStudentWithRelations,
  ClassStudentWithStudent,
  ClassWithRelations,
} from "@/types/prisma";

function toNullableDate(value?: string): Date | undefined {
  return value ? new Date(value) : undefined;
}

function buildClassCreateInput(
  data: ClassCreate,
  code: string,
): Prisma.ClassUncheckedCreateInput {
  return {
    code,
    name: data.name,
    startDate: toNullableDate(data.startDate),
    endDate: toNullableDate(data.endDate),
    status: data.status,
  };
}

function generateClassCode(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `CLS-${date}-${randomInt(1000, 10000)}`;
}

function buildClassUpdateInput(
  data: ClassUpdate,
): Prisma.ClassUncheckedUpdateInput {
  return {
    ...(data.code !== undefined && { code: data.code }),
    ...(data.name !== undefined && { name: data.name }),
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
    if (
      !(await tx.tuitionFee.findUnique({
        where: { feeNo: candidate },
        select: { id: true },
      }))
    )
      return candidate;
  }
  throw new ConflictError("Không thể tạo mã học phí tự động, vui lòng thử lại");
}

export type ClassSubjectView = {
  id: string;
  teacherId: string | null;
  tuitionFee: Prisma.Decimal;
  totalSessions: number;
  maxStudents: number | null;
  subject: { id: string; code: string; name: string };
  teacher: { user: { fullName: string } | null } | null;
};

async function queryClassSubjects(
  client: Prisma.TransactionClient | typeof prisma,
  classId: string,
): Promise<ClassSubjectView[]> {
  return client.$queryRaw<ClassSubjectView[]>`
    SELECT cs.id, cs.teacher_id AS "teacherId", cs.tuition_fee AS "tuitionFee", cs.total_sessions AS "totalSessions",
           cs.max_students AS "maxStudents",
           json_build_object('id', s.id, 'code', s.code, 'name', s.name) AS subject,
           CASE WHEN t.id IS NULL THEN NULL ELSE json_build_object(
             'id', t.id, 'code', t.code,
             'user', CASE WHEN u.id IS NULL THEN NULL ELSE json_build_object('fullName', u.full_name) END
           ) END AS teacher
    FROM class_subjects cs
    JOIN subjects s ON s.id = cs.subject_id
    LEFT JOIN teachers t ON t.id = cs.teacher_id
    LEFT JOIN users u ON u.id = t.user_id
    WHERE cs.class_id = ${classId}::uuid AND cs.status = 'ACTIVE'::class_subject_status
    ORDER BY cs.created_at ASC
  `;
}

export async function createClass(data: ClassCreate): Promise<Class> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await prisma.class.create({
        data: buildClassCreateInput(data, generateClassCode()),
      });
    } catch (error: unknown) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== "P2002"
      ) {
        throw error;
      }
    }
  }

  throw new ConflictError("Không thể tạo mã lớp tự động, vui lòng thử lại");
}

export async function getClassById(
  id: string,
): Promise<
  (ClassWithRelations & { classSubjects: ClassSubjectView[] }) | null
> {
  const classData = await prisma.class.findUnique({
    where: { id },
    include: {
      students: { include: { student: true } },
      schedules: true,
    },
  });
  if (!classData) return null;
  return { ...classData, classSubjects: await queryClassSubjects(prisma, id) };
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

  const [classes, total] = await Promise.all([
    prisma.class.findMany({
      where,
      skip,
      take: pageSize,
      include: {
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
    classSubjects: {
      some: { teacher: { userId }, status: "ACTIVE" },
    },
    ...(search && {
      OR: [
        { code: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
      ],
    }),
    ...(status && { status }),
  };

  const [classes, total] = await Promise.all([
    prisma.class.findMany({
      where,
      skip,
      take: pageSize,
      include: {
        _count: { select: { students: true, schedules: true } },
        classSubjects: {
          where: { status: "ACTIVE", teacher: { userId } },
          select: { subject: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.class.count({ where }),
  ]);

  return {
    items: classes.map(({ classSubjects, ...item }) => ({
      ...item,
      subjectCount: classSubjects.length,
      subjectNames: classSubjects.map(({ subject }) => subject.name),
    })),
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
    throw new ConflictError("Không thể xóa lớp học đã phát sinh học phí");
  }

  return prisma.class.delete({
    where: { id },
  });
}

export async function assignStudentToClass(
  classId: string,
  studentId: string,
  classSubjectIds: string[],
  actorId?: string,
): Promise<ClassStudentWithRelations> {
  return prisma.$transaction(async (tx) => {
    if (classSubjectIds.length === 0) {
      throw new ConflictError("Hãy chọn ít nhất một môn học");
    }

    const classSubjects = (await queryClassSubjects(tx, classId)).filter(
      (item) => classSubjectIds.includes(item.id),
    );
    if (classSubjects.length !== new Set(classSubjectIds).size) {
      throw new ConflictError("Môn học không thuộc lớp hoặc đã ngừng mở");
    }

    const existing = await tx.classStudent.findUnique({
      where: { classId_studentId: { classId, studentId } },
      include: { student: true, class: true },
    });

    const classData = await tx.class.findUnique({ where: { id: classId } });
    if (!classData) throw new NotFoundError("Không tìm thấy lớp học");
    const student = await tx.student.findUnique({ where: { id: studentId } });
    if (!student) throw new NotFoundError("Không tìm thấy học viên");

    const existingSubjectRows = existing
      ? await tx.$queryRaw<Array<{ classSubjectId: string }>>`
          SELECT class_subject_id AS "classSubjectId"
          FROM enrollment_subjects
          WHERE enrollment_id = ${existing.id}::uuid AND status = 'ACTIVE'::enrollment_subject_status
        `
      : [];
    const existingSubjectIds = new Set(
      existingSubjectRows.map((row) => row.classSubjectId),
    );
    const newClassSubjects = classSubjects.filter(
      (classSubject) => !existingSubjectIds.has(classSubject.id),
    );
    const billedItems = existing
      ? await tx.tuitionFeeItem.findMany({
          where: {
            tuitionFee: { enrollmentId: existing.id },
            classSubjectId: { in: classSubjectIds },
          },
          select: { classSubjectId: true },
          distinct: ["classSubjectId"],
        })
      : [];
    const billedSubjectIds = new Set(
      billedItems
        .map((row) => row.classSubjectId)
        .filter((value): value is string => Boolean(value)),
    );
    const subjectsToBill = classSubjects.filter(
      (classSubject) => !billedSubjectIds.has(classSubject.id),
    );
    if (newClassSubjects.length === 0 && subjectsToBill.length === 0) {
      throw new ConflictError("Học viên đã đăng ký các môn học được chọn");
    }

    const enrollment =
      existing ??
      (await tx.classStudent.create({
        data: { classId, studentId },
        include: { student: true, class: true },
      }));
    for (const classSubject of newClassSubjects) {
      if (classSubject.maxStudents !== null) {
        const countRows = await tx.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*)::bigint AS count FROM enrollment_subjects
          WHERE class_subject_id = ${classSubject.id}::uuid AND status = 'ACTIVE'::enrollment_subject_status
        `;
        const count = Number(countRows[0]?.count ?? 0);
        if (count >= classSubject.maxStudents) {
          throw new ConflictError(
            `Môn ${classSubject.subject.name} đã đủ số lượng`,
          );
        }
      }
      await tx.$executeRaw`
        INSERT INTO enrollment_subjects (enrollment_id, class_subject_id, enrolled_at)
        VALUES (${enrollment.id}::uuid, ${classSubject.id}::uuid, CURRENT_TIMESTAMP)
      `;
    }

    const feeNo = await generateTuitionFeeNo(tx);
    const originalAmount = subjectsToBill.reduce(
      (total, classSubject) => total.add(classSubject.tuitionFee),
      new Prisma.Decimal(0),
    );
    const fee = await tx.tuitionFee.create({
      data: {
        feeNo,
        studentId,
        enrollmentId: enrollment.id,
        classId,
        originalAmount,
        discountAmount: 0,
        additionalAmount: 0,
        finalAmount: originalAmount,
        dueDate: classData.endDate,
        createdBy: actorId || studentId,
        updatedBy: actorId || studentId,
      },
    });
    for (const [index, classSubject] of subjectsToBill.entries()) {
      await tx.$executeRaw`
        INSERT INTO tuition_fee_items
          (id, tuition_fee_id, class_subject_id, item_type, item_name, quantity, unit_price, amount, display_order, created_at, updated_at)
        VALUES
          (gen_random_uuid(), ${fee.id}::uuid, ${classSubject.id}::uuid, 'TUITION'::tuition_fee_item_type,
           ${`Học phí môn ${classSubject.subject.name}`}, 1, ${classSubject.tuitionFee}, ${classSubject.tuitionFee}, ${index}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `;
    }
    const performedBy = actorId || studentId;
    await tx.tuitionAuditLog.create({
      data: {
        entityType: "ENROLLMENT",
        entityId: enrollment.id,
        action: "SUBJECTS_REGISTERED",
        dataBefore: { classSubjectIds: [...existingSubjectIds] },
        dataAfter: {
          classId,
          studentId,
          classSubjectIds: classSubjects.map((item) => item.id),
          newClassSubjectIds: newClassSubjects.map((item) => item.id),
          tuitionFeeId: fee.id,
        },
        performedBy,
      },
    });
    await tx.tuitionAuditLog.create({
      data: {
        entityType: "TUITION_FEE",
        entityId: fee.id,
        action: "AUTO_CREATED_FROM_ENROLLMENT",
        dataAfter: {
          enrollmentId: enrollment.id,
          classId,
          studentId,
          classSubjectIds: subjectsToBill.map((item) => item.id),
          originalAmount: originalAmount.toString(),
          finalAmount: originalAmount.toString(),
        },
        performedBy,
      },
    });
    return enrollment;
  });
}

export async function getSubjects(search?: string, includeInactive = false) {
  return prisma.$queryRaw<
    Array<{
      id: string;
      code: string;
      name: string;
      status: "ACTIVE" | "INACTIVE";
    }>
  >`
    SELECT id, code, name, status FROM subjects
    WHERE ${includeInactive ? Prisma.sql`TRUE` : Prisma.sql`status = 'ACTIVE'::subject_status`}
      ${search ? Prisma.sql`AND name ILIKE ${`%${search}%`}` : Prisma.empty}
    ORDER BY name ASC
  `;
}

export async function createSubject(data: SubjectCreate) {
  const rows = await prisma.$queryRaw<
    Array<{ id: string; code: string; name: string }>
  >`
    INSERT INTO subjects (id, code, name, status, created_at, updated_at)
    VALUES (gen_random_uuid(), ${data.code.toUpperCase()}, ${data.name}, 'ACTIVE'::subject_status, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    RETURNING id, code, name
  `;
  return rows[0];
}

export async function updateSubject(id: string, data: SubjectUpdate) {
  const rows = await prisma.$queryRaw<
    Array<{ id: string; code: string; name: string; status: string }>
  >`
    UPDATE subjects
    SET code = ${data.code.toUpperCase()}, name = ${data.name}, status = ${data.status}::subject_status,
        updated_at = CURRENT_TIMESTAMP, deleted_at = CASE WHEN ${data.status} = 'INACTIVE' THEN COALESCE(deleted_at, CURRENT_TIMESTAMP) ELSE NULL END
    WHERE id = ${id}::uuid
    RETURNING id, code, name, status
  `;
  if (!rows[0]) throw new NotFoundError("Không tìm thấy môn học");
  return rows[0];
}

export async function getClassSubjects(classId: string) {
  return queryClassSubjects(prisma, classId);
}

export async function addClassSubject(
  classId: string,
  data: ClassSubjectCreate,
) {
  const classData = await prisma.class.findUnique({
    where: { id: classId },
    select: { id: true },
  });
  if (!classData) throw new NotFoundError("Không tìm thấy lớp học");
  const subject = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM subjects WHERE id = ${data.subjectId}::uuid AND status = 'ACTIVE'::subject_status
  `;
  if (!subject[0]) throw new NotFoundError("Không tìm thấy môn học");
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    INSERT INTO class_subjects (id, class_id, subject_id, teacher_id, tuition_fee, total_sessions, max_students, status, created_at, updated_at)
    VALUES (gen_random_uuid(), ${classId}::uuid, ${data.subjectId}::uuid, ${data.teacherId ?? null}::uuid,
      ${data.tuitionFee}, ${data.totalSessions}, ${data.maxStudents ?? null}, 'ACTIVE'::class_subject_status, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    RETURNING id
  `;
  return (await getClassSubjects(classId)).find(
    (item) => item.id === rows[0]?.id,
  );
}

export async function updateClassSubject(
  classId: string,
  classSubjectId: string,
  data: ClassSubjectUpdate,
) {
  const existing = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM class_subjects
    WHERE id = ${classSubjectId}::uuid AND class_id = ${classId}::uuid AND status = 'ACTIVE'::class_subject_status
  `;
  if (!existing[0]) throw new NotFoundError("Không tìm thấy môn học trong lớp");

  if (data.teacherId) {
    const teacher = await prisma.teacher.findUnique({
      where: { id: data.teacherId },
      select: { id: true, status: true },
    });
    if (!teacher || teacher.status !== "ACTIVE")
      throw new ConflictError("Giáo viên không hợp lệ hoặc đã ngừng hoạt động");
  }

  await prisma.$executeRaw`
    UPDATE class_subjects
    SET teacher_id = ${data.teacherId ?? null}::uuid,
        tuition_fee = ${data.tuitionFee},
        total_sessions = ${data.totalSessions},
        max_students = ${data.maxStudents ?? null},
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${classSubjectId}::uuid AND class_id = ${classId}::uuid
  `;
  return (await getClassSubjects(classId)).find(
    (item) => item.id === classSubjectId,
  );
}

export async function removeClassSubject(
  classId: string,
  classSubjectId: string,
) {
  const existing = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM class_subjects
    WHERE id = ${classSubjectId}::uuid AND class_id = ${classId}::uuid AND status = 'ACTIVE'::class_subject_status
  `;
  if (!existing[0]) throw new NotFoundError("Không tìm thấy môn học trong lớp");

  const [enrollments, tuitionItems] = await Promise.all([
    prisma.$queryRaw<
      Array<{ count: bigint }>
    >`SELECT COUNT(*)::bigint AS count FROM enrollment_subjects WHERE class_subject_id = ${classSubjectId}::uuid`,
    prisma.$queryRaw<
      Array<{ count: bigint }>
    >`SELECT COUNT(*)::bigint AS count FROM tuition_fee_items WHERE class_subject_id = ${classSubjectId}::uuid`,
  ]);
  if (
    Number(enrollments[0]?.count ?? 0) > 0 ||
    Number(tuitionItems[0]?.count ?? 0) > 0
  ) {
    throw new ConflictError(
      "Không thể xóa môn đã có học viên đăng ký hoặc đã phát sinh học phí",
    );
  }

  await prisma.$executeRaw`
    UPDATE class_subjects SET status = 'INACTIVE'::class_subject_status, deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = ${classSubjectId}::uuid AND class_id = ${classId}::uuid
  `;
}

export async function removeStudentFromClass(
  classId: string,
  studentId: string,
  options?: { force?: boolean; isAdmin?: boolean },
): Promise<void> {
  const hasTuitionFees = await prisma.tuitionFee.count({
    where: { classId, studentId },
  });

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
): Promise<
  Array<
    ClassStudentWithStudent & { subjects: Array<{ classSubjectId: string }> }
  >
> {
  return prisma.classStudent.findMany({
    where: { classId },
    include: {
      student: true,
      subjects: {
        where: { status: "ACTIVE" },
        select: { classSubjectId: true },
      },
    },
  });
}
