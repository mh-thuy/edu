import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, handleApiError } from "@/lib/api";
import { requireApiRole } from "@/lib/api-auth";
import { cancelPaymentBatch } from "@/modules/finance/payments/services/payment-batch.service";

const schema = z.object({ reason: z.string().trim().min(1, "Lý do hủy là bắt buộc").max(500) });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiRole(["ADMIN", "STAFF"]);
    if (user instanceof Response) return user;
    const data = schema.parse(await request.json());
    return apiSuccess(await cancelPaymentBatch((await params).id, user.id, data.reason));
  } catch (error) {
    return handleApiError(error, "Không thể hủy batch thanh toán");
  }
}
