import { apiSuccess, handleApiError } from "@/lib/api";
import { requireApiUser } from "@/lib/api-auth";
import { approvePaymentRefund } from "@/modules/finance/refunds/services/payment-refund.service";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) return user;
    return apiSuccess(await approvePaymentRefund((await params).id, user.id));
  } catch (error) {
    return handleApiError(error, "Không thể duyệt hoàn tiền");
  }
}
