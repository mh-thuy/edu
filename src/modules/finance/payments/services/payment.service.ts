import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { StudentFeeService } from "@/modules/finance/student-fees/services/student-fee.service";
import type {
  PaymentCreate,
  PaymentFilter,
} from "@/modules/finance/payments/schemas/payment.schema";

export type PaymentWithRelations = Prisma.PaymentGetPayload<{
  include: {
    receipts: true;
    studentFee: {
      include: {
        student: true;
        class: true;
        payments: true;
      };
    };
  };
}>;

export class PaymentService {
  /**
   * Create a payment
   */
  static async createPayment(data: PaymentCreate): Promise<PaymentWithRelations> {
    const fee = await prisma.studentFee.findUnique({
      where: { id: data.studentFeeId },
      include: { payments: true },
    });

    if (!fee) throw new Error("Student fee not found");

    // Calculate what's been paid already
    const alreadyPaid = fee.payments.reduce((sum, p) => sum + p.amount, 0);
    const totalAfterPayment = alreadyPaid + data.amount;

    // Don't allow overpayment (optional, adjust logic as needed)
    if (totalAfterPayment > fee.amount) {
      throw new Error(
        `Payment exceeds outstanding amount. Outstanding: ${fee.amount - alreadyPaid}, Payment: ${data.amount}`
      );
    }

    const payment = await prisma.payment.create({
      data: {
        studentFeeId: data.studentFeeId,
        amount: data.amount,
        method: data.method,
        paymentDate: new Date(data.paymentDate),
        notes: data.notes,
      },
      include: {
        receipts: true,
        studentFee: {
          include: {
            student: true,
            class: true,
            payments: true,
          },
        },
      },
    });

    // Update fee status
    await StudentFeeService.updateFeeStatus(data.studentFeeId);

    return payment;
  }

  /**
   * Get payments with pagination and filtering
   */
  static async getPayments(filter: PaymentFilter) {
    const { page, limit, search, studentFeeId, method, startDate, endDate } = filter;
    const skip = (page - 1) * limit;

    const where: Prisma.PaymentWhereInput = {
      ...(search && {
        OR: [
          {
            notes: {
              contains: search,
              mode: "insensitive",
            },
          },
          {
            studentFee: {
              month: {
                contains: search,
                mode: "insensitive",
              },
            },
          },
          {
            studentFee: {
              student: {
                code: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            },
          },
          {
            studentFee: {
              student: {
                fullName: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            },
          },
          {
            studentFee: {
              class: {
                code: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            },
          },
          {
            studentFee: {
              class: {
                name: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            },
          },
        ],
      }),
      ...(studentFeeId && { studentFeeId }),
      ...(method && { method }),
      ...((startDate || endDate) && {
        paymentDate: {
          ...(startDate && { gte: new Date(startDate) }),
          ...(endDate && { lte: new Date(endDate) }),
        },
      }),
    };

    const [items, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          receipts: true,
          studentFee: {
            include: {
              student: true,
              class: true,
              payments: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { paymentDate: "desc" },
      }),
      prisma.payment.count({ where }),
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
   * Get single payment
   */
  static async getPaymentById(id: string) {
    return prisma.payment.findUnique({
      where: { id },
      include: {
        receipts: true,
        studentFee: {
          include: {
            student: true,
            class: true,
            payments: true,
          },
        },
      },
    });
  }

  /**
   * Update payment
   */
  static async updatePayment(
    id: string,
    data: Prisma.PaymentUpdateInput,
  ): Promise<PaymentWithRelations> {
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        studentFee: {
          include: {
            payments: true,
          },
        },
      },
    });
    if (!payment) throw new Error("Payment not found");

    // Check if receipt already issued (locked)
    const receipt = await prisma.receipt.findUnique({
      where: { paymentId: id },
    });
    if (receipt) {
      throw new Error("Cannot modify payment after receipt is issued");
    }

    const nextAmount =
      typeof data.amount === "number" ? data.amount : payment.amount;

    const paidExcludingCurrent = payment.studentFee.payments.reduce(
      (sum, item) => (item.id === id ? sum : sum + item.amount),
      0,
    );

    if (paidExcludingCurrent + nextAmount > payment.studentFee.amount) {
      throw new Error(
        `Payment exceeds outstanding amount. Outstanding: ${
          payment.studentFee.amount - paidExcludingCurrent
        }, Payment: ${nextAmount}`,
      );
    }

    const updated = await prisma.payment.update({
      where: { id },
      data,
      include: {
        receipts: true,
        studentFee: {
          include: {
            student: true,
            class: true,
            payments: true,
          },
        },
      },
    });

    // Update fee status if amount changed
    if (typeof data.amount === "number") {
      await StudentFeeService.updateFeeStatus(payment.studentFeeId);
    }

    return updated;
  }

  /**
   * Delete payment
   */
  static async deletePayment(id: string) {
    const payment = await prisma.payment.findUnique({ where: { id } });
    if (!payment) throw new Error("Payment not found");

    // Check if receipt already issued
    const receipt = await prisma.receipt.findUnique({
      where: { paymentId: id },
    });
    if (receipt) {
      throw new Error("Cannot delete payment: receipt already issued");
    }

    await prisma.payment.delete({ where: { id } });

    // Update fee status
    await StudentFeeService.updateFeeStatus(payment.studentFeeId);
  }

  /**
   * Generate receipt for payment
   */
  static async generateReceipt(paymentId: string) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) throw new Error("Payment not found");

    // Check if receipt already exists
    const existing = await prisma.receipt.findUnique({
      where: { paymentId },
    });

    if (existing) {
      return existing;
    }

    // Generate receipt number (simple format: RCP-{timestamp-based})
    const timestamp = Date.now();
    const receiptNumber = `RCP-${timestamp}`;

    return prisma.receipt.create({
      data: {
        paymentId,
        receiptNumber,
        issueDate: new Date(),
      },
    });
  }

  /**
   * Get revenue summary for a period
   */
  static async getRevenueSummary(
    startDate: Date,
    endDate: Date,
    classId?: string
  ) {
    const where: Prisma.PaymentWhereInput = {
      paymentDate: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (classId) {
      where.studentFee = {
        classId,
      };
    }

    const payments = await prisma.payment.findMany({
      where,
      include: {
        studentFee: true,
      },
    });

    const methodSummary = {
      cash: 0,
      transfer: 0,
      wallet: 0,
    };

    let totalRevenue = 0;

    for (const payment of payments) {
      if (payment.method === "cash" || payment.method === "transfer" || payment.method === "wallet") {
        methodSummary[payment.method] += payment.amount;
      }
      totalRevenue += payment.amount;
    }

    return {
      totalRevenue,
      paymentCount: payments.length,
      methodSummary,
      payments,
    };
  }
}
