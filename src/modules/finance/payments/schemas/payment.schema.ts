import { z } from "zod";

const paymentDateSchema = z
  .string()
  .min(1, "Payment date is required")
  .refine((value) => !Number.isNaN(Date.parse(value)), "Invalid date format");

export const paymentCreateSchema = z.object({
  studentFeeId: z.string().min(1, "Student fee is required"),
  amount: z.number().positive("Amount must be greater than 0"),
  method: z.enum(["cash", "transfer", "wallet"], {
    errorMap: () => ({ message: "Method must be cash, transfer, or wallet" }),
  }),
  paymentDate: paymentDateSchema,
  notes: z.string().optional(),
});

export const paymentUpdateSchema = z.object({
  amount: z.number().positive("Amount must be greater than 0").optional(),
  method: z
    .enum(["cash", "transfer", "wallet"], {
      errorMap: () => ({ message: "Method must be cash, transfer, or wallet" }),
    })
    .optional(),
  paymentDate: paymentDateSchema.optional(),
  notes: z.string().optional(),
});

export const paymentFilterSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().default(10),
  search: z.string().optional(),
  studentFeeId: z.string().optional(),
  method: z.enum(["cash", "transfer", "wallet"]).optional(),
  startDate: z.string().transform((val) => {
    if (!val) return undefined;
    // Accept YYYY-MM-DD or full ISO datetime format
    return `${val}T00:00:00Z`;
  }).optional(),
  endDate: z.string().transform((val) => {
    if (!val) return undefined;
    // Accept YYYY-MM-DD or full ISO datetime format  
    return `${val}T23:59:59Z`;
  }).optional(),
});

export type PaymentCreate = z.infer<typeof paymentCreateSchema>;
export type PaymentUpdate = z.infer<typeof paymentUpdateSchema>;
export type PaymentFilter = z.infer<typeof paymentFilterSchema>;
