import { prisma } from "@/lib/prisma";
import { sumDecimals, toDecimal } from "@/lib/decimal";
import type { FeeStatus, Prisma } from "@prisma/client";
import type {
  StudentFeeFilter,
} from "@/modules/finance/student-fees/schemas/student-fee.schema";

export type StudentFeeWithRelations = Prisma.StudentFeeGetPayload<{
  include: {
    student: true;
    class: true;
    payments: true;
  };
}>;

function parseBillingMonth(month: string): { billingYear: number; billingMonth: number } {
  const [yearString, monthString] = month.split("-");
  const billingYear = Number(yearString);
  const billingMonth = Number(monthString);

  if (
    !Number.isInteger(billingYear) ||
    !Number.isInteger(billingMonth) ||
    billingMonth < 1 ||
    billingMonth > 12
  ) {
    throw new Error("Month must be in YYYY-MM format");
  }

  return { billingYear, billingMonth };
}

export class StudentFeeService {
  private static getClient(
    tx?: Prisma.TransactionClient,
  ): Prisma.TransactionClient | typeof prisma {
    return tx ?? prisma;
  }

  /**
   * Create a single student fee
   */
  static async createStudentFee(data: {
    studentId: string;
    classId: string;
    month: string;
    amount: number;
    discount?: number;
    dueDate: Date;
    status?: FeeStatus;
  }): Promise<StudentFeeWithRelations> {
    const { billingYear, billingMonth } = parseBillingMonth(data.month);

    // Check if fee already exists
    const existing = await prisma.studentFee.findFirst({
      where: {
        studentId: data.studentId,
        classId: data.classId,
        billingYear,
        billingMonth,
      },
    });

    if (existing) {
      throw new Error("Student fee already exists for this month");
    }

    const tuitionAmount = data.amount ? toDecimal(data.amount) : toDecimal(0);
    const discountAmount = data.discount ? toDecimal(data.discount) : toDecimal(0);
    const finalAmount = tuitionAmount.minus(discountAmount);

    return prisma.studentFee.create({
      data: {
        studentId: data.studentId,
        classId: data.classId,
        billingYear,
        billingMonth,
        amount: tuitionAmount.toNumber(),
        discount: discountAmount.toNumber(),
        dueDate: data.dueDate,
        status: data.status || "UNPAID",
        finalAmount: finalAmount.toNumber(),
        outstandingAmount: finalAmount.toNumber(),
      },
      include: {
        student: true,
        class: true,
        payments: true,
      },
    });
  }

  /**
   * Create student fees for all students in a class for a specific month
   */
  static async createBulkFeesForClass(
    data: {
      classId: string;
      studentIds: string[];
      month: string;
      amount: number;
      discount?: number;
      dueDate: Date;
      note?: string;
    },
  ) {
    const { billingYear, billingMonth } = parseBillingMonth(data.month);

    return prisma.$transaction(async (tx) => {
      const classStudents = await tx.classStudent.findMany({
        where: {
          classId: data.classId,
          studentId: { in: data.studentIds },
        },
        select: { studentId: true },
      });

      if (classStudents.length === 0) {
        return { created: 0, skipped: 0 };
      }

      const existingFees = await tx.studentFee.findMany({
        where: {
          classId: data.classId,
          billingYear,
          billingMonth,
          studentId: {
            in: classStudents.map((cs) => cs.studentId),
          },
        },
        select: {
          studentId: true,
        },
      });

      const existingStudentIds = new Set(
        existingFees.map((fee) => fee.studentId),
      );
      const feesToCreate = classStudents
        .filter((cs) => !existingStudentIds.has(cs.studentId))
        .map((cs) => ({
          studentId: cs.studentId,
          classId: data.classId,
          billingYear,
          billingMonth,
          amount: data.amount,
          discount: data.discount,
          finalAmount: data.amount - (data.discount ?? 0),
          paidAmount: 0,
          outstandingAmount: data.amount - (data.discount ?? 0),
          dueDate: data.dueDate,
          status: "UNPAID" as FeeStatus,
          note: data.note,
        }));

      if (feesToCreate.length > 0) {
        await tx.studentFee.createMany({
          data: feesToCreate,
        });
      }

      return {
        created: feesToCreate.length,
        skipped: classStudents.length - feesToCreate.length,
      };
    });
  }

