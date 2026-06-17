import { NextRequest, NextResponse } from "next/server";
import { PaymentService } from "@/modules/finance/payments/services/payment.service";
import { paymentUpdateSchema } from "@/modules/finance/payments/schemas/payment.schema";

type Params = Promise<{ id: string }>;

export async function GET(request: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const payment = await PaymentService.getPaymentById(id);

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    return NextResponse.json(payment);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch payment";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const body = await request.json();

    const validated = paymentUpdateSchema.parse(body);
    const updated = await PaymentService.updatePayment(id, {
      ...validated,
      paymentDate: validated.paymentDate
        ? new Date(validated.paymentDate)
        : undefined,
    });

    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update payment";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    await PaymentService.deletePayment(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete payment";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
