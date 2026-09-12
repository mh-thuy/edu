import { requireApiUser } from "@/lib/api-auth";
import { apiSuccess, handleApiError } from "@/lib/api";
import { getPaymentBatchDetail } from "@/modules/finance/payments/services/payment-batch.service";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) return user;
    return apiSuccess(await getPaymentBatchDetail((await params).id));
  } catch (error) {
    return handleApiError(error, "Không thể tải chi tiết đợt thanh toán");
  }
}
