import { requireApiRole } from "@/lib/api-auth";
import { apiSuccess, handleApiError } from "@/lib/api";
import { convertPaymentBatchToCash } from "@/modules/finance/payments/services/payment-batch.service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiRole(["ADMIN", "STAFF"]);
    if (user instanceof Response) return user;
    return apiSuccess(
      await convertPaymentBatchToCash((await params).id, user.id),
    );
  } catch (error) {
    return handleApiError(error, "Không thể chuyển đợt thanh toán sang tiền mặt");
  }
}
