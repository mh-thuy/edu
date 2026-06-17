import { z } from "zod";
import { PayrollStatus } from "@/modules/finance/teacher-payroll/payroll.types";

export const classRuleCreateSchema = z.object({
  classId: z.string().min(1, "Class is required"),
  commissionPercentage: z.number().min(0).max(100, "Percentage must be 0-100"),
});

export const classRuleUpdateSchema = classRuleCreateSchema.partial();

export const teacherPayrollCreateSchema = z.object({
  teacherId: z.string().min(1, "Teacher ID is required"),
  month: z.string().regex(/^\d{4}-\d{2}$/, "Month must be in format YYYY-MM"),
});

export const teacherPayrollUpdateSchema = z.object({
  totalRevenue: z.number().min(0, "Revenue cannot be negative").optional(),
  centerFee: z.number().min(0, "Fee cannot be negative").optional(),
  salaryAmount: z.number().min(0, "Salary cannot be negative").optional(),
  status: z.nativeEnum(PayrollStatus).optional(),
});

export const teacherPayrollFilterSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().default(10),
  teacherId: z.string().optional(),
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
  status: z.nativeEnum(PayrollStatus).optional(),
});

export const teacherPayrollApproveSchema = z.object({
  payrollId: z.string().min(1, "Payroll ID is required"),
});

export const teacherPayrollPaySchema = z.object({
  payrollId: z.string().min(1, "Payroll ID is required"),
});

export type ClassRuleCreate = z.infer<typeof classRuleCreateSchema>;
export type ClassRuleUpdate = z.infer<typeof classRuleUpdateSchema>;
export type TeacherPayrollCreate = z.infer<typeof teacherPayrollCreateSchema>;
export type TeacherPayrollUpdate = z.infer<typeof teacherPayrollUpdateSchema>;
export type TeacherPayrollFilter = z.infer<typeof teacherPayrollFilterSchema>;
export type TeacherPayrollApprove = z.infer<typeof teacherPayrollApproveSchema>;
export type TeacherPayrollPay = z.infer<typeof teacherPayrollPaySchema>;
