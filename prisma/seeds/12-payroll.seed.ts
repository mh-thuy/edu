import type { Class, PrismaClient, Teacher } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { currentMonthKey } from "../helpers/random";

export async function seedPayrolls(
  prisma: PrismaClient,
  input: {
    teachers: Teacher[];
    classes: Class[];
    userId: string;
  },
): Promise<void> {
  const month = currentMonthKey();

  for (const teacher of input.teachers.slice(0, 3)) {
    const teacherClasses = input.classes.filter((cls) => cls.teacherId === teacher.id);

    if (teacherClasses.length === 0) continue;

    const revenue = new Decimal(teacherClasses.length * 6000000);
    const centerFee = revenue.mul(0.12);
    const salaryAmount = revenue.minus(centerFee);

    const payroll = await prisma.teacherPayroll.create({
      data: {
        teacherId: teacher.id,
        month,
        totalRevenue: revenue,
        centerFee,
        salaryAmount,
        status: "APPROVED",
        approvedAt: new Date(),
        approvedBy: input.userId,
        createdBy: input.userId,
        updatedBy: input.userId,
      },
    });

    for (const cls of teacherClasses) {
      const itemRevenue = new Decimal(6000000);
      const itemFee = itemRevenue.mul(0.12);

      await prisma.teacherPayrollItem.create({
        data: {
          payrollId: payroll.id,
          classId: cls.id,
          classCode: cls.code,
          studentCount: 10,
          revenue: itemRevenue,
          fee: itemFee,
          salary: itemRevenue.minus(itemFee),
        },
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: input.userId,
        action: "APPROVE_PAYROLL",
        tableName: "teacher_payrolls",
        recordId: payroll.id,
        newData: {
          teacherId: teacher.id,
          month,
          status: "APPROVED",
        },
      },
    });
  }
}
