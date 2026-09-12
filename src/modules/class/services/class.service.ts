import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { Prisma, type Class } from "@prisma/client";
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
import { getEffectiveTuitionFeeStatus } from "@/modules/finance/tuition/utils/tuition-status";

function toNullableDate(value?: string): Date | undefined {
  return value ? new Date(value) : undefined;
}

function buildClassCreateInput(
  data: ClassCreate,
): Prisma.ClassUncheckedCreateInput {
  return {
    code: data.code,
    name: data.name,
    startDate: toNullableDate(data.startDate),
    endDate: toNullableDate(data.endDate),
    status: data.status,
  };
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
    ...((data.status === "DRAFT" || data.status === "ACTIVE") && {
      deletedAt: null,
    }),
  };
}

export type ClassSubjectView = {
  id: string;
  teacherId: string | null;
  tuitionFee: Prisma.Decimal;
  totalSessions: number;
  maxStudents: number | null;
  subject: { id: string; name: string; status: "ACTIVE" | "INACTIVE" };
  teacher: { id: string; code: string; fullName: string } | null;
};

async function queryClassSubjects(
  client: Prisma.TransactionClient | typeof prisma,
  classId: string,
): Promise<ClassSubjectView[]> {
  return client.$queryRaw<ClassSubjectView[]>`
    SELECT cs.id, cs.teacher_id AS "teacherId", cs.tuition_fee AS "tuitionFee", cs.total_sessions AS "totalSessions",
           cs.max_students AS "maxStudents",
           json_build_object('id', s.id, 'name', s.name, 'status', s.status) AS subject,
           CASE WHEN t.id IS NULL THEN NULL ELSE json_build_object(
             'id', t.id, 'code', t.code, 'fullName', t.full_name
           ) END AS teacher
    FROM class_subjects cs
    JOIN subjects s ON s.id = cs.subject_id
    LEFT JOIN teachers t ON t.id = cs.teacher_id
    WHERE cs.class_id = ${classId}::uuid AND cs.status = 'ACTIVE'::class_subject_status
    ORDER BY cs.created_at ASC
  `;
}

async function assertClassCanManageSubjects(
  classId: string,
  client: typeof prisma | Prisma.TransactionClient = prisma,
) {
  const classData = await client.class.findUnique({
    where: { id: classId },
    select: { id: true, status: true },
  });
  if (!classData) throw new NotFoundError("Không tìm thấy lớp học");
  if (classData.status === "COMPLETED" || classData.status === "CANCELLED") {
    throw new ConflictError(
      "Không thể thay đổi môn học trong lớp đã kết thúc hoặc đã hủy",
    );
  }
  return classData;
}

