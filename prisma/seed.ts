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
  await prisma.room.deleteMany();
  await prisma.student.deleteMany();
  await prisma.teacher.deleteMany();
  await prisma.userRole.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.role.deleteMany();
  await prisma.user.deleteMany();
}

async function seedAuth() {
  const defaultPasswordHash = await bcrypt.hash("password", 10);

  const permissions = await Promise.all(
    [
      ["dashboard.view", "Xem dashboard", "dashboard", "view"],
      ["users.manage", "Quản lý người dùng", "users", "manage"],
      ["roles.manage", "Quản lý vai trò", "roles", "manage"],
      ["teachers.manage", "Quản lý giáo viên", "teachers", "manage"],
      ["students.manage", "Quản lý học viên", "students", "manage"],
      ["rooms.manage", "Quản lý phòng học", "rooms", "manage"],
      ["classes.manage", "Quản lý lớp học", "classes", "manage"],
      ["schedules.manage", "Quản lý lịch học", "schedules", "manage"],
      ["student_fees.manage", "Quản lý học phí", "student_fees", "manage"],
      ["payments.manage", "Quản lý thanh toán", "payments", "manage"],
      ["receipts.manage", "Quản lý biên lai", "receipts", "manage"],
      ["payrolls.manage", "Quản lý lương giáo viên", "payrolls", "manage"],
      ["expenses.manage", "Quản lý chi phí", "expenses", "manage"],
    ].map(([code, name, resource, action]) =>
      prisma.permission.create({
        data: {
          code,
          name,
          resource,
          action,
          description: name,
          isActive: true,
        },
      }),
    ),
  );

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

  await prisma.rolePermission.createMany({
    data: permissions.map((permission) => ({
      roleId: adminRole.id,
      permissionId: permission.id,
      isAllowed: true,
    })),
  });

  await prisma.rolePermission.createMany({
    data: permissions
      .filter((permission) =>
        [
          "dashboard",
          "teachers",
          "students",
          "rooms",
          "classes",
          "schedules",
          "student_fees",
          "payments",
          "receipts",
          "expenses",
        ].includes(permission.resource),
      )
      .map((permission) => ({
        roleId: staffRole.id,
        permissionId: permission.id,
        isAllowed: true,
      })),
  });

  await prisma.rolePermission.createMany({
    data: permissions
      .filter((permission) =>
        ["dashboard", "classes", "schedules"].includes(permission.resource),
      )
      .map((permission) => ({
        roleId: teacherRole.id,
        permissionId: permission.id,
        isAllowed: true,
      })),
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
  const rooms = await Promise.all([
    prisma.room.create({
      data: {
        code: "R101",
        name: "Phòng 101",
        capacity: 20,
        floor: "1",
        location: "Cơ sở chính",
        status: "AVAILABLE",
      },
    }),
    prisma.room.create({
      data: {
        code: "R102",
        name: "Phòng 102",
        capacity: 15,
        floor: "1",
        location: "Cơ sở chính",
        status: "AVAILABLE",
      },
    }),
    prisma.room.create({
      data: {
        code: "R201",
        name: "Phòng 201",
        capacity: 25,
        floor: "2",
        location: "Cơ sở chính",
        status: "MAINTENANCE",
        note: "Đang bảo trì máy lạnh",
      },
    }),
  ]);

  const teachers = await Promise.all([
    prisma.teacher.create({
      data: {
        code: "GV001",
        userId: teacherUserId,
        fullName: "Nguyễn Văn An",
        email: "teacher@edu.local",
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
        email: "binh.teacher@edu.local",
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
        email: "cuong.teacher@edu.local",
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
        email: "han.student@example.com",
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
        email: "khang.student@example.com",
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
        email: "ngoc.student@example.com",
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
        email: "long.student@example.com",
        phone: "0912000004",
        birthday: date("2010-01-12"),
        parentName: "Lê Thị Mai",
        address: "Tân Bình, TP.HCM",
        status: "INACTIVE",
      },
    }),
  ]);

  return { rooms, teachers, students };
}

async function seedClasses(
  teachers: Awaited<ReturnType<typeof seedMasters>>["teachers"],
  rooms: Awaited<ReturnType<typeof seedMasters>>["rooms"],
  students: Awaited<ReturnType<typeof seedMasters>>["students"],
) {
  const mathClass = await prisma.class.create({
    data: {
      code: "CLS-MATH-001",
      name: "Toán tư duy cơ bản",
      teacherId: teachers[0].id,
      roomId: rooms[0].id,
      tuitionFee: money(500000),
      totalSessions: 12,
      maxStudents: 15,
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
      roomId: rooms[1].id,
      tuitionFee: money(650000),
      totalSessions: 16,
      maxStudents: 12,
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
      roomId: rooms[0].id,
      tuitionFee: money(700000),
      totalSessions: 10,
      maxStudents: 10,
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
        roomId: rooms[0].id,
        teacherId: teachers[0].id,
        dayOfWeek: 2,
        startMinute: timeToMinute("18:00"),
        endMinute: timeToMinute("19:30"),
      },
      {
        classId: mathClass.id,
        roomId: rooms[0].id,
        teacherId: teachers[0].id,
        dayOfWeek: 4,
        startMinute: timeToMinute("18:00"),
        endMinute: timeToMinute("19:30"),
      },
      {
        classId: englishClass.id,
        roomId: rooms[1].id,
        teacherId: teachers[1].id,
        dayOfWeek: 7,
        startMinute: timeToMinute("09:00"),
        endMinute: timeToMinute("10:30"),
      },
      {
        classId: englishClass.id,
        roomId: rooms[1].id,
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
        code: "VCB-DEFAULT",
        bankCode: "VCB",
        bankName: "Vietcombank",
        accountNumber: "0191000346776",
        accountName: "MA HONG LAN",
        isDefault: true,
        isActive: true,
        note: "Tài khoản nhận học phí mặc định",
      },
      {
        code: "ACB-BACKUP",
        bankCode: "ACB",
        bankName: "ACB",
        accountNumber: "0987654321",
        accountName: "TRUNG TAM GIAO DUC DEMO",
        isDefault: false,
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
  const { rooms, teachers, students } = await seedMasters(teacherUser.id);
  const classes = await seedClasses(teachers, rooms, students);
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
