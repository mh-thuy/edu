/* eslint-disable @typescript-eslint/no-explicit-any */

import { prisma } from "@/lib/prisma";
import { StudentFeeService } from "@/modules/finance/student-fees/services/student-fee.service";
import type {
  PaymentCreate,
  PaymentUpdate,
  PaymentFilter,
} from "@/modules/finance/payments/schemas/payment.schema";

export class PaymentService {
  /**
   * Create a payment
   */
  static async createPayment(data: PaymentCreate) {
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
    });

    // Update fee status
    await StudentFeeService.updateFeeStatus(data.studentFeeId);

    return payment;
  }

  /**
   * Get payments with pagination and filtering
   */
  static async getPayments(filter: PaymentFilter) {
    const { page, limit, studentFeeId, method, startDate, endDate } = filter;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (studentFeeId) where.studentFeeId = studentFeeId;
    if (method) where.method = method;
    if (startDate || endDate) {
      where.paymentDate = {};
      if (startDate) where.paymentDate.gte = new Date(startDate);
      if (endDate) where.paymentDate.lte = new Date(endDate);
    }

    const [items, total] = await Promise.all([
      prisma.payment.findMany({
        where,
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
      include: { receipts: true },
    });
  }

  /**
   * Update payment
   */
  static async updatePayment(id: string, data: PaymentUpdate) {
    const payment = await prisma.payment.findUnique({ where: { id } });
    if (!payment) throw new Error("Payment not found");

    // Check if receipt already issued (locked)
    const receipt = await prisma.receipt.findUnique({
      where: { paymentId: id },
    });
    if (receipt) {
      throw new Error("Cannot modify payment after receipt is issued");
    }

    const updated = await prisma.payment.update({
      where: { id },
      data,
    });

    // Update fee status if amount changed
    if (data.amount) {
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
    const where: any = {
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
      if (payment.method === 'cash' || payment.method === 'transfer' || payment.method === 'wallet') {
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
