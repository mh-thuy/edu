import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess } from "@/lib/api";

export async function GET() {
  try {
    // Get debt statistics
    const unpaidCount = await prisma.studentFee.count({
      where: { status: "UNPAID" },
    });

    const partialCount = await prisma.studentFee.count({
      where: { status: "PARTIAL" },
    });

    // Get total outstanding amount - need to calculate from fees and payments
    const fees = await prisma.studentFee.findMany({
      where: {
        status: {
          in: ["UNPAID", "PARTIAL"],
        },
      },
      include: {
        payments: true,
      },
    });

    const totalDebt = fees.reduce((sum, fee) => {
      const totalPaid = fee.payments.reduce((paidSum, payment) => paidSum + payment.amount, 0);
      const outstanding = fee.amount - fee.discount - totalPaid;
      return sum + outstanding;
    }, 0);

    // Get overdue count (past due date and not fully paid)
    const overdueCount = await prisma.studentFee.count({
      where: {
        dueDate: {
          lt: new Date(),
        },
        status: {
          in: ["UNPAID", "PARTIAL"],
        },
      },
    });

    return apiSuccess({
      totalDebt,
      unpaidCount,
      partialCount,
      overdueCount,
    });
  } catch (error) {
    console.error("Error fetching debt summary:", error);
    return apiError("INTERNAL_ERROR", "Failed to fetch debt summary", 500);
  }
}
