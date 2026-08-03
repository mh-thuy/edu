import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api";
import { requireApiRole } from "@/lib/api-auth";
import { createPaymentBatch, listPaymentBatches } from "@/modules/finance/payments/services/payment-batch.service";
import { paymentBatchCreateSchema } from "@/modules/finance/payments/schemas/payment-batch.schema";
import { PaymentBatchStatus } from "@prisma/client";

export async function GET(request: NextRequest) { try { const user = await requireApiRole(["ADMIN", "STAFF"]); if (user instanceof Response) return user; const params = request.nextUrl.searchParams; const rawStatus = params.get("status"); const status = rawStatus && Object.values(PaymentBatchStatus).includes(rawStatus as PaymentBatchStatus) ? rawStatus as PaymentBatchStatus : undefined; return apiSuccess(await listPaymentBatches({ studentCode: params.get("studentCode") || undefined, status, page: Number(params.get("page") || 1), pageSize: Number(params.get("pageSize") || 20) })); } catch (error) { return handleApiError(error, "Không thể tải lịch sử thu học phí"); } }

export async function POST(request: NextRequest) { try { const user = await requireApiRole(["ADMIN", "STAFF"]); if (user instanceof Response) return user; return apiSuccess(await createPaymentBatch(paymentBatchCreateSchema.parse(await request.json()), user.id), 201); } catch (error) { return handleApiError(error, "Không thể tạo thanh toán tổng"); } }
