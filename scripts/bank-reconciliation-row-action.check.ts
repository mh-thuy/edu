import assert from "node:assert/strict";
import { getReconciliationRowAction } from "../src/modules/finance/bank/components/reconciliation-row-action";

assert.deepEqual(getReconciliationRowAction("UNMATCHED"), { label: "Chọn đợt", variant: "contained", color: "primary" });
assert.deepEqual(getReconciliationRowAction("AUTO_MATCHED"), { label: "Xác nhận", variant: "contained", color: "success" });
assert.deepEqual(getReconciliationRowAction("CONFIRMED"), { label: "Chi tiết", variant: "text", color: "primary" });
assert.deepEqual(getReconciliationRowAction("IGNORED"), { label: "Chi tiết", variant: "text", color: "primary" });
assert.deepEqual(getReconciliationRowAction("DUPLICATED"), { label: "Chi tiết", variant: "text", color: "primary" });
console.log("bank-reconciliation-row-action: OK");