export async function createClass(data: ClassCreate): Promise<Class> {
  if (data.status !== "DRAFT") {
    throw new ConflictError("Lớp học mới phải bắt đầu ở trạng thái nháp");
  }
  try {
    return await prisma.class.create({
      data: buildClassCreateInput({ ...data, status: "DRAFT" }),
    });
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ConflictError("Mã lớp đã tồn tại");
    }

    throw error;
  }
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
      schedules: { where: { deletedAt: null } },
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
    ...(!status && { deletedAt: null }),
  };

  const [classes, total] = await Promise.all([
    prisma.class.findMany({
      where,
      skip,
      take: pageSize,
      include: {
        _count: {
          select: {
            students: true,
            schedules: { where: { deletedAt: null } },
          },
        },
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
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
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
      startDate: true,
      endDate: true,
    },
  });

  if (!current) {
    throw new NotFoundError("Không tìm thấy lớp học");
  }

  const startDate =
    data.startDate === undefined ? current.startDate : new Date(data.startDate);
  const endDate =
    data.endDate === undefined ? current.endDate : new Date(data.endDate);
  if (startDate && endDate && endDate < startDate) {
    throw new ConflictError(
      "Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu",
    );
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
      _count: {
        select: {
          students: true,
          classSubjects: true,
          schedules: { where: { deletedAt: null } },
          tuitionFees: true,
        },
      },
    },
  });

  if (!classData) {
    throw new NotFoundError("Không tìm thấy lớp học");
  }

  if (classData._count.tuitionFees > 0) {
    throw new ConflictError("Không thể xóa lớp học đã phát sinh học phí");
  }

  if (
    classData._count.students > 0 ||
    classData._count.classSubjects > 0 ||
    classData._count.schedules > 0
  ) {
    throw new ConflictError(
      "Không thể xóa lớp đã có học viên, môn học hoặc lịch học; hãy chuyển trạng thái lớp thay vì xóa",
    );
  }

  return prisma.class.update({
    where: { id },
    data: { status: "CANCELLED", deletedAt: new Date() },
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

    for (const classSubjectId of [...new Set(classSubjectIds)].sort()) {
      await tx.$executeRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`class-subject:${classSubjectId}`}))`,
      );
    }

    const classSubjects = (await queryClassSubjects(tx, classId)).filter(
      (item) =>
        item.subject.status === "ACTIVE" && classSubjectIds.includes(item.id),
    );
    if (classSubjects.length !== new Set(classSubjectIds).size) {
      throw new ConflictError("Môn học không thuộc lớp hoặc đã ngừng mở");
    }

    const existing = await tx.classStudent.findUnique({
      where: { classId_studentId: { classId, studentId } },
      include: { student: true, class: true },
    });

    if (existing && !["ACTIVE", "LEFT"].includes(existing.status)) {
      throw new ConflictError(
        "Chỉ có thể đăng ký thêm môn cho enrollment đang học hoặc đã rời lớp",
      );
    }

  const classData = await tx.class.findUnique({ where: { id: classId } });
  if (!classData) throw new NotFoundError("Không tìm thấy lớp học");
  if (classData.status === "COMPLETED" || classData.status === "CANCELLED") {
    throw new ConflictError("Không thể đăng ký học viên vào lớp đã kết thúc hoặc đã hủy");
  }
  const student = await tx.student.findUnique({ where: { id: studentId } });
  if (!student) throw new NotFoundError("Không tìm thấy học viên");
  if (student.status !== "ACTIVE") {
    throw new ConflictError("Không thể đăng ký học viên đã ngừng hoạt động");
  }

    const existingSubjectRows = existing
      ? await tx.$queryRaw<
          Array<{ id: string; classSubjectId: string; status: string }>
        >`
          SELECT id, class_subject_id AS "classSubjectId", status::text AS status
          FROM enrollment_subjects
          WHERE enrollment_id = ${existing.id}::uuid
        `
      : [];
    const existingSubjectIds = new Set(
      existingSubjectRows
        .filter((row) => row.status === "ACTIVE")
        .map((row) => row.classSubjectId),
    );
    const newClassSubjects = classSubjects.filter(
      (classSubject) => !existingSubjectIds.has(classSubject.id),
    );
    if (newClassSubjects.length === 0) {
      throw new ConflictError("Học viên đã đăng ký các môn học được chọn");
    }

    const enrollment = existing
      ? await tx.classStudent.update({
          where: { id: existing.id },
          data: { status: "ACTIVE", leftAt: null, deletedAt: null },
          include: { student: true, class: true },
        })
      : await tx.classStudent.create({
          data: { classId, studentId },
          include: { student: true, class: true },
        });
    for (const classSubject of newClassSubjects) {
      if (classSubject.maxStudents !== null) {
        await tx.$executeRaw(
          Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`class-subject:${classSubject.id}`}))`,
        );
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
      const previousSubject = existingSubjectRows.find(
        (row) => row.classSubjectId === classSubject.id,
      );
      if (previousSubject) {
        await tx.enrollmentSubject.update({
          where: { id: previousSubject.id },
          data: { status: "ACTIVE", droppedAt: null, enrolledAt: new Date() },
        });
      } else {
        await tx.$executeRaw`
          INSERT INTO enrollment_subjects (enrollment_id, class_subject_id, enrolled_at)
          VALUES (${enrollment.id}::uuid, ${classSubject.id}::uuid, CURRENT_TIMESTAMP)
        `;
      }
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
          classSubjectIds: newClassSubjects.map((item) => item.id),
        },
        performedBy,
      },
    });
    return enrollment;
  });
}

