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

import { DEFAULT_PAGE_SIZE, parsePageParams } from "@/lib/list-page-params";

export function parseTuitionListQuery(params: URLSearchParams): TuitionListQuery {
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
    ...parsePageParams(params),
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
