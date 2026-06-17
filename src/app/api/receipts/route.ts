import { NextRequest, NextResponse } from "next/server";
import { ReceiptService } from "@/modules/finance/receipts/services/receipt.service";
import {
  receiptCreateSchema,
  receiptFilterSchema,
} from "@/modules/finance/receipts/schemas/receipt.schema";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filter = {
      page: searchParams.get("page") || "1",
      limit: searchParams.get("limit") || "10",
      search: searchParams.get("search") || undefined,
      paymentId: searchParams.get("paymentId") || undefined,
      studentId: searchParams.get("studentId") || undefined,
      classId: searchParams.get("classId") || undefined,
      startDate: searchParams.get("startDate") || undefined,
      endDate: searchParams.get("endDate") || undefined,
      isPrinted: searchParams.get("isPrinted") || undefined,
    };

    const validated = receiptFilterSchema.parse(filter);
    const result = await ReceiptService.getReceipts(validated);

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch receipts";
    console.error("Receipts API error:", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = receiptCreateSchema.parse(body);
    const receipt = await ReceiptService.generateReceipt(validated.paymentId);

    return NextResponse.json(receipt, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create receipt";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
