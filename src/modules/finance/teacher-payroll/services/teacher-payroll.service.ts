import { prisma } from "@/lib/prisma";
import { decimalToNumber, sumDecimals, toDecimal } from "@/lib/decimal";
import { PayrollStatus as PrismaPayrollStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import type { TeacherPayrollFilter } from "@/modules/finance/teacher-payroll/schemas/teacher-payroll.schema";

export class TeacherPayrollService {
  private static toPrismaPayrollStatus(
    status?: TeacherPayrollFilter["status"],
  ): PrismaPayrollStatus | undefined {
    if (!status) return undefined;

    switch (status) {
      case "draft":
        return PrismaPayrollStatus.DRAFT;
      case "approved":
        return PrismaPayrollStatus.APPROVED;
      case "paid":
        return PrismaPayrollStatus.PAID;
      default:
        return undefined;
    }
  }

  /**
   * Calculate and create payroll for a teacher for a specific month
   * Only calculates based on actual collected payments
   */
  static async calculateMonthlyPayroll(teacherId: string, month: string) {
    const existingPayroll = await prisma.teacherPayroll.findUnique({
      where: { teacherId_month: { teacherId, month } },
    });

    if (existingPayroll) {
      throw new Error("Payroll already exists for this teacher and month");
    }

    // Get teacher's active classes.
    const classes = await prisma.class.findMany({
      where: {
        teacherId,
        status: "ACTIVE",
      },
      select: {
        id: true,
        code: true,
        _count: {
          select: {
            classStudents: true,
          },
        },
      },
    });

    if (classes.length === 0) {
      return await prisma.teacherPayroll.create({
        data: {
          teacherId,
          month,
          totalRevenue: 0,
          centerFee: 0,
          salaryAmount: 0,
          status: PrismaPayrollStatus.DRAFT,
        },
      });
    }

    const [yearString, monthString] = month.split("-");
    const year = Number(yearString);
    const monthNumber = Number(monthString);

    if (
      !Number.isInteger(year) ||
      !Number.isInteger(monthNumber) ||
      monthNumber < 1 ||
      monthNumber > 12
    ) {
      throw new Error("Month must be in format YYYY-MM");
    }

    const monthStart = new Date(year, monthNumber - 1, 1);
    const monthEnd = new Date(year, monthNumber, 1);

    const classIds = classes.map((cls) => cls.id);

    const [rules, payments] = await Promise.all([
      prisma.classSalaryRule.findMany({
        where: {
          classId: { in: classIds },
        },
        select: {
          classId: true,
          commissionPercentage: true,
        },
      }),
      prisma.payment.findMany({
        where: {
          paymentDate: {
            gte: monthStart,
            lt: monthEnd,
          },
          studentFee: {
            classId: { in: classIds },
          },
        },
        select: {
          amount: true,
          studentFee: {
            select: {
              classId: true,
            },
          },
        },
      }),
    ]);

    const ruleByClassId = new Map<string, number | Prisma.Decimal>();
    for (const rule of rules) {
      ruleByClassId.set(rule.classId, rule.commissionPercentage);
    }

    const revenueByClassId = new Map<string, number | Prisma.Decimal>();
    for (const payment of payments) {
      const classId = payment.studentFee.classId;
      const current = revenueByClassId.get(classId) ?? 0;
      revenueByClassId.set(classId, toDecimal(current).add(payment.amount));
    }

    let totalRevenue = toDecimal(0);
    const items: Array<{
      classId: string;
      classCode: string;
      studentCount: number;
      revenue: number | Prisma.Decimal;
      fee: number | Prisma.Decimal;
      salary: number | Prisma.Decimal;
    }> = [];

    for (const cls of classes) {
      const studentCount = cls._count.classStudents;

      if (studentCount === 0) continue;
      const commissionPercentage = toDecimal(ruleByClassId.get(cls.id) ?? 0);
      const classRevenue = toDecimal(revenueByClassId.get(cls.id) ?? 0);
      const centerFee = classRevenue.mul(commissionPercentage).div(100);
      const teacherSalary = classRevenue.sub(centerFee);

      if (classRevenue.gt(0)) {
        items.push({
          classId: cls.id,
          classCode: cls.code,
          studentCount,
          revenue: classRevenue,
          fee: centerFee,
          salary: teacherSalary,
        });
      }

      totalRevenue = totalRevenue.add(classRevenue);
    }

    const totalCenterFee = sumDecimals(items.map((item) => item.fee));
    const totalSalary = sumDecimals(items.map((item) => item.salary));

    return prisma.$transaction(async (tx) => {
      const payroll = await tx.teacherPayroll.create({
        data: {
          teacherId,
          month,
          totalRevenue: decimalToNumber(totalRevenue),
          centerFee: decimalToNumber(totalCenterFee),
          salaryAmount: decimalToNumber(totalSalary),
          status: PrismaPayrollStatus.DRAFT,
        },
      });

      if (items.length > 0) {
        await tx.teacherPayrollItem.createMany({
          data: items.map((item) => ({
            payrollId: payroll.id,
            classId: item.classId,
            classCode: item.classCode,
            studentCount: item.studentCount,
            revenue: decimalToNumber(item.revenue),
            fee: decimalToNumber(item.fee),
            salary: decimalToNumber(item.salary),
          })),
        });
      }

      return payroll;
    });
  }

  /**
   * Get payrolls with pagination and filtering
   */
  static async getPayrolls(filter: TeacherPayrollFilter) {
    const { page, pageSize, teacherId, month, status } = filter;
    const skip = (page - 1) * pageSize;
    const prismaStatus = this.toPrismaPayrollStatus(status);

    const where: Prisma.TeacherPayrollWhereInput = {
      ...(teacherId && { teacherId }),
      ...(month && { month }),
      ...(prismaStatus && { status: prismaStatus }),
    };

    const [items, total] = await Promise.all([
      prisma.teacherPayroll.findMany({
        where,
        include: {
          items: true,
          teacher: {
            select: {
              id: true,
              code: true,
              user: {
                select: {
                  fullName: true,
                },
              },
            },
          },
        },
        skip,
        take: pageSize,
        orderBy: { month: "desc" },
      }),
      prisma.teacherPayroll.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      pages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Get payroll by ID
   */
  static async getPayrollById(id: string) {
    return prisma.teacherPayroll.findUnique({
      where: { id },
      include: {
        items: true,
        teacher: {
          select: {
            id: true,
            code: true,
            user: {
              select: {
                fullName: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Approve payroll (lock it, prevent recalculation)
   */
  static async approvePayroll(id: string, approvedBy: string) {
    const payroll = await prisma.teacherPayroll.findUnique({ where: { id } });
    if (!payroll) throw new Error("Payroll not found");
    if (payroll.status === PrismaPayrollStatus.APPROVED)
      throw new Error("Payroll is already approved");
    if (payroll.status === PrismaPayrollStatus.PAID)
      throw new Error("Payroll is already paid");
    if (payroll.status !== PrismaPayrollStatus.DRAFT)
      throw new Error("Only draft payroll can be approved");

    return prisma.teacherPayroll.update({
      where: { id },
      data: {
        status: PrismaPayrollStatus.APPROVED,
        approvedAt: new Date(),
        approvedBy,
      },
      include: { items: true },
    });
  }

  /**
   * Mark payroll as paid
   */
  static async markPayrollAsPaid(id: string, paidBy: string) {
    const payroll = await prisma.teacherPayroll.findUnique({ where: { id } });
    if (!payroll) throw new Error("Payroll not found");
    if (payroll.status === PrismaPayrollStatus.PAID)
      throw new Error("Payroll is already paid");
    if (payroll.status !== PrismaPayrollStatus.APPROVED)
      throw new Error("Only approved payroll can be marked as paid");

    return prisma.teacherPayroll.update({
      where: { id },
      data: {
        status: PrismaPayrollStatus.PAID,
        paidAt: new Date(),
        paidBy,
      },
      include: { items: true },
    });
  }

  /**
   * Get payroll summary for a teacher
   */
  static async getTeacherPayrollSummary(teacherId: string) {
    const payrolls = await prisma.teacherPayroll.findMany({
      where: { teacherId },
      include: { items: true },
    });

    let totalSalary = toDecimal(0);
    let totalRevenue = toDecimal(0);
    let paidCount = 0;
    let approvedCount = 0;

    for (const p of payrolls) {
      if (p.status === PrismaPayrollStatus.PAID) {
        totalSalary = totalSalary.add(p.salaryAmount);
        paidCount++;
      } else if (p.status === PrismaPayrollStatus.APPROVED) {
        approvedCount++;
      }
      totalRevenue = totalRevenue.add(p.totalRevenue);
    }

    return {
      totalSalary,
      totalRevenue,
      paidCount,
      approvedCount,
      payrollCount: payrolls.length,
    };
  }
}
