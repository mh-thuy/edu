import { apiError, apiSuccess } from "@/lib/api";
import { requireApiUser } from "@/lib/api-auth";
import { toDecimal } from "@/lib/decimal";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) {
      return user;
    }

    const params = new URL(request.url).searchParams;
    const dateFrom = params.get("dateFrom");
    const dateTo = params.get("dateTo");
    const paymentDate: { gte?: Date; lt?: Date } = {};
    if (dateFrom && !Number.isNaN(Date.parse(dateFrom))) paymentDate.gte = new Date(`${dateFrom}T00:00:00.000Z`);
    if (dateTo && !Number.isNaN(Date.parse(dateTo))) {
      const nextDay = new Date(`${dateTo}T00:00:00.000Z`);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      paymentDate.lt = nextDay;
    }
    const [paymentAggregate, tuitionFeeAggregate, debtAggregate, overdueFees, activeClasses, activeStudents, pendingBatches, unmatchedTransactions] =
      await Promise.all([
        prisma.tuitionPayment.aggregate({ where: { paymentStatus: "SUCCESS", ...(Object.keys(paymentDate).length ? { paymentDate } : {}) },
          _sum: {
            amount: true,
          },
        }),
        prisma.tuitionFee.aggregate({
          where: { status: { in: ["UNPAID", "PAID", "OVERDUE"] } },
          _sum: {
            finalAmount: true,
          },
        }),
        prisma.tuitionFee.aggregate({ where: { status: { in: ["UNPAID", "OVERDUE"] } }, _sum: { finalAmount: true } }),
        prisma.tuitionFee.count({ where: { status: "OVERDUE" } }),
        prisma.class.count({
          where: {
            status: "ACTIVE",
          },
        }),
        prisma.student.count({ where: { status: "ACTIVE" } }),
        prisma.paymentBatch.count({ where: { status: "PENDING" } }),
        prisma.bankStatementTransaction.count({ where: { reconciliationStatus: { in: ["UNMATCHED", "AMBIGUOUS", "AMOUNT_MISMATCH"] } } }),
      ]);

    const totalRevenue = paymentAggregate._sum.amount ?? toDecimal(0);
    const totalFeeAmount = tuitionFeeAggregate._sum.finalAmount ?? toDecimal(0);
    const totalCollected = totalRevenue;
    const totalDebt = debtAggregate._sum.finalAmount ?? toDecimal(0);

    return apiSuccess({
      totalFeeAmount,
      totalRevenue,
      totalDebt: totalDebt.greaterThan(0) ? totalDebt : toDecimal(0),
      totalCollected,
      activeClasses,
      activeStudents,
      overdueFees,
      pendingBatches,
      unmatchedTransactions,
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return apiError("INTERNAL_ERROR", "Failed to fetch dashboard stats", 500);
  }
}
