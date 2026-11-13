import assert from "node:assert/strict";
import {
  getNextBillingPeriod,
  isClassCoveringPeriod,
} from "../src/modules/class/utils/tuition-period";

const dec2026 = { billingYear: 2026, billingMonth: 12, month: "2026-12" };

assert.deepEqual(getNextBillingPeriod(new Date("2026-11-13T05:00:00Z")), dec2026);
assert.deepEqual(getNextBillingPeriod(new Date("2026-12-15T05:00:00Z")), {
  billingYear: 2027,
  billingMonth: 1,
  month: "2027-01",
});
// 18:00 UTC ngày 31/12 = 01:00 ngày 1/1/2027 giờ Việt Nam → tháng kế tiếp là 2/2027
assert.deepEqual(getNextBillingPeriod(new Date("2026-12-31T18:00:00Z")), {
  billingYear: 2027,
  billingMonth: 2,
  month: "2027-02",
});

assert.equal(isClassCoveringPeriod({ startDate: null, endDate: null }, dec2026), true);
assert.equal(isClassCoveringPeriod({ startDate: "2027-01-05", endDate: null }, dec2026), false);
assert.equal(isClassCoveringPeriod({ startDate: null, endDate: "2026-11-30" }, dec2026), false);
assert.equal(isClassCoveringPeriod({ startDate: "2026-12-31", endDate: null }, dec2026), true);

console.log("tuition-period checks passed");