export async function removeSubjectFromEnrollment(
  classId: string,
  studentId: string,
  classSubjectId: string,
  actorId: string,
  options?: { force?: boolean; reason?: string },
) {
  return prisma.$transaction(async (tx) => {
    const enrollment = await tx.classStudent.findUnique({
      where: { classId_studentId: { classId, studentId } },
      include: { student: true },
    });
    if (!enrollment || enrollment.status !== "ACTIVE") {
      throw new NotFoundError("Không tìm thấy học viên đang học trong lớp");
    }
    const subject = await tx.enrollmentSubject.findUnique({
      where: {
        enrollmentId_classSubjectId: { enrollmentId: enrollment.id, classSubjectId },
      },
      include: { classSubject: { include: { subject: true } } },
    });
    if (!subject || subject.status !== "ACTIVE") {
      throw new NotFoundError("Không tìm thấy môn học đang đăng ký");
    }
    const feeItem = await tx.tuitionFeeItem.findFirst({
      where: {
        classSubjectId,
        tuitionFee: {
          enrollmentId: enrollment.id,
          billingType: "MONTHLY",
        },
      },
      select: { id: true },
    });
    if (feeItem && options?.force !== true) {
      throw new ConflictError(
        "Không thể bỏ môn đã phát sinh học phí; hãy dùng force cancel kèm lý do",
      );
    }
    if (feeItem && !options?.reason?.trim()) {
      throw new ConflictError(
        "Bắt buộc nhập lý do khi force cancel môn đã phát sinh học phí",
      );
    }
    await tx.enrollmentSubject.update({
      where: { id: subject.id },
      data: { status: "DROPPED", droppedAt: new Date() },
    });
    await tx.tuitionAuditLog.create({
      data: {
        entityType: "ENROLLMENT",
        entityId: enrollment.id,
        action: "SUBJECT_DROPPED",
        dataAfter: {
          classId,
          studentId,
          classSubjectId,
          subjectName: subject.classSubject.subject.name,
          feeAlreadyCreated: Boolean(feeItem),
          forced: options?.force === true,
        },
        reason: options?.reason?.trim(),
        performedBy: actorId,
      },
    });
    return { dropped: true, feeAlreadyCreated: Boolean(feeItem) };
  });
}

function parseBillingMonth(value: string) {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
  if (!match) throw new ConflictError("Kỳ tạm nghỉ phải có định dạng YYYY-MM");
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
}

