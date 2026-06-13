import { NextRequest, NextResponse } from "next/server";
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
      limit: searchParams.get("limit") || "10",
      studentFeeId: searchParams.get("studentFeeId") || undefined,
      method: searchParams.get("method") || undefined,
      startDate: searchParams.get("startDate") || undefined,
      endDate: searchParams.get("endDate") || undefined,
    };

    const validated = paymentFilterSchema.parse(filter);
    const result = await PaymentService.getPayments(validated);

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch payments";
    console.error("Payments API error:", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = paymentCreateSchema.parse(body);
    const payment = await PaymentService.createPayment(validated);

    return NextResponse.json(payment, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create payment";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
