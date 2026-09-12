import { apiError, apiSuccess } from "@/lib/api";
import { requireApiUser } from "@/lib/api-auth";
import { toDecimal } from "@/lib/decimal";
import { prisma } from "@/lib/prisma";
import {
  getVietnamDayEndExclusive,
  getVietnamDayStart,
  parseVietnamDateStart,
} from "@/lib/vietnam-time";

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
    if (dateFrom) {
      const start = parseVietnamDateStart(dateFrom);
      if (!start) return apiError("VALIDATION_ERROR", "Ngày bắt đầu không hợp lệ", 400);
      paymentDate.gte = start;
    }
    if (dateTo) {
      const end = getVietnamDayEndExclusive(dateTo);
      if (!end) return apiError("VALIDATION_ERROR", "Ngày kết thúc không hợp lệ", 400);
      paymentDate.lt = end;
    }
    if (paymentDate.gte && paymentDate.lt && paymentDate.gte >= paymentDate.lt) {
      return apiError("VALIDATION_ERROR", "Ngày bắt đầu phải trước hoặc bằng ngày kết thúc", 400);
    }
    const asOf = new Date();
    const todayStart = getVietnamDayStart(asOf);
    const overdueWhere = {
      OR: [
        { status: "OVERDUE" as const },
        { status: "UNPAID" as const, dueDate: { lt: todayStart } },
      ],
    };
    const [paymentAggregate, tuitionFeeAggregate, debtAggregate, overdueFees, activeClasses, activeStudents, pendingBatches] =
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
        prisma.tuitionFee.count({ where: overdueWhere }),
        prisma.class.count({
          where: {
            status: "ACTIVE",
          },
        }),
        prisma.student.count({ where: { status: "ACTIVE" } }),
        prisma.paymentBatch.count({ where: { status: "PENDING" } }),
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
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return apiError("INTERNAL_ERROR", "Failed to fetch dashboard stats", 500);
  }
}
