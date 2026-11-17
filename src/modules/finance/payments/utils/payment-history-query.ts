export type PaymentHistoryQuery = {
  transactionCode: string;
  studentId: string;
  studentCode: string;
  studentName: string;
  status: string;
  page: number;
  pageSize: number;
};

const PAGE_SIZES = [10, 20, 50, 100];
const DEFAULT_PAGE_SIZE = 20;

export function parsePaymentHistoryQuery(params: URLSearchParams): PaymentHistoryQuery {
  const page = Number(params.get("page") ?? 0);
  const pageSize = Number(params.get("pageSize") ?? DEFAULT_PAGE_SIZE);
  return {
    transactionCode: params.get("transactionCode") ?? "",
    studentId: params.get("studentId") ?? "",
    studentCode: params.get("studentCode") ?? "",
    studentName: params.get("studentName") ?? "",
    status: params.get("status") ?? "",
    page: Number.isInteger(page) && page >= 0 ? page : 0,
    pageSize: PAGE_SIZES.includes(pageSize) ? pageSize : DEFAULT_PAGE_SIZE,
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
