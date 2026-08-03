import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/lib/errors";
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
  const existing = await prisma.bankAccount.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new NotFoundError("Không tìm thấy tài khoản ngân hàng");
  return prisma.bankAccount.update({ where: { id }, data: { ...data, ...(data.branchName !== undefined ? { branchName: data.branchName || null } : {}), updatedBy: actorId } });
}
