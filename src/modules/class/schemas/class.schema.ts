import { z } from "zod";

export const classCreateSchema = z.object({
  code: z.string().min(1, "Class code is required").max(50),
  name: z.string().min(1, "Class name is required").max(100),
  teacherId: z.string().optional().nullable(),
  roomId: z.string().optional().nullable(),
  tuitionFee: z.number().min(0).default(0),
  totalSessions: z.number().min(0).default(0),
  maxStudents: z.number().min(1).default(30),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "COMPLETED", "CANCELLED"]).default("DRAFT"),
});

export const classUpdateSchema = classCreateSchema.partial();

export const classFilterSchema = z.object({
  search: z.string().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "COMPLETED", "CANCELLED"]).optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(10),
});

export const classStudentSchema = z.object({
  classId: z.string(),
  studentId: z.string(),
});

export type ClassCreate = z.infer<typeof classCreateSchema>;
export type ClassUpdate = z.infer<typeof classUpdateSchema>;
export type ClassFilter = z.infer<typeof classFilterSchema>;
export type ClassStudent = z.infer<typeof classStudentSchema>;
