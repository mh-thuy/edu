import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api";
import { requireApiRole } from "@/lib/api-auth";
import { PaymentService } from "@/modules/finance/payments/services/payment.service";

type Params = Promise<{ id: string }>;

export async function POST(request: NextRequest, { params }: { params: Params }) {
  try {
    const user = await requireApiRole(["ADMIN", "STAFF"]);
    if (user instanceof Response) {
      return user;
    }

    const { id } = await params;
    const receipt = await PaymentService.generateReceipt(id);

    return apiSuccess(receipt, 201);
  } catch (error) {
    return handleApiError(error, "Failed to generate receipt");
  }
}
