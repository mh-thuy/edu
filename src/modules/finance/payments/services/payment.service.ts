import { prisma } from "@/lib/prisma";
import { sumDecimals, toDecimal } from "@/lib/decimal";
import { PaymentMethod, PaymentStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { ReceiptService } from "@/modules/finance/receipts/services/receipt.service";
import { StudentFeeService } from "@/modules/finance/student-fees/services/student-fee.service";
import type {
  PaymentCreate,
  PaymentFilter,
  PaymentUpdate,
} from "@/modules/finance/payments/schemas/payment.schema";

export type PaymentWithRelations = Prisma.PaymentGetPayload<{
  include: {
    receipt: true;
    studentFee: {
      include: {
        student: true;
        class: true;
        payments: true;
      };
    };
  };
}>;

type PaymentApiResponse = PaymentWithRelations & {
  receipts: NonNullable<PaymentWithRelations["receipt"]>[];
};

function withReceiptAlias(payment: PaymentWithRelations): PaymentApiResponse {
  return {
    ...payment,
    receipts: payment.receipt ? [payment.receipt] : [],
  };
}

function sumConfirmedPayments(
  payments: Array<{ amount: Prisma.Decimal; status: PaymentStatus }>,
) {
  return sumDecimals(
    payments
      .filter((payment) => payment.status === PaymentStatus.CONFIRMED)
      .map((payment) => payment.amount),
  );
}

export class PaymentService {
  private static parseBillingMonth(month: string): { billingYear: number; billingMonth: number } | null {
    const match = month.match(/^(\d{4})-(\d{2})$/);
    if (!match) return null;

    const billingYear = Number(match[1]);
    const billingMonth = Number(match[2]);
    if (billingMonth < 1 || billingMonth > 12) return null;

    return { billingYear, billingMonth };
  }

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
  static async createPayment(data: PaymentCreate): Promise<PaymentApiResponse> {
    return prisma.$transaction(async (tx) => {
      const fee = await tx.studentFee.findUnique({
        where: { id: data.studentFeeId },
        include: { payments: true },
      });

      if (!fee) throw new NotFoundError("Không tìm thấy học phí");

      const alreadyPaid = sumConfirmedPayments(fee.payments);
      const totalAfterPayment = alreadyPaid.add(data.amount);
      const netAmount = toDecimal(fee.amount).sub(fee.discount);

      if (totalAfterPayment.greaterThan(netAmount)) {
        throw new ConflictError(
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
          status: PaymentStatus.PENDING,
        },
        include: {
          receipt: true,
          studentFee: {
            include: {
              student: true,
              class: true,
              payments: true,
            },
          },
        },
      });

      return withReceiptAlias(payment);
    });
  }

  /**
   * Get payments with pagination and filtering
   */
  static async getPayments(filter: PaymentFilter) {
    const { page, pageSize, search, studentFeeId, method, startDate, endDate } = filter;
    const skip = (page - 1) * pageSize;
    const searchBilling = search ? this.parseBillingMonth(search) : null;

    const where: Prisma.PaymentWhereInput = {
      ...(search && {
        OR: [
          {
            notes: {
              contains: search,
              mode: "insensitive",
            },
          },
          ...(searchBilling
            ? [
                {
                  studentFee: {
                    billingYear: searchBilling.billingYear,
                    billingMonth: searchBilling.billingMonth,
                  },
                } satisfies Prisma.PaymentWhereInput,
              ]
            : []),
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
          receipt: true,
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
      items: items.map((payment) => withReceiptAlias(payment)),
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
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        receipt: true,
        studentFee: {
          include: {
            student: true,
            class: true,
            payments: true,
          },
        },
      },
    });

    return payment ? withReceiptAlias(payment) : null;
  }

  /**
   * Update payment
   */
  static async updatePayment(
    id: string,
    data: PaymentUpdate,
  ): Promise<PaymentApiResponse> {
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
    if (!payment) throw new NotFoundError("Không tìm thấy thanh toán");

    // Check if receipt already issued (locked)
    const receipt = await prisma.receipt.findFirst({
      where: { paymentId: id },
    });
    if (receipt) {
      throw new ConflictError("Không thể sửa thanh toán đã phát hành biên lai");
    }

    const nextAmount =
      data.amount !== undefined ? toDecimal(data.amount) : toDecimal(payment.amount);

    const paidExcludingCurrent = sumConfirmedPayments(
      payment.studentFee.payments.filter((item) => item.id !== id),
    );
    const netAmount = toDecimal(payment.studentFee.amount).sub(
      payment.studentFee.discount,
    );

    if (paidExcludingCurrent.add(nextAmount).greaterThan(netAmount)) {
      throw new ConflictError(
        `Payment exceeds outstanding amount. Outstanding: ${
          netAmount.sub(paidExcludingCurrent).toFixed(2)
        }, Payment: ${nextAmount}`,
      );
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.payment.update({
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
          receipt: true,
          studentFee: {
            include: {
              student: true,
              class: true,
              payments: true,
            },
          },
        },
      });

      return withReceiptAlias(updated);
    });
  }

  /**
   * Delete payment
   */
  static async deletePayment(id: string) {
    const payment = await prisma.payment.findUnique({ where: { id } });
    if (!payment) throw new NotFoundError("Không tìm thấy thanh toán");

    // Check if receipt already issued
    const receipt = await prisma.receipt.findFirst({
      where: { paymentId: id },
    });
    if (receipt) {
      throw new ConflictError("Không thể xóa thanh toán đã phát hành biên lai");
    }

    await prisma.$transaction(async (tx) => {
      await tx.payment.delete({ where: { id } });
    });
  }

  static async confirmPayment(id: string): Promise<PaymentApiResponse> {
    return prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id },
        include: {
          receipt: true,
          studentFee: {
            include: {
              student: true,
              class: true,
              payments: true,
            },
          },
        },
      });

      if (!payment) {
        throw new NotFoundError("Không tìm thấy thanh toán");
      }

      if (payment.status === PaymentStatus.CONFIRMED) {
        return withReceiptAlias(payment);
      }

      if (payment.status !== PaymentStatus.PENDING) {
        throw new ConflictError("Chỉ thanh toán PENDING mới được xác nhận");
      }

      await tx.payment.update({
        where: { id },
        data: {
          status: PaymentStatus.CONFIRMED,
          confirmedAt: new Date(),
        },
      });

      await StudentFeeService.syncFeeFinancialState(payment.studentFeeId, tx);
      await StudentFeeService.invalidateFlowArtifacts(payment.studentFeeId, tx);
      await ReceiptService.ensureReceiptForPayment(tx, id);

      const confirmed = await tx.payment.findUnique({
        where: { id },
        include: {
          receipt: true,
          studentFee: {
            include: {
              student: true,
              class: true,
              payments: true,
            },
          },
        },
      });

      if (!confirmed) {
        throw new NotFoundError("Không tìm thấy thanh toán");
      }

      return withReceiptAlias(confirmed);
    });
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
      status: PaymentStatus.CONFIRMED,
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
