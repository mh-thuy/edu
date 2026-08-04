import { z } from "zod";

const decimal = z.coerce.number().finite().nonnegative();

export const tuitionFeeUpdateSchema = z.object({
  discountAmount: decimal.optional(),
  additionalAmount: decimal.optional(),
  dueDate: z.string().date().nullable().optional(),
  note: z.string().trim().max(1000).nullable().optional(),
  version: z.number().int().positive(),
  reason: z.string().trim().min(1).max(500),
});

export const tuitionPaymentCreateSchema = z.object({
  tuitionFeeId: z.string().uuid(),
  paymentMethod: z.enum(["CASH", "BANK_TRANSFER", "OTHER"]),
  idempotencyKey: z.string().trim().min(8).max(150),
  paymentDate: z.string().datetime().optional(),
  bankAccountId: z.string().uuid().optional(),
  transactionReference: z.string().trim().max(150).optional(),
  payerName: z.string().trim().max(255).optional(),
  paymentContent: z.string().trim().max(500).optional(),
  note: z.string().trim().max(1000).optional(),
});

export type TuitionFeeUpdate = z.infer<typeof tuitionFeeUpdateSchema>;
export type TuitionPaymentCreate = z.infer<typeof tuitionPaymentCreateSchema>;
