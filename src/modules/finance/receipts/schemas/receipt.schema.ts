import { z } from "zod";

export const receiptFilterSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().default(10),
  search: z.string().optional(),
  paymentId: z.string().optional(),
  studentId: z.string().optional(),
  classId: z.string().optional(),
  startDate: z.string().transform((val) => {
    if (!val) return undefined;
    return `${val}T00:00:00Z`;
  }).optional(),
  endDate: z.string().transform((val) => {
    if (!val) return undefined;
    return `${val}T23:59:59Z`;
  }).optional(),
  isPrinted: z.enum(["true", "false"]).transform(val => val === "true").optional(),
});

export const receiptCreateSchema = z.object({
  paymentId: z.string().min(1, "Payment ID is required"),
});

export const receiptUpdateSchema = z.object({
  printedAt: z.string().datetime().optional(),
});

export type ReceiptFilter = z.infer<typeof receiptFilterSchema>;
export type ReceiptCreate = z.infer<typeof receiptCreateSchema>;
export type ReceiptUpdate = z.infer<typeof receiptUpdateSchema>;
