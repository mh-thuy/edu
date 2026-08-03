import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api";
import { requireApiRole } from "@/lib/api-auth";
import { importBankCsv } from "@/modules/finance/bank/services/bank-csv.service";

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiRole(["ADMIN", "STAFF"]); if (user instanceof Response) return user;
    const form = await request.formData();
    const file = form.get("file"); const bankAccountId = String(form.get("bankAccountId") || "");
    if (!(file instanceof File) || !bankAccountId) throw new Error("file và bankAccountId là bắt buộc");
    const result = await importBankCsv({ buffer: Buffer.from(await file.arrayBuffer()), fileName: file.name, fileUrl: `local://${file.name}`, bankAccountId, actorId: user.id });
    return apiSuccess(result, 201);
  } catch (error) { return handleApiError(error, "Không thể import sao kê ngân hàng"); }
}
