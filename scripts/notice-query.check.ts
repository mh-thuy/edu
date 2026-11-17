import assert from "node:assert/strict";
import { parseNoticeQuery, serializeNoticeQuery } from "../src/modules/finance/payments/utils/notice-query";

const empty = parseNoticeQuery(new URLSearchParams(""));
assert.deepEqual(empty, {
  view: "UNISSUED", months: [], search: "", studentId: "", studentCode: "", studentName: "",
  classId: "", classCode: "", className: "",
});
assert.equal(serializeNoticeQuery(empty).toString(), "");

const q = {
  view: "SUCCESS", months: ["2026-11", "2026-12"], search: "Nguyễn Văn A",
  studentId: "u1", studentCode: "HS-20261117-0001", studentName: "Nguyễn Văn A",
  classId: "c1", classCode: "L-TOAN9", className: "Toán 9",
};
assert.deepEqual(parseNoticeQuery(new URLSearchParams(serializeNoticeQuery(q).toString())), q);

// Link cũ từ lớp học: month đơn và classId, không có view
const legacy = parseNoticeQuery(new URLSearchParams("classId=c1&month=2026-11&month2=x"));
assert.deepEqual(legacy.months, ["2026-11"]);
assert.equal(legacy.classId, "c1");
assert.equal(legacy.view, "UNISSUED");

// Kỳ sai định dạng bị bỏ qua, view lạ về mặc định
const bad = parseNoticeQuery(new URLSearchParams("months=2026-13,2026-11,2026-11&view=HACK"));
assert.deepEqual(bad.months, ["2026-11"]);
assert.equal(bad.view, "UNISSUED");

console.log("notice-query: OK");
