import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api";
import { ReceiptService } from "@/modules/finance/receipts/services/receipt.service";

type Params = Promise<{ id: string }>;

export async function POST(request: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const receipt = await ReceiptService.markAsPrinted(id);

    return apiSuccess(receipt);
  } catch (error) {
    return handleApiError(error, "Failed to mark receipt as printed");
  }
}
