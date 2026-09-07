import { z } from "zod";

export const bankStatementImportSchema = z.object({
  bankAccountId: z.string().uuid(),
});

export const bankReconciliationConfirmSchema = z
  .object({
    confirmationToken: z.string().min(1),
    tuitionFeeId: z.string().uuid().optional(),
    batchId: z.string().uuid().optional(),
  })
  .refine(
    (value) => (value.tuitionFeeId ? 1 : 0) + (value.batchId ? 1 : 0) === 1,
    { message: "Chọn đúng một khoản học phí hoặc một đợt thanh toán" },
  );

export type BankReconciliationConfirm = z.infer<
  typeof bankReconciliationConfirmSchema
>;
