import type {
  PaymentAccount,
  PrismaClient,
  Student,
  Class,
  StudentFee,
  PaymentRequest,
  PaymentQrCode,
  PaymentNotice,
} from "@prisma/client";
import { currentMonthKey, nextMonthDueDate } from "./random";

export interface StudentFeeFlow {
  fee: StudentFee;
  request: PaymentRequest;
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
  const paymentCode = `PR-${month}-${input.student.code}-${input.class.code}`;
  const transferContent = `HP-${month}-${input.student.code}-${input.class.code}`;

  const fee = await prisma.studentFee.create({
    data: {
      studentId: input.student.id,
      classId: input.class.id,
      billingYear: Number(month.slice(0, 4)),
      billingMonth: Number(month.slice(5, 7)),
      amount: input.class.tuitionFee,
      discount: 0,
      finalAmount,
      dueDate,
      status: "UNPAID",
    },
  });

  const paymentRequest = await prisma.paymentRequest.create({
    data: {
      studentFeeId: fee.id,
      paymentAccountId: input.paymentAccount.id,
      paymentCode,
      requestedAmount: finalAmount,
      transferContent,
      expiredAt: dueDate,
      status: "ACTIVE",
    },
  });

  const qr = await prisma.paymentQrCode.create({
    data: {
      paymentRequestId: paymentRequest.id,
      qrPayload: JSON.stringify({
        bankCode: input.paymentAccount.bankCode,
        bankName: input.paymentAccount.bankName,
        accountNumber: input.paymentAccount.accountNumber,
        accountName: input.paymentAccount.accountName,
        amount: finalAmount.toString(),
        content: transferContent,
      }),
      status: "ACTIVE",
    },
  });

  const notice = await prisma.paymentNotice.create({
    data: {
      paymentRequestId: paymentRequest.id,
      noticeNumber: `PN-${month}-${input.student.code}-${input.class.code}`,
      amount: finalAmount,
      dueDate,
      version: 1,
      isLatest: true,
      status: "GENERATED",
    },
  });

  return {
    fee,
    request: paymentRequest,
    qr,
    notice,
    student: input.student,
    class: input.class,
  };
}
