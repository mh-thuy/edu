export type TuitionListQuery = {
  studentId: string;
  studentCode: string;
  studentName: string;
  classId: string;
  classCode: string;
  className: string;
  status: string;
  billingType: string;
  billingMonth: string;
  page: number;
  pageSize: number;
};

const PAGE_SIZES = [10, 20, 50, 100];
const DEFAULT_PAGE_SIZE = 20;

export function parseTuitionListQuery(params: URLSearchParams): TuitionListQuery {
  const page = Number(params.get("page") ?? 0);
  const pageSize = Number(params.get("pageSize") ?? DEFAULT_PAGE_SIZE);
  return {
    studentId: params.get("studentId") ?? "",
    studentCode: params.get("studentCode") ?? "",
    studentName: params.get("studentName") ?? "",
    classId: params.get("classId") ?? "",
    classCode: params.get("classCode") ?? "",
    className: params.get("className") ?? "",
    status: params.get("status") ?? "",
    billingType: params.get("billingType") ?? "",
    billingMonth: params.get("billingMonth") ?? "",
    page: Number.isInteger(page) && page >= 0 ? page : 0,
    pageSize: PAGE_SIZES.includes(pageSize) ? pageSize : DEFAULT_PAGE_SIZE,
  };
}

export function serializeTuitionListQuery(query: TuitionListQuery): URLSearchParams {
  const params = new URLSearchParams();
  const text: Array<[string, string]> = [
    ["studentId", query.studentId],
    ["studentCode", query.studentCode],
    ["studentName", query.studentName],
    ["classId", query.classId],
    ["classCode", query.classCode],
    ["className", query.className],
    ["status", query.status],
    ["billingType", query.billingType],
    ["billingMonth", query.billingMonth],
  ];
  for (const [key, value] of text) if (value) params.set(key, value);
  if (query.page > 0) params.set("page", String(query.page));
  if (query.pageSize !== DEFAULT_PAGE_SIZE) params.set("pageSize", String(query.pageSize));
  return params;
}
