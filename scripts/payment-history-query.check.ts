import assert from "node:assert/strict";
import { parsePaymentHistoryQuery, serializePaymentHistoryQuery } from "../src/modules/finance/payments/utils/payment-history-query";

const empty = parsePaymentHistoryQuery(new URLSearchParams(""));
assert.deepEqual(empty, { transactionCode: "", studentId: "", studentCode: "", studentName: "", status: "", page: 0, pageSize: 20 });
assert.equal(serializePaymentHistoryQuery(empty).toString(), "");

const q = {
  transactionCode: "868x7ew", studentId: "u1", studentCode: "HS-20261117-0001",
  studentName: "Nguyễn Văn A", status: "PENDING", page: 3, pageSize: 50,
};
const s = serializePaymentHistoryQuery(q);
assert.deepEqual(parsePaymentHistoryQuery(new URLSearchParams(s.toString())), q);

const bad = parsePaymentHistoryQuery(new URLSearchParams("page=-4&pageSize=7"));
assert.equal(bad.page, 0);
assert.equal(bad.pageSize, 20);

console.log("payment-history-query: OK");
