import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { ConflictError } from "../src/lib/errors";
import { pauseStudentEnrollment } from "../src/modules/class/services/class.service";
import { TuitionService } from "../src/modules/finance/tuition/services/tuition.service";

// Kiểm tra: học phí đã hủy không chặn tạm nghỉ, nhưng không được khôi phục khi đang tạm nghỉ.
// Tạo dữ liệu tạm trong năm 2099 và xóa khi xong. Chỉ chạy trên DB localhost, không bao giờ trên DB thật.
async function main() {
  process.loadEnvFile(".env");
  const dbHost = new URL(
    (process.env.DATABASE_URL ?? "").replace(/^postgresql/, "http"),
  ).hostname;
  assert.ok(
    ["localhost", "127.0.0.1"].includes(dbHost),
    `Từ chối chạy: DATABASE_URL trỏ tới "${dbHost}", chỉ cho phép localhost`,
  );
  const actor = await prisma.user.findFirst({ select: { id: true } });
  assert.ok(actor, "Cần ít nhất một user trong DB");
  const suffix = Date.now().toString(36).toUpperCase();

  const student = await prisma.student.create({
    data: { code: `TST-${suffix}`, fullName: "Test pause cancelled fee" },
  });
  const cls = await prisma.class.create({
    data: {
      code: `TSTC-${suffix}`,
      name: "Test pause cancelled fee",
      status: "ACTIVE",
    },
  });
  const enrollment = await prisma.classStudent.create({
    data: { classId: cls.id, studentId: student.id, status: "ACTIVE" },
  });
  const fee = await prisma.tuitionFee.create({
    data: {
      feeNo: `TSTF-${suffix}`,
      studentId: student.id,
      enrollmentId: enrollment.id,
      classId: cls.id,
      billingYear: 2099,
      billingMonth: 6,
      billingType: "MONTHLY",
      status: "CANCELLED",
      createdBy: actor.id,
      updatedBy: actor.id,
    },
  });

  let pauseId: string | undefined;
  try {
    // 1. Học phí tháng 6/2099 đã hủy: tạm nghỉ tháng 6–7 phải thành công
    const pause = await pauseStudentEnrollment(
      cls.id,
      student.id,
      { startMonth: "2099-06", endMonth: "2099-07", reason: "test" },
      actor.id,
    );
    pauseId = pause.id;
    assert.equal(pause.status, "ACTIVE");

    // 2. Đang tạm nghỉ tháng 6/2099: khôi phục học phí tháng 6 phải bị chặn
    await assert.rejects(
      TuitionService.restoreFee(
        fee.id,
        { reason: "test", version: fee.version },
        actor.id,
      ),
      (error: unknown) =>
        error instanceof ConflictError &&
        /tạm nghỉ trong tháng 6\/2099/.test(error.message),
    );

    console.log("OK: enrollment-pause-cancelled-fee");
  } finally {
    await prisma.tuitionAuditLog.deleteMany({
      where: { entityId: { in: [fee.id, ...(pauseId ? [pauseId] : [])] } },
    });
    await prisma.enrollmentPause.deleteMany({
      where: { enrollmentId: enrollment.id },
    });
    await prisma.tuitionFee.delete({ where: { id: fee.id } });
    await prisma.classStudent.delete({ where: { id: enrollment.id } });
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
