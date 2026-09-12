import { apiSuccess, handleApiError } from "@/lib/api";
import { requireApiUser } from "@/lib/api-auth";
import { paymentRefundCompleteSchema } from "@/modules/finance/refunds/schemas/payment-refund.schema";
import { completePaymentRefund } from "@/modules/finance/refunds/services/payment-refund.service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) return user;
    const data = paymentRefundCompleteSchema.parse(await request.json());
    return apiSuccess(await completePaymentRefund((await params).id, user.id, data));
  } catch (error) {
    return handleApiError(error, "Không thể hoàn tất hoàn tiền");
  }
}
