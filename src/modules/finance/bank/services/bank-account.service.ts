import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError } from "@/lib/errors";
import type { BankAccountCreate, BankAccountUpdate } from "../schemas/bank-account.schema";

export function listBankAccounts(includeInactive = false) {
  return prisma.bankAccount.findMany({
    where: includeInactive ? undefined : { isActive: true },
    orderBy: [{ isActive: "desc" }, { bankName: "asc" }, { accountNo: "asc" }],
  });
}

export function createBankAccount(data: BankAccountCreate, actorId: string) {
  return prisma.bankAccount.create({ data: { ...data, branchName: data.branchName || null, createdBy: actorId, updatedBy: actorId } });
}

export async function updateBankAccount(id: string, data: BankAccountUpdate, actorId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      SELECT id FROM bank_accounts WHERE id = ${id}::uuid FOR UPDATE
    `;
    const existing = await tx.bankAccount.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundError("Không tìm thấy tài khoản ngân hàng");

    const pendingBatch = await tx.paymentBatch.findFirst({
      where: { bankAccountId: id, status: "PENDING" },
      select: { batchNo: true },
    });
    if (pendingBatch && data.isActive === false) {
      throw new ConflictError(
        `Không thể ngưng tài khoản đang gắn với đợt thanh toán ${pendingBatch.batchNo}`,
      );
    }
    if (
      pendingBatch &&
      [
        "bankCode",
        "bankName",
        "accountNo",
        "accountName",
        "branchName",
        "currencyCode",
      ].some((field) => data[field as keyof BankAccountUpdate] !== undefined)
    ) {
      throw new ConflictError(
        `Không thể thay đổi thông tin tài khoản đang gắn với đợt thanh toán ${pendingBatch.batchNo}`,
      );
    }

    return tx.bankAccount.update({
      where: { id },
      data: {
        ...data,
        ...(data.branchName !== undefined
          ? { branchName: data.branchName || null }
          : {}),
        updatedBy: actorId,
      },
    });
  });
}
