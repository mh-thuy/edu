import { z } from "zod";

export const paymentBatchCreateSchema = z.object({
  tuitionFeeIds: z.array(z.string().uuid()).min(1).max(100),
  paymentMethod: z.enum(["CASH", "BANK_TRANSFER", "OTHER"]),
  bankAccountId: z.string().uuid().optional(),
  transactionReference: z.string().trim().max(150).optional(),
  payerName: z.string().trim().max(255).optional(),
  note: z.string().trim().max(1000).optional(),
});

export type PaymentBatchCreate = z.infer<typeof paymentBatchCreateSchema>;
