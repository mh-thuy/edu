import { NextRequest } from "next/server";
import { apiError, apiSuccess, handleApiError } from "@/lib/api";
import { requireApiRole } from "@/lib/api-auth";
import { PaymentService } from "@/modules/finance/payments/services/payment.service";
import { paymentUpdateSchema } from "@/modules/finance/payments/schemas/payment.schema";

type Params = Promise<{ id: string }>;

export async function GET(request: NextRequest, { params }: { params: Params }) {
  try {
    const user = await requireApiRole(["ADMIN", "STAFF"]);
    if (user instanceof Response) {
      return user;
    }

    const { id } = await params;
    const payment = await PaymentService.getPaymentById(id);

    if (!payment) {
      return apiError("NOT_FOUND", "Payment not found", 404);
    }

    return apiSuccess(payment);
  } catch (error) {
    return handleApiError(error, "Failed to fetch payment");
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Params }) {
  try {
    const user = await requireApiRole(["ADMIN", "STAFF"]);
    if (user instanceof Response) {
      return user;
    }

    const { id } = await params;
    const body = await request.json();

    const validated = paymentUpdateSchema.parse(body);
    const updated = await PaymentService.updatePayment(id, validated);

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error, "Failed to update payment");
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Params }) {
  try {
    const user = await requireApiRole(["ADMIN"]);
    if (user instanceof Response) {
      return user;
    }

    const { id } = await params;
    await PaymentService.deletePayment(id);

    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error, "Failed to delete payment");
  }
}
