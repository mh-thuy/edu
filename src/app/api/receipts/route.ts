import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api";
import { requireApiRole } from "@/lib/api-auth";
import { ReceiptService } from "@/modules/finance/receipts/services/receipt.service";
import {
  receiptCreateSchema,
  receiptFilterSchema,
} from "@/modules/finance/receipts/schemas/receipt.schema";

export async function GET(request: NextRequest) {
  try {
    const user = await requireApiRole(["ADMIN", "STAFF"]);
    if (user instanceof Response) {
      return user;
    }

    const { searchParams } = new URL(request.url);
    const filter = {
      page: searchParams.get("page") || "1",
      pageSize: searchParams.get("pageSize") || "10",
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

    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error, "Failed to fetch receipts");
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiRole(["ADMIN", "STAFF"]);
    if (user instanceof Response) {
      return user;
    }

    const body = await request.json();
    const validated = receiptCreateSchema.parse(body);
    const receipt = await ReceiptService.generateReceipt(validated.paymentId);

    return apiSuccess(receipt, 201);
  } catch (error) {
    return handleApiError(error, "Failed to create receipt");
  }
}
