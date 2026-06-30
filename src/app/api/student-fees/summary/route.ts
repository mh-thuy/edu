import { NextRequest } from "next/server";
import { FeeStatus, Prisma } from "@prisma/client";
import { apiSuccess, handleApiError } from "@/lib/api";
import { requireApiRole } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { toDecimal } from "@/lib/decimal";

const unpaidStatuses: FeeStatus[] = ["UNPAID", "PARTIAL"];

function parseMonth(month?: string | null) {
  if (!month) {
    return null;
  }

  const match = month.match(/^(\d{4})-(\d{2})$/);
  if (!match) {
    return null;
  }

  return {
    billingYear: Number(match[1]),
    billingMonth: Number(match[2]),
  };
}

function buildBaseWhere(params: URLSearchParams): Prisma.StudentFeeWhereInput {
  const status = params.get("status");
  const classId = params.get("classId");
  const studentId = params.get("studentId");
  const overdue = params.get("overdue");
  const month = parseMonth(params.get("month"));

  const where: Prisma.StudentFeeWhereInput = {};

  if (classId) {
    where.classId = classId;
  }

  if (studentId) {
    where.studentId = studentId;
  }

  if (month) {
    where.billingYear = month.billingYear;
    where.billingMonth = month.billingMonth;
  }

  if (status) {
    const normalized = status.toUpperCase();
    if (normalized === "OVERDUE") {
      where.status = { in: unpaidStatuses };
      where.dueDate = { lt: new Date() };
      where.outstandingAmount = { gt: 0 };
    } else if (["UNPAID", "PARTIAL", "PAID"].includes(normalized)) {
      where.status = normalized as FeeStatus;
    }
  }

  if (overdue === "true") {
    where.status = { in: unpaidStatuses };
    where.dueDate = { lt: new Date() };
    where.outstandingAmount = { gt: 0 };
  }

  return where;
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireApiRole(["ADMIN", "STAFF"]);
    if (user instanceof Response) {
      return user;
    }

    const where = buildBaseWhere(request.nextUrl.searchParams);
    const matchedFees = await prisma.studentFee.findMany({
      where,
      select: {
        finalAmount: true,
        paidAmount: true,
        outstandingAmount: true,
        studentId: true,
        dueDate: true,
        status: true,
      },
    });

    const summary = matchedFees.reduce(
      (acc, fee) => {
        const finalAmount = toDecimal(fee.finalAmount);
        const paidAmount = toDecimal(fee.paidAmount);
        const outstandingAmount = toDecimal(fee.outstandingAmount);
        const isOverdue =
          !!fee.dueDate &&
          fee.dueDate.getTime() < Date.now() &&
          outstandingAmount.gt(0);

        acc.totalRevenue = acc.totalRevenue.add(finalAmount);
        acc.paidRevenue = acc.paidRevenue.add(paidAmount);
        acc.outstandingRevenue = acc.outstandingRevenue.add(outstandingAmount);
        if (isOverdue) {
          acc.overdueRevenue = acc.overdueRevenue.add(outstandingAmount);
        }
        if (outstandingAmount.gt(0)) {
          acc.unpaidStudents.add(fee.studentId);
        }
        return acc;
      },
      {
        totalRevenue: toDecimal(0),
        paidRevenue: toDecimal(0),
        outstandingRevenue: toDecimal(0),
        overdueRevenue: toDecimal(0),
        unpaidStudents: new Set<string>(),
      },
    );

    return apiSuccess({
      totalRevenue: summary.totalRevenue.toNumber(),
      paidRevenue: summary.paidRevenue.toNumber(),
      outstandingRevenue: summary.outstandingRevenue.toNumber(),
      overdueRevenue: summary.overdueRevenue.toNumber(),
      totalStudentsUnpaid: summary.unpaidStudents.size,
    });
  } catch (error) {
    return handleApiError(error, "Failed to fetch tuition summary");
  }
}
