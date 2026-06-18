import { prisma } from "@/lib/prisma";
import { sumDecimals, toDecimal } from "@/lib/decimal";
import { PaymentMethod } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { ReceiptService } from "@/modules/finance/receipts/services/receipt.service";
import { StudentFeeService } from "@/modules/finance/student-fees/services/student-fee.service";
import type {
  PaymentCreate,
  PaymentFilter,
  PaymentUpdate,
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
  private static toPaymentMethod(method: PaymentCreate["method"]): PaymentMethod {
    switch (method) {
      case "cash":
        return PaymentMethod.CASH;
      case "transfer":
        return PaymentMethod.TRANSFER;
      case "wallet":
        return PaymentMethod.WALLET;
    }
  }

  /**
   * Create a payment
   */
  static async createPayment(data: PaymentCreate): Promise<PaymentWithRelations> {
    return prisma.$transaction(async (tx) => {
      const fee = await tx.studentFee.findUnique({
        where: { id: data.studentFeeId },
        include: { payments: true },
      });

      if (!fee) throw new Error("Student fee not found");

      const alreadyPaid = sumDecimals(fee.payments.map((payment) => payment.amount));
      const totalAfterPayment = alreadyPaid.add(data.amount);
      const netAmount = toDecimal(fee.amount).sub(fee.discount);

      if (totalAfterPayment.greaterThan(netAmount)) {
        throw new Error(
          `Payment exceeds outstanding amount. Outstanding: ${netAmount.sub(alreadyPaid).toFixed(2)}, Payment: ${data.amount}`
        );
      }

      const payment = await tx.payment.create({
        data: {
          studentFeeId: data.studentFeeId,
          amount: data.amount,
          method: this.toPaymentMethod(data.method),
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

      await StudentFeeService.updateFeeStatus(data.studentFeeId, tx);

      return payment;
    });
  }

  /**
   * Get payments with pagination and filtering
   */
  static async getPayments(filter: PaymentFilter) {
    const { page, pageSize, search, studentFeeId, method, startDate, endDate } = filter;
    const skip = (page - 1) * pageSize;

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
      ...(method && { method: this.toPaymentMethod(method) }),
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
        take: pageSize,
        orderBy: { paymentDate: "desc" },
      }),
      prisma.payment.count({ where }),
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
    data: PaymentUpdate,
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
      data.amount !== undefined ? toDecimal(data.amount) : toDecimal(payment.amount);

    const paidExcludingCurrent = payment.studentFee.payments.reduce(
      (sum, item) => (item.id === id ? sum : sum.add(item.amount)),
      toDecimal(0),
    );
    const netAmount = toDecimal(payment.studentFee.amount).sub(
      payment.studentFee.discount,
    );

    if (paidExcludingCurrent.add(nextAmount).greaterThan(netAmount)) {
      throw new Error(
        `Payment exceeds outstanding amount. Outstanding: ${
          netAmount.sub(paidExcludingCurrent).toFixed(2)
        }, Payment: ${nextAmount}`,
      );
    }

    const updated = await prisma.payment.update({
      where: { id },
      data: {
        ...(data.amount !== undefined && { amount: data.amount }),
        ...(data.method !== undefined && {
          method: this.toPaymentMethod(data.method),
        }),
        ...(data.paymentDate !== undefined && {
          paymentDate: new Date(data.paymentDate),
        }),
        ...(data.notes !== undefined && { notes: data.notes }),
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
    return ReceiptService.generateReceipt(paymentId);
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
      cash: toDecimal(0),
      transfer: toDecimal(0),
      wallet: toDecimal(0),
    };

    let totalRevenue = toDecimal(0);

    for (const payment of payments) {
      if (payment.method === PaymentMethod.CASH) {
        methodSummary.cash = methodSummary.cash.add(payment.amount);
      } else if (payment.method === PaymentMethod.TRANSFER) {
        methodSummary.transfer = methodSummary.transfer.add(payment.amount);
      } else if (payment.method === PaymentMethod.WALLET) {
        methodSummary.wallet = methodSummary.wallet.add(payment.amount);
      }
      totalRevenue = totalRevenue.add(payment.amount);
    }

    return {
      totalRevenue,
      paymentCount: payments.length,
      methodSummary,
      payments,
    };
  }
}
