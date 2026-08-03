import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, handleApiError } from "@/lib/api";
import { requireApiRole } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { TuitionPaymentMethod } from "@prisma/client";

const querySchema = z.object({ startDate: z.string().min(1), endDate: z.string().min(1), classId: z.string().uuid().optional() });

export async function GET(request: NextRequest) {
  try {
    const user = await requireApiRole(["ADMIN", "STAFF", "TEACHER"]);
    if (user instanceof Response) return user;
    const query = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const payments = await prisma.tuitionPayment.findMany({ where: { paymentStatus: "SUCCESS", paymentDate: { gte: new Date(query.startDate), lte: new Date(query.endDate) }, ...(query.classId ? { tuitionFee: { classId: query.classId } } : {}) }, include: { tuitionFee: { include: { student: true, class: true } } }, orderBy: { paymentDate: "desc" } });
    const methodSummary = { cash: 0, transfer: 0, other: 0 };
    for (const payment of payments) {
      const key = payment.paymentMethod === TuitionPaymentMethod.CASH ? "cash" : payment.paymentMethod === TuitionPaymentMethod.BANK_TRANSFER ? "transfer" : "other";
      methodSummary[key] += Number(payment.amount);
    }
    return apiSuccess({ totalRevenue: payments.reduce((sum, payment) => sum + Number(payment.amount), 0), paymentCount: payments.length, methodSummary, payments });
  } catch (error) {
    return handleApiError(error, "Không thể tải báo cáo doanh thu");
  }
}
