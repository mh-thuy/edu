import { prisma } from "@/lib/prisma";
import { PaymentStatus, Prisma } from "@prisma/client";
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
  private static buildReceiptPrefix(issueDate: Date): string {
    const year = issueDate.getFullYear();
    const month = String(issueDate.getMonth() + 1).padStart(2, "0");
    return `RC${year}${month}`;
  }

  private static async generateSequentialReceiptNumber(
    tx: Prisma.TransactionClient,
    issueDate: Date,
  ) {
    const prefix = this.buildReceiptPrefix(issueDate);
    const lastReceipt = await tx.receipt.findFirst({
      where: {
        receiptNumber: {
          startsWith: prefix,
        },
      },
      select: {
        receiptNumber: true,
      },
    });

    const lastSequence = lastReceipt
      ? Number(lastReceipt.receiptNumber.slice(prefix.length))
      : 0;
    const nextSequence = lastSequence + 1;

    return `${prefix}${String(nextSequence).padStart(4, "0")}`;
  }

  static async ensureReceiptForPayment(
    tx: Prisma.TransactionClient,
    paymentId: string,
  ): Promise<ReceiptWithRelations> {
    const payment = await tx.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new Error("Payment not found");
    }

    if (payment.status !== PaymentStatus.CONFIRMED) {
      throw new Error("Only confirmed payment can generate receipt");
    }

    const existing = await tx.receipt.findFirst({
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

    const issueDate = new Date();
    const receiptNumber = await this.generateSequentialReceiptNumber(
      tx,
      issueDate,
    );

    return tx.receipt.create({
      data: {
        paymentId,
        receiptNumber,
        issueDate,
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
   * Get receipts with pagination and filtering
   */
  static async getReceipts(filter: ReceiptFilter) {
    const { page, pageSize, search, paymentId, studentId, classId, startDate, endDate, isPrinted } = filter;
    const skip = (page - 1) * pageSize;

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
        take: pageSize,
        orderBy: { issueDate: "desc" },
      }),
      prisma.receipt.count({ where }),
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
    const maxRetries = 3;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await prisma.$transaction(
          async (tx) => this.ensureReceiptForPayment(tx, paymentId),
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          },
        );
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2034" &&
          attempt < maxRetries - 1
        ) {
          continue;
        }

        throw error;
      }
    }

    throw new Error("Failed to generate receipt");
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
