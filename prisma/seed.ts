import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const now = new Date();

function date(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function money(value: number): string {
  return value.toFixed(2);
}

function timeToMinute(time: string): number {
  const [hour = "0", minute = "0"] = time.split(":");
  return Number(hour) * 60 + Number(minute);
}

async function cleanup() {
  await prisma.auditLog.deleteMany();
  await prisma.teacherPayrollItem.deleteMany();
  await prisma.teacherPayroll.deleteMany();
  await prisma.classSalaryRule.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.paymentNotice.deleteMany();
  await prisma.receipt.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.paymentQrCode.deleteMany();
  await prisma.paymentAccount.deleteMany();
  await prisma.studentFee.deleteMany();
  await prisma.classSchedule.deleteMany();
  await prisma.classStudent.deleteMany();
  await prisma.class.deleteMany();
  await prisma.student.deleteMany();
  await prisma.teacher.deleteMany();
  await prisma.userRole.deleteMany();
  await prisma.role.deleteMany();
  await prisma.user.deleteMany();
}

async function seedAuth() {
  const defaultPasswordHash = await bcrypt.hash("password", 10);

  const adminRole = await prisma.role.create({
    data: {
      code: "ADMIN",
      name: "Quản trị viên",
      description: "Toàn quyền hệ thống",
      isActive: true,
    },
  });

  const staffRole = await prisma.role.create({
    data: {
      code: "STAFF",
      name: "Nhân viên",
      description: "Quản lý vận hành trung tâm",
      isActive: true,
    },
  });

  const teacherRole = await prisma.role.create({
    data: {
      code: "TEACHER",
      name: "Giáo viên",
      description: "Giáo viên giảng dạy",
      isActive: true,
    },
  });

  const adminUser = await prisma.user.create({
    data: {
      email: "admin@edu.local",
      fullName: "Quản trị viên",
      passwordHash: defaultPasswordHash,
      status: "ACTIVE",
    },
  });

  const staffUser = await prisma.user.create({
    data: {
      email: "staff@edu.local",
      fullName: "Nhân viên trung tâm",
      passwordHash: defaultPasswordHash,
      status: "ACTIVE",
    },
  });

  const teacherUser = await prisma.user.create({
    data: {
      email: "teacher@edu.local",
      fullName: "Nguyễn Văn An",
      passwordHash: defaultPasswordHash,
      status: "ACTIVE",
    },
  });

  await prisma.userRole.createMany({
    data: [
      { userId: adminUser.id, roleId: adminRole.id },
      { userId: staffUser.id, roleId: staffRole.id },
      { userId: teacherUser.id, roleId: teacherRole.id },
    ],
  });

  return { adminUser, staffUser, teacherUser };
}

async function seedMasters(teacherUserId: string) {
  const teachers = await Promise.all([
    prisma.teacher.create({
      data: {
        code: "GV001",
        userId: teacherUserId,
        fullName: "Nguyễn Văn An",
        phone: "0901000001",
        bankAccount: "0123456789",
        specialty: "Toán học",
        status: "ACTIVE",
      },
    }),
    prisma.teacher.create({
      data: {
        code: "GV002",
        fullName: "Trần Thị Bình",
        phone: "0901000002",
        bankAccount: "9876543210",
        specialty: "Tiếng Anh",
        status: "ACTIVE",
      },
    }),
    prisma.teacher.create({
      data: {
        code: "GV003",
        fullName: "Lê Minh Cường",
        phone: "0901000003",
        specialty: "Vật lý",
        status: "ON_LEAVE",
      },
    }),
  ]);

  const students = await Promise.all([
    prisma.student.create({
      data: {
        code: "HV001",
        fullName: "Phạm Gia Hân",
        phone: "0912000001",
        birthday: date("2012-03-15"),
        parentName: "Phạm Văn Hải",
        address: "Quận 1, TP.HCM",
        status: "ACTIVE",
      },
    }),
    prisma.student.create({
      data: {
        code: "HV002",
        fullName: "Nguyễn Minh Khang",
        phone: "0912000002",
        birthday: date("2011-07-20"),
        parentName: "Nguyễn Thị Hoa",
        address: "Quận 3, TP.HCM",
        status: "ACTIVE",
      },
    }),
    prisma.student.create({
      data: {
        code: "HV003",
        fullName: "Trần Bảo Ngọc",
        phone: "0912000003",
        birthday: date("2013-11-08"),
        parentName: "Trần Văn Nam",
        address: "Bình Thạnh, TP.HCM",
        status: "ACTIVE",
      },
    }),
    prisma.student.create({
      data: {
        code: "HV004",
        fullName: "Lê Hoàng Long",
        phone: "0912000004",
        birthday: date("2010-01-12"),
        parentName: "Lê Thị Mai",
        address: "Tân Bình, TP.HCM",
        status: "INACTIVE",
      },
    }),
  ]);

  return { teachers, students };
}

async function seedClasses(
  teachers: Awaited<ReturnType<typeof seedMasters>>["teachers"],
  students: Awaited<ReturnType<typeof seedMasters>>["students"],
) {
  const mathClass = await prisma.class.create({
    data: {
      code: "CLS-MATH-001",
      name: "Toán tư duy cơ bản",
      teacherId: teachers[0].id,
      tuitionFee: money(500000),
      totalSessions: 12,
      startDate: date("2026-06-01"),
      endDate: date("2026-08-31"),
      status: "ACTIVE",
      note: "Lớp tối thứ 2 và thứ 4",
    },
  });

  const englishClass = await prisma.class.create({
    data: {
      code: "CLS-ENG-001",
      name: "Tiếng Anh giao tiếp thiếu nhi",
      teacherId: teachers[1].id,
      tuitionFee: money(650000),
      totalSessions: 16,
      startDate: date("2026-06-05"),
      endDate: date("2026-09-30"),
      status: "ACTIVE",
      note: "Lớp cuối tuần",
    },
  });

  const physicsClass = await prisma.class.create({
    data: {
      code: "CLS-PHY-001",
      name: "Vật lý nâng cao",
      teacherId: teachers[2].id,
      tuitionFee: money(700000),
      totalSessions: 10,
      startDate: date("2026-07-01"),
      endDate: date("2026-09-15"),
      status: "DRAFT",
    },
  });

  await prisma.classStudent.createMany({
    data: [
      {
        classId: mathClass.id,
        studentId: students[0].id,
        enrolledAt: date("2026-06-01"),
        status: "ACTIVE",
      },
      {
        classId: mathClass.id,
        studentId: students[1].id,
        enrolledAt: date("2026-06-01"),
        status: "ACTIVE",
      },
      {
        classId: mathClass.id,
        studentId: students[2].id,
        enrolledAt: date("2026-06-01"),
        status: "ACTIVE",
      },
      {
        classId: englishClass.id,
        studentId: students[1].id,
        enrolledAt: date("2026-06-05"),
        status: "ACTIVE",
      },
      {
        classId: englishClass.id,
        studentId: students[2].id,
        enrolledAt: date("2026-06-05"),
        status: "ACTIVE",
      },
      {
        classId: englishClass.id,
        studentId: students[3].id,
        enrolledAt: date("2026-06-05"),
        leftAt: date("2026-06-20"),
        status: "LEFT",
        note: "Nghỉ do thay đổi lịch học",
      },
    ],
  });

  await prisma.classSchedule.createMany({
    data: [
      {
        classId: mathClass.id,
        teacherId: teachers[0].id,
        dayOfWeek: 2,
        startMinute: timeToMinute("18:00"),
        endMinute: timeToMinute("19:30"),
      },
      {
        classId: mathClass.id,
        teacherId: teachers[0].id,
        dayOfWeek: 4,
        startMinute: timeToMinute("18:00"),
        endMinute: timeToMinute("19:30"),
      },
      {
        classId: englishClass.id,
        teacherId: teachers[1].id,
        dayOfWeek: 7,
        startMinute: timeToMinute("09:00"),
        endMinute: timeToMinute("10:30"),
      },
      {
        classId: englishClass.id,
        teacherId: teachers[1].id,
        dayOfWeek: 1,
        startMinute: timeToMinute("09:00"),
        endMinute: timeToMinute("10:30"),
      },
    ],
  });

  return { mathClass, englishClass, physicsClass };
}

async function seedPaymentAccounts() {
  await prisma.paymentAccount.createMany({
    data: [
      {
        code: "VCB",
        bankCode: "VCB",
        bankName: "Ngân hàng Thương mại Cổ phần Ngoại thương Việt Nam",
        accountNumber: "0191000346776",
        accountName: "MA HONG LAN",
        isDefault: false,
        isActive: true,
        note: "Tài khoản nhận học phí mặc định",
      },
      {
        code: "BIDV",
        bankCode: "BIDV",
        bankName: "Ngân hàng Thương mại Cổ phần Đầu tư và Phát triển Việt Nam",
        accountNumber: "7802866666",
        accountName: "MA HONG LAN",
        isDefault: true,
        isActive: true,
        note: "Tài khoản dự phòng",
      },
    ],
  });
}

async function seedAudit(adminUserId: string) {
  await prisma.auditLog.create({
    data: {
      userId: adminUserId,
      action: "SEED_DATABASE",
      tableName: "system",
      recordId: null,
      oldData: undefined,
      newData: {
        message: "Seed dữ liệu mẫu cho hệ thống quản lý trung tâm",
        seededAt: now.toISOString(),
      },
      ipAddress: "127.0.0.1",
      userAgent: "prisma-seed",
    },
  });
}

async function main() {
  console.log("Start seeding...");

  await cleanup();

  const { adminUser, teacherUser } = await seedAuth();
  const { teachers, students } = await seedMasters(teacherUser.id);
  const classes = await seedClasses(teachers, students);
  await seedPaymentAccounts();

  await seedAudit(adminUser.id);

  console.log("Seed completed.");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
