import { requireApiUser } from "@/lib/api-auth";
import { z } from "zod";
import { apiSuccess, handleApiError } from "@/lib/api";
import { convertPaymentBatchToCash } from "@/modules/finance/payments/services/payment-batch.service";

const routeParamsSchema = z.object({ id: z.string().uuid() });

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) return user;
    const { id } = routeParamsSchema.parse(await params);
    return apiSuccess(
      await convertPaymentBatchToCash(id, user.id),
    );
  } catch (error) {
    return handleApiError(error, "Không thể chuyển đợt thanh toán sang tiền mặt");
  }
}
