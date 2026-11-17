export type PaymentHistoryQuery = {
  transactionCode: string;
  studentId: string;
  studentCode: string;
  studentName: string;
  status: string;
  page: number;
  pageSize: number;
};

import { DEFAULT_PAGE_SIZE, parsePageParams } from "@/lib/list-page-params";

export function parsePaymentHistoryQuery(params: URLSearchParams): PaymentHistoryQuery {
  return {
    transactionCode: params.get("transactionCode") ?? "",
    studentId: params.get("studentId") ?? "",
    studentCode: params.get("studentCode") ?? "",
    studentName: params.get("studentName") ?? "",
    status: params.get("status") ?? "",
    ...parsePageParams(params),
  };
}

export function serializePaymentHistoryQuery(query: PaymentHistoryQuery): URLSearchParams {
  const params = new URLSearchParams();
  const text: Array<[string, string]> = [
    ["transactionCode", query.transactionCode],
    ["studentId", query.studentId],
    ["studentCode", query.studentCode],
    ["studentName", query.studentName],
    ["status", query.status],
  ];
  for (const [key, value] of text) if (value) params.set(key, value);
  if (query.page > 0) params.set("page", String(query.page));
  if (query.pageSize !== DEFAULT_PAGE_SIZE) params.set("pageSize", String(query.pageSize));
  return params;
}
