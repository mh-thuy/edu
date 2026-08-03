import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api";
import { requireApiRole } from "@/lib/api-auth";
import { TuitionService } from "@/modules/finance/tuition/services/tuition.service";
import { tuitionPaymentCreateSchema } from "@/modules/finance/tuition/schemas/tuition.schema";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const user = await requireApiRole(["ADMIN", "STAFF"]); if (user instanceof Response) return user;
    const params = request.nextUrl.searchParams;
    if (params.get("history") === "1") return apiSuccess(await prisma.tuitionPayment.findMany({ include: { tuitionFee: { include: { student: true, class: true } }, receipt: true }, orderBy: { paymentDate: "desc" }, take: 200 }));
    return apiSuccess(await TuitionService.listFees({ studentCode: params.get("studentCode") || undefined, page: Number(params.get("page") || 1), pageSize: Number(params.get("pageSize") || 50) }));
  } catch (error) { return handleApiError(error, "Không thể tải các khoản cần thanh toán"); }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiRole(["ADMIN", "STAFF"]); if (user instanceof Response) return user;
    return apiSuccess(await TuitionService.createPayment(tuitionPaymentCreateSchema.parse(await request.json()), user.id), 201);
  } catch (error) { return handleApiError(error, "Không thể ghi nhận thanh toán"); }
}
