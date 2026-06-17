/* eslint-disable @typescript-eslint/no-explicit-any */

import { prisma } from "@/lib/prisma";
import type {
  StudentFeeUpdate,
  StudentFeeFilter,
} from "@/modules/finance/student-fees/schemas/student-fee.schema";

export class StudentFeeService {
  /**
   * Create a single student fee
   */
  static async createStudentFee(data: {
    studentId: string;
    classId: string;
    month: string;
    amount: number;
    dueDate: Date;
    status?: string;
  }) {
    // Check if fee already exists
    const existing = await prisma.studentFee.findUnique({
      where: {
        studentId_classId_month: {
          studentId: data.studentId,
          classId: data.classId,
          month: data.month,
        },
      },
    });

    if (existing) {
      throw new Error("Student fee already exists for this month");
    }

    return prisma.studentFee.create({
      data: {
        studentId: data.studentId,
        classId: data.classId,
        month: data.month,
        amount: data.amount,
        dueDate: data.dueDate,
        status: data.status || "unpaid",
      },
      include: {
        payments: true,
      },
    });
  }

  /**
   * Create student fees for all students in a class for a specific month
   */
  static async createBulkFeesForClass(
    classId: string,
    month: string,
    amount: number,
    discount: number,
    dueDate: Date,
    note?: string,
  ) {
    // Get all students in the class
    const classStudents = await prisma.classStudent.findMany({
      where: { classId },
      include: { student: true },
    });

    if (classStudents.length === 0) {
      return { created: 0, skipped: 0 };
    }

    let created = 0;
    let skipped = 0;

    for (const cs of classStudents) {
      try {
        // Check if fee already exists for this student/class/month
        const existing = await prisma.studentFee.findUnique({
          where: {
            studentId_classId_month: {
              studentId: cs.studentId,
              classId,
              month,
            },
          },
        });

        if (!existing) {
          await prisma.studentFee.create({
            data: {
              studentId: cs.studentId,
              classId,
              month,
              amount,
              discount,
              dueDate,
              status: "unpaid",
              note,
            },
          });
          created++;
        } else {
          skipped++;
        }
      } catch {
        skipped++;
      }
    }

    return { created, skipped };
  }

  /**
   * Get student fees with pagination and filtering
   */
  static async getStudentFees(filter: StudentFeeFilter) {
    const { page, limit, status, classId, studentId, month } = filter;
    const skip = (page - 1) * limit;

    const where: any = {};

    // Handle both single status and array of statuses
    if (status) {
      if (Array.isArray(status)) {
        where.status = { in: status };
      } else {
        where.status = status;
      }
    }

    if (classId) where.classId = classId;
    if (studentId) where.studentId = studentId;
    if (month) where.month = month;

    const [items, total] = await Promise.all([
      prisma.studentFee.findMany({
        where,
        include: {
          payments: true,
        },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.studentFee.count({ where }),
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
   * Get single student fee
   */
  static async getStudentFeeById(id: string) {
    return prisma.studentFee.findUnique({
      where: { id },
      include: {
        payments: true,
      },
    });
  }

  /**
   * Update student fee (e.g., change amount, due date)
   */
  static async updateStudentFee(id: string, data: StudentFeeUpdate) {
    return prisma.studentFee.update({
      where: { id },
      data,
      include: { payments: true },
    });
  }

  /**
   * Delete student fee (only if no payments yet)
   */
  static async deleteStudentFee(id: string) {
    const fee = await prisma.studentFee.findUnique({
      where: { id },
      include: { payments: { take: 1 } },
    });

    if (!fee) throw new Error("Student fee not found");
    if (fee.payments.length > 0)
      throw new Error("Cannot delete: payments already recorded");

    return prisma.studentFee.delete({ where: { id } });
  }

  /**
   * Calculate total debt for a student/class/month
   */
  static async calculateDebt(studentFeeId: string) {
    const fee = await prisma.studentFee.findUnique({
      where: { id: studentFeeId },
      include: { payments: true },
    });

    if (!fee) throw new Error("Student fee not found");

    const totalPaid = fee.payments.reduce((sum, p) => sum + p.amount, 0);
    const outstanding = fee.amount - totalPaid;

    return {
      totalAmount: fee.amount,
      totalPaid,
      outstanding,
      status: outstanding <= 0 ? "paid" : totalPaid > 0 ? "partial" : "unpaid",
    };
  }

  /**
   * Update fee status based on payments
   */
  static async updateFeeStatus(studentFeeId: string) {
    const debt = await this.calculateDebt(studentFeeId);
    await prisma.studentFee.update({
      where: { id: studentFeeId },
      data: { status: debt.status },
    });
  }

  /**
   * Get debt summary for a student
   */
  static async getStudentDebtSummary(studentId: string, classId?: string) {
    const where: any = { studentId };
    if (classId) where.classId = classId;

    const fees = await prisma.studentFee.findMany({
      where,
      include: { payments: true },
    });

    let totalDebt = 0;
    let totalPaid = 0;

    for (const fee of fees) {
      const paid = fee.payments.reduce((sum, p) => sum + p.amount, 0);
      totalPaid += paid;
      totalDebt += fee.amount;
    }

    return {
      totalFeeAmount: totalDebt,
      totalPaid,
      totalDebt: totalDebt - totalPaid,
      feeCount: fees.length,
      paidCount: fees.filter((f) => {
        const paid = f.payments.reduce((s, p) => s + p.amount, 0);
        return paid >= f.amount;
      }).length,
    };
  }
}
