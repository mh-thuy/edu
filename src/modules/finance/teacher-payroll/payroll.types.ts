export enum PayrollStatus {
  DRAFT = "draft",
  APPROVED = "approved",
  PAID = "paid",
}

export interface TeacherPayrollItemDto {
  id: string;
  classId: string;
  classCode: string;
  studentCount: number;
  revenue: number;
  fee: number;
  salary: number;
}

export interface TeacherPayrollDto {
  id: string;
  teacherId: string;
  month: string;
  totalRevenue: number;
  centerFee: number;
  salaryAmount: number;
  status: PayrollStatus;
  approvedAt: string | null;
  approvedBy: string | null;
  paidAt: string | null;
  paidBy: string | null;
  items?: TeacherPayrollItemDto[];
  teacher?: {
    id: string;
    code: string;
    user?: {
      fullName: string;
    } | null;
  };
  createdAt: string;
  updatedAt: string;
}

export interface PayrollListData<T> {
  items: T[];
  total: number;
  page?: number;
  limit?: number;
  pages?: number;
}

export interface PayrollApiResponse<T> {
  success: boolean;
  data: PayrollListData<T>;
  error?: string;
}

const currencyFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
});

export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}
