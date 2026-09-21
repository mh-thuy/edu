import { NextRequest } from "next/server";
import { apiError, apiSuccess, handleApiError } from "@/lib/api";
import { requireApiUser } from "@/lib/api-auth";
import { createPaymentBatch, listPaymentBatches } from "@/modules/finance/payments/services/payment-batch.service";
import { paymentBatchCreateSchema } from "@/modules/finance/payments/schemas/payment-batch.schema";
import { PaymentBatchStatus } from "@prisma/client";
import { getAuditContext } from "@/lib/audit";
import { z } from "zod";

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) return user;
    const params = request.nextUrl.searchParams;
    const pagination = paginationSchema.parse({
      page: params.get("page") ?? undefined,
      pageSize: params.get("pageSize") ?? undefined,
    });
    const rawStatus = params.get("status");
    if (rawStatus && !Object.values(PaymentBatchStatus).includes(rawStatus as PaymentBatchStatus)) {
      return apiError("VALIDATION_ERROR", "Trạng thái payment batch không hợp lệ", 422);
    }
    const status = rawStatus ? rawStatus as PaymentBatchStatus : undefined;
    return apiSuccess(await listPaymentBatches({
      transactionCode: params.get("transactionCode") || undefined,
      studentCode: params.get("studentCode") || undefined,
      status,
      ...pagination,
    }));
  } catch (error) {
    return handleApiError(error, "Không thể tải lịch sử thu học phí");
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) return user;
    const body = paymentBatchCreateSchema.parse(await request.json());
    const headerKey = request.headers.get("Idempotency-Key")?.trim() || undefined;
    if (headerKey && body.idempotencyKey && headerKey !== body.idempotencyKey) {
      return apiError("VALIDATION_ERROR", "Idempotency-Key không khớp với request", 422);
    }
    const idempotencyKey = headerKey || body.idempotencyKey;
    if (!idempotencyKey || idempotencyKey.length > 150) {
      return apiError("VALIDATION_ERROR", "Idempotency-Key là bắt buộc", 422);
    }
    return apiSuccess(
      await createPaymentBatch(
        { ...body, idempotencyKey },
        user.id,
        undefined,
        getAuditContext(request),
      ),
      201,
    );
  } catch (error) {
    return handleApiError(error, "Không thể tạo thanh toán tổng");
  }
}
