import { NextRequest, NextResponse } from "next/server";
import { PaymentService } from "@/modules/finance/payments/services/payment.service";

type Params = Promise<{ id: string }>;

export async function POST(request: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const receipt = await PaymentService.generateReceipt(id);

    return NextResponse.json(receipt, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate receipt";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
