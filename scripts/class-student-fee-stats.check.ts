import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { getClassStudentsPage } from "../src/modules/class/services/class.service";

// Cần DB đang chạy có ít nhất một khoản học phí tháng.
async function main() {
  // Chọn kỳ có khoản đã đóng để test đi qua nhánh "Đã đóng"
  const sample = await prisma.tuitionFee.findFirst({
    where: { billingType: "MONTHLY", status: "PAID" },
    select: { classId: true, billingYear: true, billingMonth: true },
  });
  if (!sample) {
    console.log("class-student-fee-stats: không có học phí nào trong DB, bỏ qua");
    return;
  }
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
  const cancelled = count(["CANCELLED"]);

  const summary = page.summary.tuitionFees;
  assert.equal(summary.paidCount, paid, "Đã đóng");
  assert.equal(summary.unpaidCount, unpaid, "Chưa đóng");
  assert.equal(summary.exemptedCount, exempted, "Được miễn");
  // Mọi khoản đều thuộc đúng một nhóm (trừ đã hủy)
  assert.equal(summary.count, paid + unpaid + exempted + cancelled, "Tổng khoản phí");

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
