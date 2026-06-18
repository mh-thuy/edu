import type { PrismaClient } from "@prisma/client";

export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.auditLog.deleteMany();

  await prisma.teacherPayrollItem.deleteMany();
  await prisma.teacherPayroll.deleteMany();

  await prisma.receipt.deleteMany();
  await prisma.payment.deleteMany();

  await prisma.paymentNotice.deleteMany();
  await prisma.paymentQrCode.deleteMany();
  await prisma.paymentAccount.deleteMany();

  await prisma.studentFee.deleteMany();

  await prisma.classStudent.deleteMany();
  await prisma.classSchedule.deleteMany();
  await prisma.classSalaryRule.deleteMany();

  await prisma.class.deleteMany();

  await prisma.student.deleteMany();
  await prisma.teacher.deleteMany();

  await prisma.room.deleteMany();
  await prisma.user.deleteMany();
}
