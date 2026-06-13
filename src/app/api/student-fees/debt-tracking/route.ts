import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, parseInt(searchParams.get("limit") || "10", 10));
    const status = searchParams.get("status") || undefined;
    const studentId = searchParams.get("studentId") || undefined;
    const classId = searchParams.get("classId") || undefined;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.StudentFeeWhereInput = {};
    if (status) where.status = status;
    if (studentId) where.studentId = studentId;
    if (classId) where.classId = classId;

    // Get total count
    const total = await prisma.studentFee.count({ where });

    // Get paginated results with student and class data
    const fees = await prisma.studentFee.findMany({
      where,
      skip,
      take: limit,
      include: {
        student: true,
        class: true,
        payments: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Transform to debt tracking format
    const debts = fees.map((fee) => {
      const totalPaid = fee.payments.reduce((sum, payment) => sum + payment.amount, 0);
      const outstanding = fee.amount - totalPaid;
      
      return {
        id: fee.id,
        studentId: fee.student.id,
        studentName: fee.student.fullName,
        className: fee.class.name,
        totalAmount: fee.amount,
        totalPaid,
        outstanding,
        status: fee.status,
        month: fee.month,
        dueDate: fee.dueDate.toISOString(),
      };
    });

    return NextResponse.json({
      data: debts,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching debt tracking data:", error);
    return NextResponse.json(
      { error: "Failed to fetch debt tracking data" },
      { status: 500 }
    );
  }
}