export async function pauseStudentEnrollment(
  classId: string,
  studentId: string,
  data: { startMonth: string; endMonth: string; reason?: string },
  actorId: string,
) {
  const startMonth = parseBillingMonth(data.startMonth);
  const endMonth = parseBillingMonth(data.endMonth);
  if (startMonth > endMonth) {
    throw new ConflictError("Tháng bắt đầu phải trước hoặc bằng tháng kết thúc");
  }
  return prisma.$transaction(async (tx) => {
    const enrollmentRef = await tx.classStudent.findUnique({
      where: { classId_studentId: { classId, studentId } },
      select: { id: true },
    });
    if (!enrollmentRef) {
      throw new NotFoundError("Không tìm thấy học viên đang học trong lớp");
    }
    await tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`enrollment:${enrollmentRef.id}`}))`,
    );
    const enrollment = await tx.classStudent.findUnique({
      where: { id: enrollmentRef.id },
    });
    if (!enrollment || enrollment.status !== "ACTIVE") {
      throw new NotFoundError("Không tìm thấy học viên đang học trong lớp");
    }
    const existingFees = await tx.$queryRaw<Array<{ id: string; status: string }>>`
      SELECT id, status::text AS status
      FROM tuition_fees
      WHERE enrollment_id = ${enrollment.id}::uuid
        AND billing_type = 'MONTHLY'::tuition_fee_billing_type
        AND make_date(billing_year::integer, billing_month::integer, 1)
          BETWEEN make_date(${startMonth.getUTCFullYear()}::integer, ${startMonth.getUTCMonth() + 1}::integer, 1)
          AND make_date(${endMonth.getUTCFullYear()}::integer, ${endMonth.getUTCMonth() + 1}::integer, 1)
      LIMIT 1
    `;
    if (existingFees.length > 0) {
      throw new ConflictError(
        "Không thể tạm nghỉ vì khoảng thời gian đã phát sinh học phí",
      );
    }
    const overlap = await tx.enrollmentPause.findFirst({
      where: {
        enrollmentId: enrollment.id,
        startMonth: { lte: endMonth },
        endMonth: { gte: startMonth },
      },
      select: { id: true },
    });
    if (overlap) throw new ConflictError("Khoảng tạm nghỉ bị trùng");
    const pause = await tx.enrollmentPause.create({
      data: {
        enrollmentId: enrollment.id,
        startMonth,
        endMonth,
        reason: data.reason?.trim() || null,
        createdBy: actorId,
      },
    });
    await tx.tuitionAuditLog.create({
      data: {
        entityType: "ENROLLMENT_PAUSE",
        entityId: pause.id,
        action: "CREATED",
        dataAfter: pause as unknown as Prisma.InputJsonValue,
        reason: pause.reason,
        performedBy: actorId,
      },
    });
    return pause;
  });
}

export async function getSubjects(search?: string, includeInactive = false) {
  return prisma.$queryRaw<
    Array<{
      id: string;
      name: string;
      status: "ACTIVE" | "INACTIVE";
    }>
  >`
    SELECT id, name, status FROM subjects
    WHERE ${includeInactive ? Prisma.sql`TRUE` : Prisma.sql`status = 'ACTIVE'::subject_status`}
      ${search ? Prisma.sql`AND name ILIKE ${`%${search}%`}` : Prisma.empty}
    ORDER BY name ASC
  `;
}

async function generateSubjectCode() {
  const prefix = `MH-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = `${prefix}-${Math.floor(100000 + Math.random() * 900000)}`;
    if (!(await prisma.subject.findUnique({ where: { code }, select: { id: true } }))) {
      return code;
    }
  }
  throw new ConflictError("Không thể tạo mã môn học tự động, vui lòng thử lại");
}

