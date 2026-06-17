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
  params.set("limit", String(query.limit));

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
    throw new Error(result.error ?? "Payroll request failed");
  }

  return result;
}

export const payrollApi = {
  async list(query: PayrollQuery): Promise<PayrollListData<TeacherPayrollDto>> {
    const search = buildQueryString(query);
    const result = await request<TeacherPayrollDto>(
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

    const first = result.data.items[0];
    if (!first) {
      throw new Error("Calculated payroll not found in response");
    }

    return first;
  },

  async approve(id: string): Promise<TeacherPayrollDto> {
    const result = await request<TeacherPayrollDto>(
      `/api/teacher-payroll/${id}/approve`,
      {
        method: "POST",
      },
    );

    const first = result.data.items[0];
    if (!first) {
      throw new Error("Approved payroll not found in response");
    }

    return first;
  },

  async markPaid(id: string): Promise<TeacherPayrollDto> {
    const result = await request<TeacherPayrollDto>(
      `/api/teacher-payroll/${id}/mark-paid`,
      {
        method: "POST",
      },
    );

    const first = result.data.items[0];
    if (!first) {
      throw new Error("Paid payroll not found in response");
    }

    return first;
  },

  statuses: PayrollStatus,
};
