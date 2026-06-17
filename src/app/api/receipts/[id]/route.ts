import { NextRequest, NextResponse } from "next/server";
import { ReceiptService } from "@/modules/finance/receipts/services/receipt.service";

type Params = Promise<{ id: string }>;

export async function GET(request: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const receipt = await ReceiptService.getReceiptById(id);

    if (!receipt) {
      return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
    }

    return NextResponse.json(receipt);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch receipt";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    await ReceiptService.deleteReceipt(id);

    return NextResponse.json({ message: "Receipt deleted successfully" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete receipt";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
