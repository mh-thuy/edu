import assert from "node:assert/strict";
import { parseTuitionListQuery, serializeTuitionListQuery } from "../src/modules/finance/tuition/utils/tuition-list-query";

const empty = parseTuitionListQuery(new URLSearchParams(""));
assert.deepEqual(empty, {
  studentId: "", studentCode: "", studentName: "", classId: "", classCode: "", className: "",
  status: "", billingType: "", billingMonth: "", page: 0, pageSize: 20,
});
assert.equal(serializeTuitionListQuery(empty).toString(), "");

const q = {
  studentId: "u1", studentCode: "HS-20261117-0001", studentName: "Nguyễn Văn A",
  classId: "c1", classCode: "L-TOAN9", className: "Toán 9", status: "UNPAID",
  billingType: "MONTHLY", billingMonth: "2026-11", page: 2, pageSize: 50,
};
const s = serializeTuitionListQuery(q);
assert.deepEqual(parseTuitionListQuery(new URLSearchParams(s.toString())), q);

const tab = parseTuitionListQuery(new URLSearchParams("status=OVERDUE&page=abc&pageSize=999"));
assert.equal(tab.status, "OVERDUE");
assert.equal(tab.page, 0);
assert.equal(tab.pageSize, 20);

console.log("tuition-list-query: OK");
