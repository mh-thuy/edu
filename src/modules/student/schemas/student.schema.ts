import { z } from "zod";

const birthdaySchema = z.union([
  z.string().datetime(),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid birthday format"),
]);

export const studentCreateSchema = z.object({
  fullName: z.string().min(1, "Full name is required").max(100),
  birthday: birthdaySchema.optional(),
  parentName: z.string().optional(),
  phone: z.string().max(50).optional(),
  address: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

export const studentUpdateSchema = studentCreateSchema.partial().extend({
  code: z.string().trim().min(1).max(50).optional(),
  birthday: birthdaySchema.nullable().optional(),
});

export const studentFilterSchema = z.object({
  search: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "ALL"]).optional(),
  excludeClassId: z.string().uuid().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(10),
});

export type StudentCreate = z.infer<typeof studentCreateSchema>;
export type StudentUpdate = z.infer<typeof studentUpdateSchema>;
export type StudentFilter = z.infer<typeof studentFilterSchema>;
