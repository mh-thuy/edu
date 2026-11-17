import assert from "node:assert/strict";
import {
  buildListQuery,
  buildOutstandingFeesQuery,
  type NoticeListFilters,
} from "../src/modules/finance/payments/services/payment-batch-management.client";

const base: NoticeListFilters = { months: [], page: 1, pageSize: 100, search: "" };

// 1. Tab học phí: lọc theo mã học viên, không gửi studentId
const fees = buildOutstandingFeesQuery({ ...base, studentId: "uuid-1", studentCode: "HS001" });
assert.equal(fees.get("studentCode"), "HS001");
assert.equal(fees.has("studentId"), false);
assert.equal(fees.get("unissuedOnly"), "true");
assert.equal(fees.get("statuses"), "UNPAID,PARTIAL,OVERDUE");

// 2. Học viên và từ khóa cùng lúc: cả hai đều có mặt
const both = buildOutstandingFeesQuery({ ...base, search: "Nam", studentCode: "HS001" });
assert.equal(both.get("search"), "Nam");
assert.equal(both.get("studentCode"), "HS001");

// 3. Tab batch: vẫn gửi studentId, không gửi studentCode
const batch = buildListQuery({ ...base, studentId: "uuid-1", studentCode: "HS001" });
assert.equal(batch.get("studentId"), "uuid-1");
assert.equal(batch.has("studentCode"), false);

// 4. Mã có khoảng trắng được mã hóa đúng
const encoded = buildOutstandingFeesQuery({ ...base, studentCode: "HS 001" });
assert.equal(encoded.get("studentCode"), "HS 001");
assert.match(encoded.toString(), /studentCode=HS\+001/);

console.log("notice-outstanding-fees-query: OK");
