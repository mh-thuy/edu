import { z } from "zod";

export const classRuleCreateSchema = z.object({
  classId: z.string().min(1, "Class is required"),
  commissionPercentage: z.number().min(0).max(100, "Percentage must be 0-100"),
});

export const classRuleUpdateSchema = classRuleCreateSchema.partial();

export const teacherPayrollFilterSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().default(10),
  teacherId: z.string().optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  status: z.enum(["draft", "approved", "paid"]).optional(),
});

export const teacherPayrollApproveSchema = z.object({
  payrollId: z.string().min(1, "Payroll ID is required"),
});

export const teacherPayrollPaySchema = z.object({
  payrollId: z.string().min(1, "Payroll ID is required"),
});

export type ClassRuleCreate = z.infer<typeof classRuleCreateSchema>;
export type ClassRuleUpdate = z.infer<typeof classRuleUpdateSchema>;
export type TeacherPayrollFilter = z.infer<typeof teacherPayrollFilterSchema>;
export type TeacherPayrollApprove = z.infer<typeof teacherPayrollApproveSchema>;
export type TeacherPayrollPay = z.infer<typeof teacherPayrollPaySchema>;
