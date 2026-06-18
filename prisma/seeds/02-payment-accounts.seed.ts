import type { PaymentAccount, PrismaClient } from "@prisma/client";

export async function seedPaymentAccounts(
  prisma: PrismaClient,
  userId: string,
): Promise<PaymentAccount[]> {
  const main = await prisma.paymentAccount.create({
    data: {
      code: "VCB_MAIN",
      bankCode: "VCB",
      bankName: "Vietcombank",
      accountNumber: "0123456789",
      accountName: "TRUNG TAM DAO TAO ABC",
      isDefault: true,
      isActive: true,
      createdBy: userId,
      updatedBy: userId,
    },
  });

  const backup = await prisma.paymentAccount.create({
    data: {
      code: "MOMO_MAIN",
      bankCode: "MOMO",
      bankName: "MoMo",
      accountNumber: "0988888888",
      accountName: "TRUNG TAM DAO TAO ABC",
      isDefault: false,
      isActive: true,
      createdBy: userId,
      updatedBy: userId,
    },
  });

  return [main, backup];
}
