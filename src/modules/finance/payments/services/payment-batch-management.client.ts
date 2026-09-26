import { extractApiErrorMessage, unwrapApiResponse } from "@/lib/api-client";

export type NoticeFeeStatus = "UNPAID" | "PARTIAL" | "OVERDUE";

export type NoticeFee = {
  id: string;
  feeNo: string;
  billingYear: number;
  billingMonth: number;
  finalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: NoticeFeeStatus;
  student: { id: string; code: string; fullName: string };
  class: { name: string };
  items: Array<{ itemName: string; amount: number }>;
  paymentAllocations?: Array<{
    paymentBatch: { id: string; batchNo: string; status: string };
  }>;
};

export type PendingBatch = {
  id: string;
  batchNo: string;
  totalAmount: number;
  paymentMethod: string;
  bankAccountId: string | null;
  student: { id: string; code: string; fullName: string };
  allocations: Array<{
    amount: number;
    tuitionFee: {
      id: string;
      feeNo: string;
      billingYear: number;
      billingMonth: number;
      class: { name: string } | null;
    };
  }>;
};

export type NoticeBankAccount = {
  id: string;
  bankName: string;
  accountNo: string;
  accountName: string;
};

type Paginated<T> = {
  items: T[];
  pagination?: { totalPages: number };
};

async function fetchAll<T>(
  endpoint: string,
  getPageEndpoint: (page: number) => string,
): Promise<T[]> {
  const firstResponse = await fetch(endpoint);
  if (!firstResponse.ok) {
    throw new Error(await extractApiErrorMessage(firstResponse, "Không thể tải dữ liệu"));
  }
  const first = await unwrapApiResponse<Paginated<T>>(firstResponse);
  const totalPages = first.pagination?.totalPages ?? 1;
  if (totalPages === 1) return first.items;
  const rest = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) =>
      fetch(getPageEndpoint(index + 2)).then(async (response) => {
        if (!response.ok) {
          throw new Error(await extractApiErrorMessage(response, "Không thể tải đủ dữ liệu"));
        }
        return unwrapApiResponse<Paginated<T>>(response);
      }),
    ),
  );
  return [first.items, ...rest.map((page) => page.items)].flat();
}

export async function fetchOutstandingFees(month: string) {
  const statuses: NoticeFeeStatus[] = ["UNPAID", "PARTIAL", "OVERDUE"];
  const results = await Promise.all(
    statuses.map((status) => {
      const query = `status=${status}&month=${encodeURIComponent(month)}&page=1&pageSize=100`;
      return fetchAll<NoticeFee>(
        `/api/tuition-fees?${query}`,
        (page) => `/api/tuition-fees?${status === "OVERDUE" ? "status=OVERDUE" : `status=${status}`}&month=${encodeURIComponent(month)}&page=${page}&pageSize=100`,
      );
    }),
  );
  return [...new Map(results.flat().map((fee) => [fee.id, fee])).values()];
}

export async function fetchPaymentBatches(status: "PENDING" | "SUCCESS") {
  return fetchAll<PendingBatch>(
    `/api/payment-batches?status=${status}&page=1&pageSize=100`,
    (page) => `/api/payment-batches?status=${status}&page=${page}&pageSize=100`,
  );
}

export async function fetchPendingBatches() {
  return fetchPaymentBatches("PENDING");
}

export async function fetchSuccessfulBatches() {
  return fetchPaymentBatches("SUCCESS");
}

export async function fetchNoticeBankAccounts() {
  const response = await fetch("/api/bank-accounts");
  if (!response.ok) {
    throw new Error(await extractApiErrorMessage(response, "Không thể tải tài khoản ngân hàng"));
  }
  return unwrapApiResponse<NoticeBankAccount[]>(response);
}

export async function issueNoticeBatches(input: {
  tuitionFeeIds: string[];
  mode: "GROUPED" | "SEPARATE";
  bankAccountId: string;
  idempotencyKey: string;
}) {
  const response = await fetch("/api/payment-batches/notice", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(await extractApiErrorMessage(response, "Không thể phát hành thông báo học phí"));
  }
  return unwrapApiResponse<{ batches: Array<{ id: string; batchNo: string; totalAmount: number }> }>(response);
}

export async function restructurePendingBatches(input:
  | { operation: "SPLIT"; sourceBatchId: string; reason: string; idempotencyKey: string }
  | { operation: "MERGE"; batchIds: string[]; reason: string; idempotencyKey: string },
) {
  const response = await fetch("/api/payment-batches/restructure", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(await extractApiErrorMessage(response, "Không thể tách hoặc gộp đợt thanh toán"));
  }
  return unwrapApiResponse<{ batches: Array<{ id: string; batchNo: string; totalAmount: number }> }>(response);
}
