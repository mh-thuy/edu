import {
  PayrollStatus,
  type PayrollApiResponse,
  type PayrollListData,
  type PayrollQuery,
  type TeacherPayrollDto,
} from "@/modules/payroll/services/payroll.types";

function buildQueryString(query: PayrollQuery): string {
  const params = new URLSearchParams();
  params.set("page", String(query.page));
  params.set("pageSize", String(query.pageSize));

  if (query.teacherId) {
    params.set("teacherId", query.teacherId);
  }

  if (query.month) {
    params.set("month", query.month);
  }

  if (query.status) {
    params.set("status", query.status);
  }

  return params.toString();
}

async function request<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<PayrollApiResponse<T>> {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const result = (await response.json()) as PayrollApiResponse<T>;

  if (!response.ok || !result.success) {
    throw new Error(result.error?.message ?? "Payroll request failed");
  }

  return result;
}

export const payrollApi = {
  async list(query: PayrollQuery): Promise<PayrollListData<TeacherPayrollDto>> {
    const search = buildQueryString(query);
    const result = await request<PayrollListData<TeacherPayrollDto>>(
      `/api/teacher-payroll?${search}`,
    );
    return result.data;
  },

  async calculate(payload: {
    teacherId: string;
    month: string;
  }): Promise<TeacherPayrollDto> {
    const result = await request<TeacherPayrollDto>("/api/teacher-payroll", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    return result.data;
  },

  async approve(id: string): Promise<TeacherPayrollDto> {
    const result = await request<TeacherPayrollDto>(
      `/api/teacher-payroll/${id}/approve`,
      {
        method: "POST",
      },
    );

    return result.data;
  },

  async markPaid(id: string): Promise<TeacherPayrollDto> {
    const result = await request<TeacherPayrollDto>(
      `/api/teacher-payroll/${id}/mark-paid`,
      {
        method: "POST",
      },
    );

    return result.data;
  },

  statuses: PayrollStatus,
};
