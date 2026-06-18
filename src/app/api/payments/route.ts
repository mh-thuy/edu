import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api";
import { PaymentService } from "@/modules/finance/payments/services/payment.service";
import {
  paymentCreateSchema,
  paymentFilterSchema,
} from "@/modules/finance/payments/schemas/payment.schema";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filter = {
      page: searchParams.get("page") || "1",
      pageSize: searchParams.get("pageSize") || "10",
      search: searchParams.get("search") || undefined,
      studentFeeId: searchParams.get("studentFeeId") || undefined,
      method: searchParams.get("method") || undefined,
      startDate: searchParams.get("startDate") || undefined,
      endDate: searchParams.get("endDate") || undefined,
    };

    const validated = paymentFilterSchema.parse(filter);
    const result = await PaymentService.getPayments(validated);

    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error, "Failed to fetch payments");
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = paymentCreateSchema.parse(body);
    const payment = await PaymentService.createPayment(validated);

    return apiSuccess(payment, 201);
  } catch (error) {
    return handleApiError(error, "Failed to create payment");
  }
}
