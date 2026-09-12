import { Prisma, TuitionPaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ConflictError } from "@/lib/errors";
import { getVietnamDayEndExclusive, parseVietnamDateStart } from "@/lib/vietnam-time";

export type DailyPaymentReportInput = { date: string };

export type DailyPaymentReportRow = {
  teacherName: string;
  className: string;
  tuitionFee: number;
  count: number;
  total: number;
  note: string;
};

export type DailyPaymentReportDetail = {
  paymentNo: string;
  paymentDate: Date;
  studentName: string;
  studentCode: string;
  className: string;
  feeNo: string;
  paymentMethod: string;
  amount: number;
};

export type DailyPaymentReport = {
  date: string;
  rows: DailyPaymentReportRow[];
  details: DailyPaymentReportDetail[];
  paymentCount: number;
  totalCollected: number;
  cashCollected: number;
  bankTransferCollected: number;
};

function getDayRange(date: string) {
  const start = parseVietnamDateStart(date);
  const end = getVietnamDayEndExclusive(date);
  if (!start || !end) throw new ConflictError("Ngày báo cáo không hợp lệ");
  return { start, end };
}

function formatMethod(method: string) {
  return method === "CASH" ? "Tiền mặt" : method === "BANK_TRANSFER" ? "Chuyển khoản" : method;
}

function addRow(
  groups: Map<string, DailyPaymentReportRow>,
  paymentAmount: number,
  fee: {
    originalAmount: Prisma.Decimal;
    discountAmount: Prisma.Decimal;
    additionalAmount: Prisma.Decimal;
    finalAmount: Prisma.Decimal;
  },
  item: {
    amount: Prisma.Decimal;
    unitPrice: Prisma.Decimal;
    classSubject: {
      id: string;
      subject: { name: string };
      teacher: { fullName: string } | null;
      class: { code: string; name: string };
    } | null;
  },
  paymentMethod: string,
) {
  const classSubject = item.classSubject;
  if (!classSubject) return;

  const grossAmount = Number(item.amount);
  const originalAmount = Number(fee.originalAmount);
  const ratio = originalAmount > 0 ? Math.min(Math.max(grossAmount / originalAmount, 0), 1) : 1;
  const itemFinalAmount = Math.max(
    0,
    grossAmount - Number(fee.discountAmount) * ratio + Number(fee.additionalAmount) * ratio,
  );
  const finalAmount = Number(fee.finalAmount);
  const paidAmount = finalAmount > 0 ? paymentAmount * (itemFinalAmount / finalAmount) : 0;
  const teacherName = classSubject.teacher?.fullName || "Chưa phân công";
  const note = `${classSubject.subject.name} · ${formatMethod(paymentMethod)}`;
  const key = `${classSubject.id}:${Number(item.unitPrice)}:${paymentMethod}`;
  const current = groups.get(key);
  if (current) {
    current.count += 1;
    current.total += paidAmount;
    return;
  }
  groups.set(key, {
    teacherName,
    className: classSubject.class.code || classSubject.class.name,
    tuitionFee: Number(item.unitPrice),
    count: 1,
    total: paidAmount,
    note,
  });
}

export async function getDailyPaymentReport(
  input: DailyPaymentReportInput,
): Promise<DailyPaymentReport> {
  const { start, end } = getDayRange(input.date);
  const payments = await prisma.tuitionPayment.findMany({
    where: {
      paymentStatus: TuitionPaymentStatus.SUCCESS,
      paymentDate: { gte: start, lt: end },
    },
    orderBy: [{ paymentDate: "asc" }, { paymentNo: "asc" }],
    select: {
      paymentNo: true,
      paymentDate: true,
      paymentMethod: true,
      amount: true,
      tuitionFee: {
        select: {
          feeNo: true,
          originalAmount: true,
          discountAmount: true,
          additionalAmount: true,
          finalAmount: true,
          student: { select: { code: true, fullName: true } },
          class: { select: { code: true, name: true } },
          items: {
            select: {
              amount: true,
              unitPrice: true,
              classSubject: {
                select: {
                  id: true,
                  subject: { select: { name: true } },
                  teacher: { select: { fullName: true } },
                  class: { select: { code: true, name: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  const groups = new Map<string, DailyPaymentReportRow>();
  const details: DailyPaymentReportDetail[] = payments.map((payment) => {
    for (const item of payment.tuitionFee.items) {
      addRow(groups, Number(payment.amount), payment.tuitionFee, item, payment.paymentMethod);
    }
    return {
      paymentNo: payment.paymentNo,
      paymentDate: payment.paymentDate,
      studentName: payment.tuitionFee.student.fullName,
      studentCode: payment.tuitionFee.student.code,
      className: payment.tuitionFee.class.code || payment.tuitionFee.class.name,
      feeNo: payment.tuitionFee.feeNo,
      paymentMethod: formatMethod(payment.paymentMethod),
      amount: Number(payment.amount),
    };
  });
  const totalCollected = payments.reduce((total, payment) => total + Number(payment.amount), 0);
  const cashCollected = payments
    .filter((payment) => payment.paymentMethod === "CASH")
    .reduce((total, payment) => total + Number(payment.amount), 0);
  const bankTransferCollected = payments
    .filter((payment) => payment.paymentMethod === "BANK_TRANSFER")
    .reduce((total, payment) => total + Number(payment.amount), 0);

  return {
    date: input.date,
    rows: [...groups.values()].sort((a, b) => a.teacherName.localeCompare(b.teacherName, "vi")),
    details,
    paymentCount: payments.length,
    totalCollected,
    cashCollected,
    bankTransferCollected,
  };
}