  private static async calculateDebtWithClient(
    studentFeeId: string,
    tx?: Prisma.TransactionClient,
  ) {
    const db = this.getClient(tx);
    const fee = await db.studentFee.findUnique({
      where: { id: studentFeeId },
      include: { payments: true },
    });

    if (!fee) throw new Error("Student fee not found");

    const totalPaid = sumDecimals(fee.payments.map((payment) => payment.amount));
    const netAmount = toDecimal(fee.amount).sub(fee.discount);
    const outstanding = netAmount.sub(totalPaid);

    const status: FeeStatus =
      outstanding.lte(0) ? "PAID" : totalPaid.gt(0) ? "PARTIAL" : "UNPAID";

    return {
      totalAmount: netAmount,
      totalPaid,
      outstanding,
      status,
    };
  }

  /**
   * Calculate total debt for a student/class/month
   */
  static async calculateDebt(studentFeeId: string) {
    return this.calculateDebtWithClient(studentFeeId);
  }

  /**
   * Update fee status based on payments
   */
  static async updateFeeStatus(
    studentFeeId: string,
    tx?: Prisma.TransactionClient,
  ) {
    const db = this.getClient(tx);
    const debt = await this.calculateDebtWithClient(studentFeeId, tx);
    await db.studentFee.update({
      where: { id: studentFeeId },
      data: { status: debt.status },
    });
  }

  /**
   * Get student fees with pagination and filtering
   */
  static async getStudentFees(filter: StudentFeeFilter) {
    const { page, pageSize, search, status, classId, studentId, month } = filter;
    const skip = (page - 1) * pageSize;
    const billing = month ? parseBillingMonth(month) : undefined;
    const searchBilling =
      search && /^\d{4}-\d{2}$/.test(search) ? parseBillingMonth(search) : undefined;

    const where: Prisma.StudentFeeWhereInput = {
      ...(search && {
        OR: [
          {
            student: {
              code: { contains: search, mode: "insensitive" },
            },
          },
          {
            student: {
              fullName: { contains: search, mode: "insensitive" },
            },
          },
          {
            class: {
              code: { contains: search, mode: "insensitive" },
            },
          },
          {
            class: {
              name: { contains: search, mode: "insensitive" },
            },
          },
          ...(searchBilling
            ? [
                {
                  billingYear: searchBilling.billingYear,
                  billingMonth: searchBilling.billingMonth,
                } satisfies Prisma.StudentFeeWhereInput,
              ]
            : []),
        ],
      }),
    };

    // Handle both single status and array of statuses
    if (status) {
      if (Array.isArray(status)) {
        where.status = { in: status as FeeStatus[] };
      } else {
        where.status = status as FeeStatus;
      }
    }

    if (classId) where.classId = classId;
    if (studentId) where.studentId = studentId;
    if (billing) {
      where.billingYear = billing.billingYear;
      where.billingMonth = billing.billingMonth;
    }

    const [items, total] = await Promise.all([
      prisma.studentFee.findMany({
        where,
        include: {
          student: true,
          class: true,
          payments: true,
        },
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      prisma.studentFee.count({ where }),
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
   * Get single student fee
   */
  static async getStudentFeeById(id: string) {
    return prisma.studentFee.findUnique({
      where: { id },
      include: {
        student: true,
        class: true,
        payments: true,
      },
    });
  }

  /**
   * Update student fee (e.g., change amount, due date)
   */
  static async updateStudentFee(
    id: string,
    data: Prisma.StudentFeeUpdateInput,
  ) {
    return prisma.studentFee.update({
      where: { id },
      data,
      include: { student: true, class: true, payments: true },
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
   * Get debt summary for a student
   */
  static async getStudentDebtSummary(studentId: string, classId?: string) {
    const where: Prisma.StudentFeeWhereInput = {
      studentId,
      ...(classId && { classId }),
    };

    const fees = await prisma.studentFee.findMany({
      where,
      include: { payments: true },
    });

    let totalFeeAmount = toDecimal(0);
    let totalPaid = toDecimal(0);

    for (const fee of fees) {
      const paid = sumDecimals(fee.payments.map((payment) => payment.amount));
      totalPaid = totalPaid.add(paid);
      totalFeeAmount = totalFeeAmount.add(toDecimal(fee.amount).sub(fee.discount));
    }

    return {
      totalFeeAmount,
      totalPaid,
      totalDebt: totalFeeAmount.sub(totalPaid),
      feeCount: fees.length,
      paidCount: fees.filter((f) => {
        const paid = sumDecimals(f.payments.map((payment) => payment.amount));
        return paid.greaterThanOrEqualTo(toDecimal(f.amount).sub(f.discount));
      }).length,
    };
  }
}
