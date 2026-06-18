import {
  PayrollStatus,
  type PayrollApiResponse,
  type PayrollListData,
  type TeacherPayrollDto,
  type TeacherPayrollItemDto,
} from "@/modules/finance/teacher-payroll/payroll.types";

export type {
  PayrollApiResponse,
  PayrollListData,
  TeacherPayrollDto,
  TeacherPayrollItemDto,
};

export { PayrollStatus };

export interface PayrollQuery {
  page: number;
  pageSize: number;
  teacherId?: string;
  month?: string;
  status?: PayrollStatus;
}
