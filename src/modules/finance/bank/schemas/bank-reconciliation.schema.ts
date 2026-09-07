import { z } from "zod";

export const bankStatementImportSchema = z.object({
  bankAccountId: z.string().uuid(),
});

export const bankReconciliationConfirmSchema = z.object({
  confirmationToken: z.string().min(1),
  batchId: z.string().uuid(),
});

export type BankReconciliationConfirm = z.infer<
  typeof bankReconciliationConfirmSchema
>;
