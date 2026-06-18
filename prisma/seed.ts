import bcrypt from "bcrypt";
import { PrismaClient, Role } from "@prisma/client";
import { faker } from "@faker-js/faker";

const prisma = new PrismaClient();

function pick<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function clean(s: string | null | undefined) {
  if (s == null) return null;
  // remove null bytes and other control characters that break Postgres UTF8
  return s.replace(/[\x00-\x1F\x7F]/g, "");
}

async function main(): Promise<void> {
  console.log("Cleaning database (deleteMany)...");
  // delete in order to avoid FK issues
  await prisma.teacherPayrollItem.deleteMany();
  await prisma.teacherPayroll.deleteMany();
  await prisma.receipt.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.studentFee.deleteMany();
  await prisma.classStudent.deleteMany();
  await prisma.classSchedule.deleteMany();
  await prisma.classSalaryRule.deleteMany();
  await prisma.class.deleteMany();
  await prisma.student.deleteMany();
  await prisma.teacher.deleteMany();
  await prisma.user.deleteMany();
  await prisma.room.deleteMany();

  const passwordHash = await bcrypt.hash("password", 10);

  console.log("Creating admin and staff users...");
  await prisma.user.create({
    data: {
      email: "admin@example.test",
      fullName: "Administrator",
      passwordHash,
      role: Role.ADMIN,
    },
  });

  await prisma.user.create({
    data: {
      email: "staff@example.test",
      fullName: "Staff Member",
      passwordHash,
      role: Role.STAFF,
    },
  });

  console.log("Creating rooms...");
  const roomsData = Array.from({ length: 6 }).map((_, i) => ({
    code: `R${100 + i}`,
    name: clean(`${pick(["Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta"]) } Room ${i + 1}`)!,
    capacity: pick([10, 15, 20, 25, 30]),
    floor: pick([1, 2, 3]),
    location: clean(faker.location.city()),
  }));
  // create rooms via Prisma with sanitized inputs
  const rooms: any[] = [];
  for (const r of roomsData) {
    const result: any = await prisma.$queryRaw`
      INSERT INTO rooms (id, code, name, capacity, floor, location, status, is_active, created_at, updated_at)
      VALUES (gen_random_uuid(), ${r.code}, ${r.name}, ${r.capacity}, ${String(r.floor)}, ${r.location}, 'AVAILABLE', true, now(), now())
      RETURNING *
    `;
    rooms.push(result[0] ?? result);
  }

  console.log("Creating teachers and users...");
  const teacherPairs = await Promise.all(
    Array.from({ length: 6 }).map(async (_, i) => {
      const email = clean(faker.internet.email().toLowerCase())!;
      const user = await prisma.user.create({
        data: {
          email,
          fullName: clean(faker.person.fullName())!,
          passwordHash,
          role: Role.TEACHER,
        },
      });

      const teacher = await prisma.teacher.create({
        data: {
          userId: user.id,
          code: `T${100 + i}`,
          phone: clean(faker.phone.number()),
          email,
          fullName: user.fullName,
          specialty: pick(["Math", "English", "Music", "Science", "Art"]),
        },
      });

      return { user, teacher };
    })
  );

  console.log("Creating students...");
  const students = await Promise.all(
    Array.from({ length: 40 }).map(async (_, i) =>
      prisma.student.create({
        data: {
          code: `S${(1000 + i).toString()}`,
          fullName: clean(faker.person.fullName())!,
          email: clean(faker.internet.email().toLowerCase()),
          phone: clean(faker.phone.number()),
          birthday: faker.date.birthdate({ min: 6, max: 18, mode: "age" }),
          parentName: clean(faker.person.fullName()),
          address: clean(faker.location.streetAddress()),
        },
      })
    )
  );

  console.log("Creating classes...");
  const classes = await Promise.all(
    Array.from({ length: 8 }).map(async (_, i) => {
      const teacher = pick(teacherPairs).teacher;
      const room = pick(rooms);
      const tuition = pick([50, 75, 100, 150]) * 1.0;
      const start = faker.date.future({ years: 1 });
      const end = new Date(start.getTime() + 1000 * 60 * 60 * 24 * 30 * pick([2, 3, 4]));

      return prisma.class.create({
        data: {
          code: `C${200 + i}`,
          name: clean(`${pick(["Beginner", "Intermediate", "Advanced"]) } ${pick(["Math", "English", "Piano", "Science"]) }`)!,
          teacherId: teacher.id,
          roomId: room.id,
          tuitionFee: tuition,
          totalSessions: pick([8, 12, 16, 20]),
          maxStudents: pick([15, 20, 25, 30]),
          startDate: start,
          endDate: end,
          status: pick(["DRAFT", "ACTIVE", "COMPLETED"]),
        },
      });
    })
  );

  console.log("Creating schedules and enrolling students...");
  for (const cls of classes) {
    const schedulesToCreate = pick([1, 2, 3]);
    for (let s = 0; s < schedulesToCreate; s++) {
      const timeOptions = ["08:00", "09:15", "09:30", "11:00", "13:00", "14:30", "15:00", "16:30"];
      const startIdx = Math.floor(Math.random() * (timeOptions.length - 1));
      const endIdx = startIdx + 1 + Math.floor(Math.random() * (timeOptions.length - 1 - startIdx));
      const scheduleData = {
        classId: cls.id,
        roomId: cls.roomId ?? pick(rooms).id,
        teacherId: cls.teacherId ?? pick(teacherPairs).teacher.id,
        dayOfWeek: pick([1, 2, 3, 4, 5, 6]),
        startTime: timeOptions[startIdx],
        endTime: timeOptions[endIdx],
      };
      try {
        const res: any = await prisma.$queryRaw`
          INSERT INTO class_schedules (id, class_id, room_id, teacher_id, day_of_week, start_time, end_time, created_at, updated_at)
          VALUES (gen_random_uuid(), ${scheduleData.classId}::uuid, ${scheduleData.roomId}::uuid, ${scheduleData.teacherId}::uuid, ${scheduleData.dayOfWeek}::int, ${scheduleData.startTime}::time, ${scheduleData.endTime}::time, now(), now())
          RETURNING *
        `;
      } catch (err) {
        console.error('Failed creating schedule for class', cls.id, 'data', scheduleData, 'cls:', cls);
        throw err;
      }
    }

    const enrollCount = Math.min(cls.maxStudents, pick([8, 10, 12, 15, 18]));
    const shuffled = faker.helpers.shuffle(students);
    const enrolled = shuffled.slice(0, enrollCount);

    for (const student of enrolled) {
      await prisma.classStudent.create({ data: { classId: cls.id, studentId: student.id } });

      // create student fee for current month
      const month = new Date();
      const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
      const due = new Date(month.getFullYear(), month.getMonth() + 1, 5);

      const fee = await prisma.studentFee.create({
        data: {
          studentId: student.id,
          classId: cls.id,
          month: monthKey,
          amount: cls.tuitionFee,
          discount: 0,
          dueDate: due,
          status: "UNPAID",
        },
      });

      // randomly create payments for some fees
      if (Math.random() < 0.35) {
        const payment = await prisma.payment.create({
          data: {
            studentFeeId: fee.id,
            amount: fee.amount,
            method: pick(["CASH", "TRANSFER", "WALLET"]),
            paymentDate: new Date(),
            notes: null,
          },
        });

        await prisma.receipt.create({
          data: {
            paymentId: payment.id,
            receiptNumber: `RCPT-${faker.string.numeric(6)}`,
            issueDate: new Date(),
          },
        });

        await prisma.studentFee.update({ where: { id: fee.id }, data: { status: "PAID" } });
      }
    }
  }

  console.log("Creating class salary rules...");
  for (const cls of classes) {
    await prisma.classSalaryRule.create({
      data: {
        classId: cls.id,
        commissionPercentage: 12.0,
      },
    });
  }

  console.log("Seed completed.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error("Seed failed", error);
    await prisma.$disconnect();
    process.exit(1);
  });
