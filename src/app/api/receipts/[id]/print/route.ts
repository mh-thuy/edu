import { NextRequest, NextResponse } from "next/server";
import { ReceiptService } from "@/modules/finance/receipts/services/receipt.service";

type Params = Promise<{ id: string }>;

export async function POST(request: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const receipt = await ReceiptService.markAsPrinted(id);

    return NextResponse.json(receipt);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to mark receipt as printed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
