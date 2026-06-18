import type {
  PaymentAccount,
  PrismaClient,
  Student,
  Class,
  StudentFee,
  PaymentQrCode,
  PaymentNotice,
} from "@prisma/client";
import { currentMonthKey, nextMonthDueDate } from "./random";

export interface StudentFeeFlow {
  fee: StudentFee;
  qr: PaymentQrCode;
  notice: PaymentNotice;
  student: Student;
  class: Class;
}

export async function createStudentFeeFlow(
  prisma: PrismaClient,
  input: {
    student: Student;
    class: Class;
    paymentAccount: PaymentAccount;
    userId: string;
  },
): Promise<StudentFeeFlow> {
  const month = currentMonthKey();
  const dueDate = nextMonthDueDate(5);
  const finalAmount = input.class.tuitionFee;

  const fee = await prisma.studentFee.create({
    data: {
      studentId: input.student.id,
      classId: input.class.id,
      month,
      amount: input.class.tuitionFee,
      discount: 0,
      finalAmount,
      dueDate,
      status: "UNPAID",
      createdBy: input.userId,
      updatedBy: input.userId,
    },
  });

  const transferContent = `HP-${month}-${input.student.code}-${input.class.code}`;
  const paymentCode = `QR-${month}-${input.student.code}-${input.class.code}`;

  const qr = await prisma.paymentQrCode.create({
    data: {
      studentFeeId: fee.id,
      paymentAccountId: input.paymentAccount.id,
      paymentCode,
      amount: finalAmount,
      transferContent,
      qrPayload: JSON.stringify({
        bankCode: input.paymentAccount.bankCode,
        bankName: input.paymentAccount.bankName,
        accountNumber: input.paymentAccount.accountNumber,
        accountName: input.paymentAccount.accountName,
        amount: finalAmount.toString(),
        content: transferContent,
      }),
      qrImageUrl: null,
      status: "ACTIVE",
      createdBy: input.userId,
      updatedBy: input.userId,
    },
  });

  const notice = await prisma.paymentNotice.create({
    data: {
      studentFeeId: fee.id,
      qrCodeId: qr.id,
      noticeNumber: `PN-${month}-${input.student.code}-${input.class.code}`,
      amount: finalAmount,
      dueDate,
      version: 1,
      isLatest: true,
      status: "GENERATED",
      createdBy: input.userId,
      updatedBy: input.userId,
    },
  });

  return {
    fee,
    qr,
    notice,
    student: input.student,
    class: input.class,
  };
}
