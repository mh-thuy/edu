import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Get debt statistics
    const unpaidCount = await prisma.studentFee.count({
      where: { status: "unpaid" },
    });

    const partialCount = await prisma.studentFee.count({
      where: { status: "partial" },
    });

    // Get total outstanding amount - need to calculate from fees and payments
    const fees = await prisma.studentFee.findMany({
      where: {
        status: {
          in: ["unpaid", "partial"],
        },
      },
      include: {
        payments: true,
      },
    });

    const totalDebt = fees.reduce((sum, fee) => {
      const totalPaid = fee.payments.reduce((paidSum, payment) => paidSum + payment.amount, 0);
      const outstanding = fee.amount - totalPaid;
      return sum + outstanding;
    }, 0);

    // Get overdue count (past due date and not fully paid)
    const overdueCount = await prisma.studentFee.count({
      where: {
        dueDate: {
          lt: new Date(),
        },
        status: {
          in: ["unpaid", "partial"],
        },
      },
    });

    return NextResponse.json({
      totalDebt,
      unpaidCount,
      partialCount,
      overdueCount,
    });
  } catch (error) {
    console.error("Error fetching debt summary:", error);
    return NextResponse.json(
      { error: "Failed to fetch debt summary" },
      { status: 500 }
    );
  }
}
