export type NoticeQuery = {
  view: string;
  months: string[];
  search: string;
  studentId: string;
  studentCode: string;
  studentName: string;
  classId: string;
  classCode: string;
  className: string;
};

const VIEWS = ["UNISSUED", "PENDING", "SUCCESS"];
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export function parseNoticeQuery(params: URLSearchParams): NoticeQuery {
  // "month" (một kỳ) là tên cũ từ link lớp học; vẫn đọc để link cũ không hỏng.
  const monthParam = params.get("months") ?? params.get("month") ?? "";
  const months = [...new Set(monthParam.split(",").filter((m) => MONTH_PATTERN.test(m)))].sort();
  const view = params.get("view") ?? "";
  return {
    view: VIEWS.includes(view) ? view : "UNISSUED",
    months,
    search: params.get("search") ?? "",
    studentId: params.get("studentId") ?? "",
    studentCode: params.get("studentCode") ?? "",
    studentName: params.get("studentName") ?? "",
    classId: params.get("classId") ?? "",
    classCode: params.get("classCode") ?? "",
    className: params.get("className") ?? "",
  };
}

export function serializeNoticeQuery(query: NoticeQuery): URLSearchParams {
  const params = new URLSearchParams();
  const text: Array<[string, string]> = [
    ["view", query.view === "UNISSUED" ? "" : query.view],
    ["months", query.months.join(",")],
    ["search", query.search],
    ["studentId", query.studentId],
    ["studentCode", query.studentCode],
    ["studentName", query.studentName],
    ["classId", query.classId],
    ["classCode", query.classCode],
    ["className", query.className],
  ];
  for (const [key, value] of text) if (value) params.set(key, value);
  return params;
}
