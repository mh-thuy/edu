import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api";
import { requireApiRole } from "@/lib/api-auth";
import { PaymentService } from "@/modules/finance/payments/services/payment.service";

type Params = Promise<{ id: string }>;

export async function POST(
  _request: NextRequest,
  { params }: { params: Params },
) {
  try {
    const user = await requireApiRole(["ADMIN", "STAFF"]);
    if (user instanceof Response) {
      return user;
    }

    const { id } = await params;
    const payment = await PaymentService.confirmPayment(id);

    return apiSuccess(payment);
  } catch (error) {
    return handleApiError(error, "Failed to confirm payment");
  }
}
