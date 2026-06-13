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
      studentFeeId: searchParams.get("studentFeeId"),
      method: searchParams.get("method"),
      startDate: searchParams.get("startDate"),
      endDate: searchParams.get("endDate"),
    };

    const validated = paymentFilterSchema.parse(filter);
    const result = await PaymentService.getPayments(validated);

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch payments";
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
