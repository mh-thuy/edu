import { NextRequest } from "next/server";
import { apiError, apiSuccess, handleApiError } from "@/lib/api";
import { requireApiUser } from "@/lib/api-auth";
import { createPaymentBatch, listPaymentBatches } from "@/modules/finance/payments/services/payment-batch.service";
import { paymentBatchCreateSchema } from "@/modules/finance/payments/schemas/payment-batch.schema";
import { PaymentBatchStatus } from "@prisma/client";
import { getAuditContext } from "@/lib/audit";

export async function GET(request: NextRequest) { try { const user = await requireApiUser(); if (user instanceof Response) return user; const params = request.nextUrl.searchParams; const rawStatus = params.get("status"); if (rawStatus && !Object.values(PaymentBatchStatus).includes(rawStatus as PaymentBatchStatus)) return apiError("VALIDATION_ERROR", "Trạng thái payment batch không hợp lệ", 422); const status = rawStatus ? rawStatus as PaymentBatchStatus : undefined; return apiSuccess(await listPaymentBatches({ studentCode: params.get("studentCode") || undefined, status, page: Number(params.get("page") || 1), pageSize: Number(params.get("pageSize") || 20) })); } catch (error) { return handleApiError(error, "Không thể tải lịch sử thu học phí"); } }

export async function POST(request: NextRequest) { try { const user = await requireApiUser(); if (user instanceof Response) return user; return apiSuccess(await createPaymentBatch(paymentBatchCreateSchema.parse(await request.json()), user.id, undefined, getAuditContext(request)), 201); } catch (error) { return handleApiError(error, "Không thể tạo thanh toán tổng"); } }
