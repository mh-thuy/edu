import { apiError, apiSuccess } from "@/lib/api";
import { toDecimal } from "@/lib/decimal";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const [paymentAggregate, studentFeeAggregate, payrollAggregate, activeClasses] =
      await Promise.all([
        prisma.payment.aggregate({
          _sum: {
            amount: true,
          },
        }),
        prisma.studentFee.aggregate({
          _sum: {
            amount: true,
            discount: true,
          },
        }),
        prisma.teacherPayroll.aggregate({
          _sum: {
            salaryAmount: true,
          },
        }),
        prisma.class.count({
          where: {
            status: "ACTIVE",
          },
        }),
      ]);

    const totalRevenue = paymentAggregate._sum.amount ?? toDecimal(0);
    const totalFeeAmount = toDecimal(studentFeeAggregate._sum.amount).sub(
      studentFeeAggregate._sum.discount ?? 0,
    );
    const totalPayroll = payrollAggregate._sum.salaryAmount ?? toDecimal(0);
    const totalCollected = totalRevenue;
    const totalDebt = totalFeeAmount.sub(totalCollected);

    return apiSuccess({
      totalFeeAmount,
      totalRevenue,
      totalDebt: totalDebt.greaterThan(0) ? totalDebt : toDecimal(0),
      totalCollected,
      totalPayroll,
      activeClasses,
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return apiError("INTERNAL_ERROR", "Failed to fetch dashboard stats", 500);
  }
}
