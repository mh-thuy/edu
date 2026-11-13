import assert from "node:assert/strict";
import {
  getNextBillingPeriod,
  isClassCoveringPeriod,
} from "../src/modules/class/utils/tuition-period";
import { createTuitionForClasses } from "../src/modules/class/utils/next-month-tuition";

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

async function runBatchChecks() {
  const classes = [
    { id: "a", code: "LA" },
    { id: "b", code: "LB" },
    { id: "c", code: "LC" },
  ];
  const progress: Array<[number, number]> = [];
  const summary = await createTuitionForClasses(
    classes,
    async (classId) => {
      if (classId === "a") throw new Error("HTTP 500");
      if (classId === "b") {
        return {
          created: 2,
          skipped: 1,
          failed: [{ studentCode: "HS1", studentName: "Nguyễn A", reason: "Đã miễn" }],
        };
      }
      return { created: 3, skipped: 0 };
    },
    (done, total) => progress.push([done, total]),
  );
  // Lớp "a" lỗi nhưng "b" và "c" vẫn được xử lý
  assert.equal(summary.created, 5);
  assert.equal(summary.skipped, 1);
  assert.deepEqual(summary.problems, [
    "LA: HTTP 500",
    "LB · HS1 Nguyễn A: Đã miễn",
  ]);
  assert.deepEqual(progress, [
    [1, 3],
    [2, 3],
    [3, 3],
  ]);
}

runBatchChecks().then(() => console.log("tuition-period checks passed"));
