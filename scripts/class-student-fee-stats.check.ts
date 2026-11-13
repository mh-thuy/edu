import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { getClassStudentsPage } from "../src/modules/class/services/class.service";

// Cần DB đang chạy có một lớp-kỳ vừa có khoản PAID vừa có khoản CANCELLED.
async function main() {
  // Chọn lớp-kỳ có cả khoản đã đóng và khoản đã hủy, để test bắt được lỗi đếm nhầm khoản đã hủy
  const [found] = await prisma.$queryRaw<Array<{ class_id: string; billing_year: number; billing_month: number }>>`
    SELECT class_id, billing_year, billing_month
    FROM tuition_fees
    WHERE billing_type = 'MONTHLY'::tuition_fee_billing_type
    GROUP BY class_id, billing_year, billing_month
    HAVING COUNT(*) FILTER (WHERE status = 'PAID'::tuition_fee_status) > 0
      AND COUNT(*) FILTER (WHERE status = 'CANCELLED'::tuition_fee_status) > 0
    LIMIT 1
  `;
  if (!found) throw new Error("Cần DB có một lớp-kỳ vừa có khoản PAID vừa có khoản CANCELLED để test");
  const sample = { classId: found.class_id, billingYear: found.billing_year, billingMonth: found.billing_month };
  const month = `${sample.billingYear}-${String(sample.billingMonth).padStart(2, "0")}`;
  const total = await prisma.classStudent.count({ where: { classId: sample.classId } });
  const page = await getClassStudentsPage(sample.classId, { page: 1, pageSize: Math.max(total, 1), month });

  // Đếm lại từ danh sách học viên cùng kỳ để đối chiếu với summary
  const fees = page.items.flatMap((student) =>
    student.tuitionFees.filter(
      (fee) => fee.billingType === "MONTHLY" && fee.billingYear === sample.billingYear && fee.billingMonth === sample.billingMonth,
    ),
  );
  const count = (statuses: string[]) => fees.filter((fee) => statuses.includes(fee.status)).length;
  const paid = count(["PAID"]);
  const unpaid = count(["UNPAID", "PARTIAL", "OVERDUE"]);
  const exempted = count(["EXEMPTED"]);

  const summary = page.summary.tuitionFees;
  assert.equal(summary.paidCount, paid, "Đã đóng");
  assert.equal(summary.unpaidCount, unpaid, "Chưa đóng");
  assert.equal(summary.exemptedCount, exempted, "Được miễn");
  // Khoản phí = đã đóng + chưa đóng + được miễn (khoản đã hủy không tính)
  assert.equal(summary.count, paid + unpaid + exempted, "Tổng khoản phí");

  // Bộ lọc tìm kiếm không được làm đổi hai số liệu
  const filtered = await getClassStudentsPage(sample.classId, {
    page: 1,
    pageSize: 20,
    search: "__không_khớp__",
    month,
  });
  assert.equal(filtered.summary.tuitionFees.paidCount, summary.paidCount, "Đã đóng khi lọc");
  assert.equal(filtered.summary.tuitionFees.unpaidCount, summary.unpaidCount, "Chưa đóng khi lọc");

  // Kỳ không có khoản nào trả về 0 (không lỗi)
  const empty = await getClassStudentsPage(sample.classId, { page: 1, pageSize: 20, month: "2099-01" });
  assert.equal(empty.summary.tuitionFees.paidCount, 0);
  assert.equal(empty.summary.tuitionFees.unpaidCount, 0);
  assert.equal(empty.summary.tuitionFees.exemptedCount, 0);

  console.log("class-student-fee-stats checks passed");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
