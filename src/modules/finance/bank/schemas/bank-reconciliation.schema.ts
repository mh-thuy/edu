import { z } from "zod";

export const bankStatementImportSchema = z.object({
  bankAccountId: z.string().uuid(),
});

export const bankReconciliationConfirmSchema = z.object({
  confirmationToken: z.string().min(1),
  batchId: z.string().uuid(),
});

export const bankReconciliationBulkConfirmSchema = z.object({
  confirmations: z
    .array(bankReconciliationConfirmSchema)
    .min(1)
    .max(100),
});

export type BankReconciliationConfirm = z.infer<
  typeof bankReconciliationConfirmSchema
>;

export type BankReconciliationBulkConfirm = z.infer<
  typeof bankReconciliationBulkConfirmSchema
>;
