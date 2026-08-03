import { apiError, apiSuccess } from "@/lib/api";
import { requireApiUser } from "@/lib/api-auth";
import { toDecimal } from "@/lib/decimal";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) {
      return user;
    }

    const [paymentAggregate, tuitionFeeAggregate, payrollAggregate, activeClasses] =
      await Promise.all([
        prisma.tuitionPayment.aggregate({ where: { paymentStatus: "SUCCESS" },
          _sum: {
            amount: true,
          },
        }),
        prisma.tuitionFee.aggregate({
          _sum: {
            finalAmount: true,
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
    const totalFeeAmount = tuitionFeeAggregate._sum.finalAmount ?? toDecimal(0);
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