export async function createSubject(data: SubjectCreate) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = await generateSubjectCode();
    try {
      return await prisma.subject.create({
        data: { code, name: data.name, status: "ACTIVE" },
        select: { id: true, name: true, status: true },
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
  throw new ConflictError("Không thể tạo mã môn học tự động, vui lòng thử lại");
}

export async function updateSubject(id: string, data: SubjectUpdate) {
  const rows = await prisma.$queryRaw<
    Array<{ id: string; name: string; status: string }>
  >`
    UPDATE subjects
    SET name = ${data.name}, status = ${data.status}::subject_status,
        updated_at = CURRENT_TIMESTAMP, deleted_at = CASE WHEN ${data.status} = 'INACTIVE' THEN COALESCE(deleted_at, CURRENT_TIMESTAMP) ELSE NULL END
    WHERE id = ${id}::uuid
    RETURNING id, name, status
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
  actorId: string,
) {
  return prisma.$transaction(async (tx) => {
    await assertClassCanManageSubjects(classId, tx);
    const subject = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM subjects WHERE id = ${data.subjectId}::uuid AND status = 'ACTIVE'::subject_status
    `;
    if (!subject[0]) throw new NotFoundError("Không tìm thấy môn học");
    if (data.teacherId) {
      const teacher = await tx.teacher.findUnique({
        where: { id: data.teacherId },
        select: { id: true, status: true },
      });
      if (!teacher || teacher.status !== "ACTIVE")
        throw new ConflictError("Giáo viên không hợp lệ hoặc đã ngừng hoạt động");
    }
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      INSERT INTO class_subjects (id, class_id, subject_id, teacher_id, tuition_fee, total_sessions, max_students, status, created_at, updated_at)
      VALUES (gen_random_uuid(), ${classId}::uuid, ${data.subjectId}::uuid, ${data.teacherId ?? null}::uuid,
        ${data.tuitionFee}, ${data.totalSessions}, ${data.maxStudents ?? null}, 'ACTIVE'::class_subject_status, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id
    `;
    const created = (await queryClassSubjects(tx, classId)).find(
      (item) => item.id === rows[0]?.id,
    );
    if (!created) throw new NotFoundError("Không tìm thấy môn học vừa tạo");
    await tx.tuitionAuditLog.create({
      data: {
        entityType: "CLASS_SUBJECT",
        entityId: created.id,
        action: "CREATED",
        dataAfter: created as unknown as Prisma.InputJsonValue,
        performedBy: actorId,
      },
    });
    return created;
  });
}

export async function updateClassSubject(
  classId: string,
  classSubjectId: string,
  data: ClassSubjectUpdate,
  actorId: string,
) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`class-subject:${classSubjectId}`}))`,
    );
    await assertClassCanManageSubjects(classId, tx);
    const existing = (await queryClassSubjects(tx, classId)).find(
      (item) => item.id === classSubjectId,
    );
    if (!existing) throw new NotFoundError("Không tìm thấy môn học trong lớp");

    if (data.teacherId) {
      const teacher = await tx.teacher.findUnique({
        where: { id: data.teacherId },
        select: { id: true, status: true },
      });
      if (!teacher || teacher.status !== "ACTIVE")
        throw new ConflictError("Giáo viên không hợp lệ hoặc đã ngừng hoạt động");
    }
    if (data.teacherId !== undefined && data.teacherId !== existing.teacherId) {
      const activeSchedule = await tx.classSchedule.findFirst({
        where: { classSubjectId, deletedAt: null },
        select: { id: true },
      });
      if (activeSchedule) {
        throw new ConflictError(
          "Không thể đổi giáo viên khi môn học đang có lịch; hãy xóa lịch học trước",
        );
      }
    }
    if (data.maxStudents !== undefined && data.maxStudents !== null) {
      const activeEnrollmentCount = await tx.enrollmentSubject.count({
        where: { classSubjectId, status: "ACTIVE" },
      });
      if (data.maxStudents < activeEnrollmentCount) {
        throw new ConflictError(
          `Giới hạn học viên không được nhỏ hơn số đang đăng ký (${activeEnrollmentCount})`,
        );
      }
    }

    await tx.$executeRaw`
      UPDATE class_subjects
      SET teacher_id = CASE
            WHEN ${data.teacherId === undefined} THEN teacher_id
            ELSE ${data.teacherId ?? null}::uuid
          END,
          tuition_fee = ${data.tuitionFee},
          total_sessions = ${data.totalSessions},
          max_students = CASE
            WHEN ${data.maxStudents === undefined} THEN max_students
            ELSE ${data.maxStudents ?? null}
          END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${classSubjectId}::uuid AND class_id = ${classId}::uuid
    `;
    const updated = (await queryClassSubjects(tx, classId)).find(
      (item) => item.id === classSubjectId,
    );
    if (!updated) throw new NotFoundError("Không tìm thấy môn học vừa cập nhật");
    await tx.tuitionAuditLog.create({
      data: {
        entityType: "CLASS_SUBJECT",
        entityId: classSubjectId,
        action: "UPDATED",
        dataBefore: existing as unknown as Prisma.InputJsonValue,
        dataAfter: updated as unknown as Prisma.InputJsonValue,
        performedBy: actorId,
      },
    });
    return updated;
  });
}

export async function removeClassSubject(
  classId: string,
  classSubjectId: string,
  actorId: string,
) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`class-subject:${classSubjectId}`}))`,
    );
    await assertClassCanManageSubjects(classId, tx);
    const existing = (await queryClassSubjects(tx, classId)).find(
      (item) => item.id === classSubjectId,
    );
    if (!existing) throw new NotFoundError("Không tìm thấy môn học trong lớp");

    const [enrollments, tuitionItems, schedules] = await Promise.all([
      tx.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*)::bigint AS count FROM enrollment_subjects WHERE class_subject_id = ${classSubjectId}::uuid`,
      tx.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*)::bigint AS count FROM tuition_fee_items WHERE class_subject_id = ${classSubjectId}::uuid`,
      tx.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*)::bigint AS count FROM class_schedules WHERE class_subject_id = ${classSubjectId}::uuid AND deleted_at IS NULL`,
    ]);
    if (
      Number(enrollments[0]?.count ?? 0) > 0 ||
      Number(tuitionItems[0]?.count ?? 0) > 0 ||
      Number(schedules[0]?.count ?? 0) > 0
    ) {
      throw new ConflictError(
        "Không thể xóa môn đã có học viên, lịch học hoặc đã phát sinh học phí",
      );
    }

    await tx.$executeRaw`
      UPDATE class_subjects SET status = 'INACTIVE'::class_subject_status, deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${classSubjectId}::uuid AND class_id = ${classId}::uuid
    `;
    await tx.tuitionAuditLog.create({
      data: {
        entityType: "CLASS_SUBJECT",
        entityId: classSubjectId,
        action: "INACTIVATED",
        dataBefore: existing as unknown as Prisma.InputJsonValue,
        dataAfter: { status: "INACTIVE" },
        performedBy: actorId,
      },
    });
  });
}

