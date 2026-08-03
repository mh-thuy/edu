import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api";
import { requireApiRole } from "@/lib/api-auth";
import { confirmBankBatchTransaction, confirmBankTransaction } from "@/modules/finance/bank/services/bank-csv.service";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiRole(["ADMIN", "STAFF"]); if (user instanceof Response) return user;
    const body = await request.json() as { tuitionFeeId?: string; batchId?: string };
    if (body.batchId) return apiSuccess(await confirmBankBatchTransaction((await params).id, body.batchId, user.id));
    if (!body.tuitionFeeId) throw new Error("tuitionFeeId hoặc batchId là bắt buộc");
    return apiSuccess(await confirmBankTransaction((await params).id, body.tuitionFeeId, user.id));
  } catch (error) { return handleApiError(error, "Không thể xác nhận đối soát"); }
}
