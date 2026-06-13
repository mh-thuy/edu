import { prisma } from "@/prisma/client";
import { NextRequest, NextResponse } from "next/server";

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
    const where: any = {};
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
      },
      orderBy: { createdAt: "desc" },
    });

    // Transform to debt tracking format
    const debts = fees.map((fee) => ({
      id: fee.id,
      studentId: fee.student.id,
      studentName: fee.student.fullName,
      className: fee.class.name,
      totalAmount: fee.amount,
      totalPaid: fee.amount - fee.outstandingAmount,
      outstanding: fee.outstandingAmount,
      status: fee.status,
      month: fee.month,
      dueDate: fee.dueDate.toISOString(),
    }));

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
