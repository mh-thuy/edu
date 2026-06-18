import { z } from "zod";

export const studentCreateSchema = z.object({
  code: z.string().min(1, "Student code is required").max(50),
  fullName: z.string().min(1, "Full name is required").max(100),
  birthday: z.string().datetime().optional(),
  parentName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

export const studentUpdateSchema = studentCreateSchema.partial();

export const studentFilterSchema = z.object({
  search: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(10),
});

export type StudentCreate = z.infer<typeof studentCreateSchema>;
export type StudentUpdate = z.infer<typeof studentUpdateSchema>;
export type StudentFilter = z.infer<typeof studentFilterSchema>;
