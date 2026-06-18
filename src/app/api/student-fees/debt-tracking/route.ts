import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import { FeeStatus, Prisma } from "@prisma/client";
import { apiError, apiSuccess } from "@/lib/api";
import { sumDecimals, toDecimal } from "@/lib/decimal";

function normalizeFeeStatus(status?: string): FeeStatus | undefined {
  if (!status) return undefined;
  const normalized = status.toUpperCase();
  if (normalized === "UNPAID" || normalized === "PARTIAL" || normalized === "PAID") {
    return normalized;
  }
  return undefined;
}

function formatBillingMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.max(1, parseInt(searchParams.get("pageSize") || "10", 10));
    const status = searchParams.get("status") || undefined;
    const studentId = searchParams.get("studentId") || undefined;
    const classId = searchParams.get("classId") || undefined;

    const skip = (page - 1) * pageSize;

    // Build where clause
    const where: Prisma.StudentFeeWhereInput = {};
    if (status) where.status = normalizeFeeStatus(status);
    if (studentId) where.studentId = studentId;
    if (classId) where.classId = classId;

    // Get total count
    const total = await prisma.studentFee.count({ where });

    // Get paginated results with student and class data
    const fees = await prisma.studentFee.findMany({
      where,
      skip,
      take: pageSize,
      include: {
        student: true,
        class: true,
        payments: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Transform to debt tracking format
    const debts = fees.map((fee) => {
      const totalPaid = sumDecimals(fee.payments.map((payment) => payment.amount));
      const totalAmount = toDecimal(fee.amount).sub(fee.discount);
      const outstanding = totalAmount.sub(totalPaid);
      
      return {
        id: fee.id,
        studentId: fee.student.id,
        studentName: fee.student.fullName,
        className: fee.class.name,
        totalAmount,
        totalPaid,
        outstanding,
        status: fee.status,
        month: formatBillingMonth(fee.billingYear, fee.billingMonth),
        dueDate: fee.dueDate,
      };
    });

    return apiSuccess({
      items: debts,
      total,
      page,
      pageSize,
      pages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("Error fetching debt tracking data:", error);
    return apiError("INTERNAL_ERROR", "Failed to fetch debt tracking data", 500);
  }
}
