import type { PrismaClient } from "@prisma/client";
import { faker } from "@faker-js/faker";
import { Decimal } from "@prisma/client/runtime/library";
import { pick } from "../helpers/random";
import type { StudentFeeFlow } from "../helpers/create-student-fee-flow";

export async function seedPayments(
  prisma: PrismaClient,
  input: {
    feeFlows: StudentFeeFlow[];
    userId: string;
  },
): Promise<void> {
  for (let i = 0; i < input.feeFlows.length; i += 1) {
    const flow = input.feeFlows[i];
    const mode = i % 10;

    if (mode < 3) {
      // 30% unpaid
      continue;
    }

    const fullAmount = new Decimal(flow.fee.finalAmount);

    if (mode < 7) {
      // 40% partial
      const partialAmount = fullAmount.div(2);

      const payment = await prisma.payment.create({
        data: {
          studentFeeId: flow.fee.id,
          paymentRequestId: flow.request.id,
          amount: partialAmount,
          method: pick(["CASH", "TRANSFER", "WALLET"]),
          paymentDate: new Date(),
          notes: "Seed partial payment",
          status: "CONFIRMED",
        },
      });

      await prisma.receipt.create({
        data: {
          paymentId: payment.id,
          receiptNumber: `RCPT-${faker.string.numeric(8)}`,
          issueDate: new Date(),
          status: "ACTIVE",
        },
      });

      await prisma.auditLog.create({
        data: {
          userId: input.userId,
          action: "CREATE_PAYMENT",
          tableName: "payments",
          recordId: payment.id,
          newData: {
            amount: payment.amount.toString(),
            status: "PARTIAL",
          },
        },
      });

      continue;
    }

    // 30% paid
    const payment = await prisma.payment.create({
      data: {
        studentFeeId: flow.fee.id,
        paymentRequestId: flow.request.id,
        amount: fullAmount,
        method: pick(["CASH", "TRANSFER", "WALLET"]),
        paymentDate: new Date(),
        notes: "Seed full payment",
        status: "CONFIRMED",
      },
    });

    await prisma.receipt.create({
      data: {
        paymentId: payment.id,
        receiptNumber: `RCPT-${faker.string.numeric(8)}`,
        issueDate: new Date(),
        status: "ACTIVE",
        createdBy: input.userId,
        updatedBy: input.userId,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: input.userId,
        action: "CREATE_PAYMENT_AND_RECEIPT",
        tableName: "payments",
        recordId: payment.id,
        newData: {
          amount: payment.amount.toString(),
          receiptCreated: true,
        },
      },
    });
  }
}