export async function removeStudentFromClass(
  classId: string,
  studentId: string,
  options?: { force?: boolean; reason?: string },
  actorId?: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const enrollment = await tx.classStudent.findUnique({
      where: { classId_studentId: { classId, studentId } },
      include: { tuitionFees: { select: { id: true, status: true } } },
    });
    if (!enrollment || enrollment.status !== "ACTIVE") {
      throw new NotFoundError("Không tìm thấy học viên đang đăng ký trong lớp");
    }

    if (
      enrollment.tuitionFees.length > 0 &&
      options?.force !== true
    ) {
      throw new ConflictError(
        "Không thể xóa học viên đã phát sinh học phí",
      );
    }

    if (enrollment.tuitionFees.length > 0 && !options?.reason?.trim()) {
      throw new ConflictError(
        "Bắt buộc nhập lý do khi force rời lớp đã phát sinh học phí",
      );
    }

    await tx.enrollmentSubject.updateMany({
      where: { enrollmentId: enrollment.id, status: "ACTIVE" },
      data: { status: "DROPPED", droppedAt: new Date() },
    });
    await tx.classStudent.update({
      where: { id: enrollment.id },
      data: { status: "LEFT", leftAt: new Date(), deletedAt: new Date() },
    });
    if (actorId) {
      await tx.tuitionAuditLog.create({
        data: {
          entityType: "ENROLLMENT",
          entityId: enrollment.id,
          action: "LEFT",
          reason: options?.reason?.trim() || "Học viên rời lớp",
          dataBefore: {
            status: enrollment.status,
            tuitionFeeIds: enrollment.tuitionFees.map((fee) => fee.id),
          },
          dataAfter: {
            status: "LEFT",
            classId,
            studentId,
            forced: options?.force === true,
          },
          performedBy: actorId,
        },
      });
    }
  });
}

export async function getClassStudents(
  classId: string,
): Promise<
  Array<
    ClassStudentWithStudent & {
      subjects: Array<{ classSubjectId: string }>;
      tuitionFees: Array<{
        id: string;
        status: string;
        billingYear: number;
        billingMonth: number;
        billingType: string;
        items: Array<{ classSubjectId: string | null }>;
      }>;
      pauses: Array<{
        id: string;
        startMonth: Date;
        endMonth: Date;
        reason: string | null;
      }>;
    }
  >
> {
  return prisma.classStudent.findMany({
    where: { classId, status: "ACTIVE" },
    include: {
      student: true,
      subjects: {
        where: { status: "ACTIVE" },
        select: { classSubjectId: true },
      },
      tuitionFees: {
        select: {
          id: true,
          status: true,
          dueDate: true,
          billingYear: true,
          billingMonth: true,
          billingType: true,
          items: { select: { classSubjectId: true } },
        },
      },
      pauses: {
        select: { id: true, startMonth: true, endMonth: true, reason: true },
      },
    },
  }).then((students) =>
    students.map((student) => ({
      ...student,
      tuitionFees: student.tuitionFees.map((fee) => {
        const { dueDate, ...feeData } = fee;
        return {
          ...feeData,
          status: getEffectiveTuitionFeeStatus(fee.status, dueDate),
        };
      }),
    })),
  );
}
