import { z } from "zod";

const feeStatusSchema = z.enum(["UNPAID", "PARTIAL", "PAID"]);

export const studentFeeCreateSchema = z.object({
  studentId: z.string().min(1, "Student is required"),
  classId: z.string().min(1, "Class is required"),
  month: z.string().regex(/^\d{4}-\d{2}$/, "Month must be in YYYY-MM format"),
  amount: z.number().positive("Amount must be positive"),
  dueDate: z.string().min(1, "Due date is required"),
});

export const studentFeeUpdateSchema = studentFeeCreateSchema.partial().extend({
  status: feeStatusSchema.optional(),
});

export const bulkCreateStudentFeesSchema = z.object({
  classId: z.string().min(1, "Class is required"),
  studentIds: z.array(z.string().min(1)).min(1, "At least one student is required"),
  month: z.string().regex(/^\d{4}-\d{2}$/, "Month must be in YYYY-MM format"),
  amount: z.number().positive("Amount must be positive"),
  dueDate: z.string().min(1, "Due date is required"),
  discount: z.number().min(0).default(0),
  note: z.string().optional(),
});

export const studentFeeFilterSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().default(10),
  search: z.string().optional(),
  status: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      // Support comma-separated values or single value.
      const statuses = val
        .split(",")
        .map((s) => s.trim().toUpperCase());
      return statuses.length === 1 ? statuses[0] : statuses;
    }),
  classId: z.string().optional(),
  studentId: z.string().optional(),
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
});

export type StudentFeeCreate = z.infer<typeof studentFeeCreateSchema>;
export type StudentFeeUpdate = z.infer<typeof studentFeeUpdateSchema>;
export type BulkCreateStudentFees = z.infer<typeof bulkCreateStudentFeesSchema>;
export type StudentFeeFilter = z.infer<typeof studentFeeFilterSchema>;
