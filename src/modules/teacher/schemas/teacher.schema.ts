import { z } from "zod";

export const teacherCreateSchema = z.object({
  code: z.string().min(1, "Teacher code is required").max(50),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  bankAccount: z.string().optional(),
  specialty: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

export const teacherUpdateSchema = teacherCreateSchema.partial();

export const teacherFilterSchema = z.object({
  search: z.string().optional(),
  status: z.string().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(10),
});

export type TeacherCreate = z.infer<typeof teacherCreateSchema>;
export type TeacherUpdate = z.infer<typeof teacherUpdateSchema>;
export type TeacherFilter = z.infer<typeof teacherFilterSchema>;
