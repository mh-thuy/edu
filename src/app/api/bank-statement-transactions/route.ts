import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api";
import { requireApiRole } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const user = await requireApiRole(["ADMIN", "STAFF"]); if (user instanceof Response) return user;
    const statuses = (request.nextUrl.searchParams.get("status") || "").split(",").filter(Boolean) as never[];
    const bankAccountId = request.nextUrl.searchParams.get("bankAccountId") || undefined;
    const page = Math.max(Number(request.nextUrl.searchParams.get("page") || 1), 1);
    const pageSize = Math.min(Math.max(Number(request.nextUrl.searchParams.get("pageSize") || 20), 1), 100);
    const where = {
      ...(statuses.length ? { reconciliationStatus: { in: statuses } } : {}),
      ...(bankAccountId ? { bankAccountId } : {}),
    };
    const [transactions, total] = await Promise.all([
      prisma.bankStatementTransaction.findMany({ where, include: { statementImport: true, candidates: true, paymentBatch: { include: { student: true, allocations: { include: { tuitionFee: true } } } } }, orderBy: { transactionDate: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
      prisma.bankStatementTransaction.count({ where }),
    ]);
    const feeIds = transactions.flatMap((item) => item.candidates.map((candidate) => candidate.tuitionFeeId));
    const fees = await prisma.tuitionFee.findMany({ where: { id: { in: feeIds } }, include: { student: true, class: true } });
    const feeMap = new Map(fees.map((fee) => [fee.id, fee]));
    return apiSuccess({ items: transactions.map((item) => ({ ...item, candidates: item.candidates.map((candidate) => ({ ...candidate, tuitionFee: feeMap.get(candidate.tuitionFeeId) })) })), total, page, pageSize, pages: Math.ceil(total / pageSize) });
  } catch (error) { return handleApiError(error, "Không thể tải giao dịch ngân hàng"); }
}
