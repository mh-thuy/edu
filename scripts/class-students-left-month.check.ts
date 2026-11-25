import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { getClassStudentsPage } from "../src/modules/class/services/class.service";

// Kiểm tra: học viên rời lớp ngày 15/10/2099 vẫn là "đang học" ở tháng 9, và "đã rời lớp" từ tháng 10.
// Chỉ chạy trên DB localhost; dữ liệu tạm (không có học phí) được xóa khi xong.
async function main() {
  process.loadEnvFile(".env");
  const dbHost = new URL(
    (process.env.DATABASE_URL ?? "").replace(/^postgresql/, "http"),
  ).hostname;
  assert.ok(
    ["localhost", "127.0.0.1"].includes(dbHost),
    `Từ chối chạy: DATABASE_URL trỏ tới "${dbHost}", chỉ cho phép localhost`,
  );
  const suffix = Date.now().toString(36).toUpperCase();
  const student = await prisma.student.create({
    data: { code: `TSL-${suffix}`, fullName: "Test left by month" },
  });
  const cls = await prisma.class.create({
    data: { code: `TSLC-${suffix}`, name: "Test left by month", status: "ACTIVE" },
  });
  try {
    const enrollment = await prisma.classStudent.create({
      data: {
        classId: cls.id,
        studentId: student.id,
        status: "LEFT",
        leftAt: new Date(Date.UTC(2099, 9, 15)),
      },
    });
    const page = (month: string, status?: "ACTIVE" | "LEFT", sortBy?: "feeStatus") =>
      getClassStudentsPage(cls.id, { page: 1, pageSize: 20, month, status, sortBy });
    const ids = async (month: string, status?: "ACTIVE" | "LEFT", sortBy?: "feeStatus") =>
      (await page(month, status, sortBy)).items.map((item) => item.id);

    // Tháng 9: đang học, chưa rời
    const sep = await page("2099-09");
    assert.equal(sep.summary.active, 1);
    assert.equal(sep.summary.left, 0);
    assert.equal(sep.summary.uncreated, 0, "Đã rời lớp thì không tính chưa tạo học phí");
    assert.equal(sep.items[0]?._count.tuitionFees, 0);
    assert.deepEqual(await ids("2099-09", "ACTIVE"), [enrollment.id]);
    assert.deepEqual(await ids("2099-09", "ACTIVE", "feeStatus"), [enrollment.id]);
    assert.deepEqual(await ids("2099-09", "LEFT"), []);

    // Tháng 10 (tháng rời): đã rời lớp
    const oct = await page("2099-10");
    assert.equal(oct.summary.active, 0);
    assert.equal(oct.summary.left, 1);
    assert.deepEqual(await ids("2099-10", "LEFT"), [enrollment.id]);
    assert.deepEqual(await ids("2099-10", "LEFT", "feeStatus"), [enrollment.id]);
    assert.deepEqual(await ids("2099-10", "ACTIVE"), []);

    console.log("OK: class-students-left-month");
  } finally {
    await prisma.classStudent.deleteMany({ where: { classId: cls.id } });
    await prisma.class.delete({ where: { id: cls.id } });
    await prisma.student.delete({ where: { id: student.id } });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
