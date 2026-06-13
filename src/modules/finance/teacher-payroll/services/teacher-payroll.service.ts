/* eslint-disable @typescript-eslint/no-explicit-any */

import { prisma } from "@/lib/prisma";
import type { TeacherPayrollFilter } from "@/modules/finance/teacher-payroll/schemas/teacher-payroll.schema";

export class TeacherPayrollService {
  /**
   * Calculate and create payroll for a teacher for a specific month
   * Only calculates based on actual collected payments
   */
  static async calculateMonthlyPayroll(teacherId: string, month: string) {
    // Get teacher's classes for this month (active classes)
    const classes = await prisma.class.findMany({
      where: {
        teacherId,
        status: "ACTIVE",
      },
      include: {
        classStudents: true,
        classSchedules: true,
        room: true,
      },
    });

    if (classes.length === 0) {
      // Create empty payroll
      return await prisma.teacherPayroll.upsert({
        where: { teacherId_month: { teacherId, month } },
        create: {
          teacherId,
          month,
          totalRevenue: 0,
          centerFee: 0,
          salaryAmount: 0,
          status: "draft",
        },
        update: {
          totalRevenue: 0,
          centerFee: 0,
          salaryAmount: 0,
        },
      });
    }

    let totalRevenue = 0;
    const items = [];

    // For each class, calculate revenue from actual collected payments
    for (const cls of classes) {
      // Get all students in this class
      const studentCount = cls.classStudents.length;

      if (studentCount === 0) continue;

      // Get class fee rule
      const rule = await prisma.classSalaryRule.findUnique({
        where: { classId: cls.id },
      });

      const commissionPercentage = rule?.commissionPercentage || 0;

      // Get all payments for students in this class for this month
      const startDate = new Date(`${month}-01`);
      const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);

      const payments = await prisma.payment.findMany({
        where: {
          paymentDate: {
            gte: startDate,
            lte: endDate,
          },
          studentFee: {
            classId: cls.id,
          },
        },
      });

      const classRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
      const centerFee = (classRevenue * commissionPercentage) / 100;
      const teacherSalary = classRevenue - centerFee;

      if (classRevenue > 0) {
        items.push({
          classId: cls.id,
          classCode: cls.code,
          studentCount,
          revenue: classRevenue,
          fee: centerFee,
          salary: teacherSalary,
        });
      }

      totalRevenue += classRevenue;
    }

    // Calculate total fees and salary
    const totalCenterFee = items.reduce((sum, item) => sum + item.fee, 0);
    const totalSalary = items.reduce((sum, item) => sum + item.salary, 0);

    // Create or update payroll
    const payroll = await prisma.teacherPayroll.upsert({
      where: { teacherId_month: { teacherId, month } },
      create: {
        teacherId,
        month,
        totalRevenue,
        centerFee: totalCenterFee,
        salaryAmount: totalSalary,
        status: "draft",
      },
      update: {
        totalRevenue,
        centerFee: totalCenterFee,
        salaryAmount: totalSalary,
      },
    });

    // Create or update payroll items
    // First, delete existing items for recalculation
    await prisma.teacherPayrollItem.deleteMany({
      where: { payrollId: payroll.id },
    });

    for (const item of items) {
      await prisma.teacherPayrollItem.create({
        data: {
          payrollId: payroll.id,
          classId: item.classId,
          classCode: item.classCode,
          studentCount: item.studentCount,
          revenue: item.revenue,
          fee: item.fee,
          salary: item.salary,
        },
      });
    }

    return payroll;
  }

  /**
   * Get payrolls with pagination and filtering
   */
  static async getPayrolls(filter: TeacherPayrollFilter) {
    const { page, limit, teacherId, month, status } = filter;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (teacherId) where.teacherId = teacherId;
    if (month) where.month = month;
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      prisma.teacherPayroll.findMany({
        where,
        include: {
          items: true,
        },
        skip,
        take: limit,
        orderBy: { month: "desc" },
      }),
      prisma.teacherPayroll.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
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
      },
    });
  }

  /**
   * Approve payroll (lock it, prevent recalculation)
   */
  static async approvePayroll(id: string) {
    const payroll = await prisma.teacherPayroll.findUnique({ where: { id } });
    if (!payroll) throw new Error("Payroll not found");
    if (payroll.status !== "draft") throw new Error("Only draft payroll can be approved");

    return prisma.teacherPayroll.update({
      where: { id },
      data: {
        status: "approved",
        approvedAt: new Date(),
      },
      include: { items: true },
    });
  }

  /**
   * Mark payroll as paid
   */
  static async markPayrollAsPaid(id: string) {
    const payroll = await prisma.teacherPayroll.findUnique({ where: { id } });
    if (!payroll) throw new Error("Payroll not found");
    if (payroll.status !== "approved") throw new Error("Only approved payroll can be marked as paid");

    return prisma.teacherPayroll.update({
      where: { id },
      data: {
        status: "paid",
        paidAt: new Date(),
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

    let totalSalary = 0;
    let totalRevenue = 0;
    let paidCount = 0;
    let approvedCount = 0;

    for (const p of payrolls) {
      if (p.status === "paid") {
        totalSalary += p.salaryAmount;
        paidCount++;
      } else if (p.status === "approved") {
        approvedCount++;
      }
      totalRevenue += p.totalRevenue;
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
