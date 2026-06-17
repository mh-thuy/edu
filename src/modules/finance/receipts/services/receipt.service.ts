import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { ReceiptFilter } from "@/modules/finance/receipts/schemas/receipt.schema";

export type ReceiptWithRelations = Prisma.ReceiptGetPayload<{
  include: {
    payment: {
      include: {
        studentFee: {
          include: {
            student: true;
            class: true;
          };
        };
      };
    };
  };
}>;

export class ReceiptService {
  /**
   * Get receipts with pagination and filtering
   */
  static async getReceipts(filter: ReceiptFilter) {
    const { page, limit, search, paymentId, studentId, classId, startDate, endDate, isPrinted } = filter;
    const skip = (page - 1) * limit;

    const where: Prisma.ReceiptWhereInput = {
      ...(paymentId && { paymentId }),
      ...(search && {
        OR: [
          {
            receiptNumber: {
              contains: search,
              mode: "insensitive",
            },
          },
          {
            payment: {
              studentFee: {
                student: {
                  code: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
              },
            },
          },
          {
            payment: {
              studentFee: {
                student: {
                  fullName: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
              },
            },
          },
          {
            payment: {
              studentFee: {
                class: {
                  code: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
              },
            },
          },
          {
            payment: {
              studentFee: {
                class: {
                  name: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
              },
            },
          },
        ],
      }),
      ...(studentId && {
        payment: {
          studentFee: {
            studentId,
          },
        },
      }),
      ...(classId && {
        payment: {
          studentFee: {
            classId,
          },
        },
      }),
      ...((startDate || endDate) && {
        issueDate: {
          ...(startDate && { gte: new Date(startDate) }),
          ...(endDate && { lte: new Date(endDate) }),
        },
      }),
      ...(isPrinted !== undefined && {
        printedAt: isPrinted ? { not: null } : null,
      }),
    };

    const [items, total] = await Promise.all([
      prisma.receipt.findMany({
        where,
        include: {
          payment: {
            include: {
              studentFee: {
                include: {
                  student: true,
                  class: true,
                },
              },
            },
          },
        },
        skip,
        take: limit,
        orderBy: { issueDate: "desc" },
      }),
      prisma.receipt.count({ where }),
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
   * Get single receipt by ID
   */
  static async getReceiptById(id: string): Promise<ReceiptWithRelations | null> {
    return prisma.receipt.findUnique({
      where: { id },
      include: {
        payment: {
          include: {
            studentFee: {
              include: {
                student: true,
                class: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Generate receipt for payment (moved from PaymentService)
   */
  static async generateReceipt(paymentId: string): Promise<ReceiptWithRelations> {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new Error("Payment not found");
    }

    // Check if receipt already exists
    const existing = await prisma.receipt.findUnique({
      where: { paymentId },
      include: {
        payment: {
          include: {
            studentFee: {
              include: {
                student: true,
                class: true,
              },
            },
          },
        },
      },
    });

    if (existing) {
      return existing;
    }

    // Generate unique receipt number
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
    const receiptNumber = `PT${timestamp}${random}`;

    return prisma.receipt.create({
      data: {
        paymentId,
        receiptNumber,
        issueDate: new Date(),
      },
      include: {
        payment: {
          include: {
            studentFee: {
              include: {
                student: true,
                class: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Mark receipt as printed
   */
  static async markAsPrinted(id: string): Promise<ReceiptWithRelations> {
    const receipt = await prisma.receipt.findUnique({ where: { id } });
    if (!receipt) {
      throw new Error("Receipt not found");
    }

    return prisma.receipt.update({
      where: { id },
      data: { printedAt: new Date() },
      include: {
        payment: {
          include: {
            studentFee: {
              include: {
                student: true,
                class: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Delete receipt (only if not printed)
   */
  static async deleteReceipt(id: string): Promise<void> {
    const receipt = await prisma.receipt.findUnique({ where: { id } });
    if (!receipt) {
      throw new Error("Receipt not found");
    }

    if (receipt.printedAt) {
      throw new Error("Cannot delete printed receipt");
    }

    await prisma.receipt.delete({ where: { id } });
  }
}
