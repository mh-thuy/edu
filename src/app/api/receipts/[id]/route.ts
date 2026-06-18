import { NextRequest } from "next/server";
import { apiError, apiSuccess, handleApiError } from "@/lib/api";
import { requireApiRole } from "@/lib/api-auth";
import { ReceiptService } from "@/modules/finance/receipts/services/receipt.service";

type Params = Promise<{ id: string }>;

export async function GET(request: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const receipt = await ReceiptService.getReceiptById(id);

    if (!receipt) {
      return apiError("NOT_FOUND", "Receipt not found", 404);
    }

    return apiSuccess(receipt);
  } catch (error) {
    return handleApiError(error, "Failed to fetch receipt");
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Params }) {
  try {
    const user = await requireApiRole(["ADMIN"]);
    if (user instanceof Response) {
      return user;
    }

    const { id } = await params;
    await ReceiptService.deleteReceipt(id);

    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error, "Failed to delete receipt");
  }
}
