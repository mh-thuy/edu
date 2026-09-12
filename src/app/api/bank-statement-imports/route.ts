import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api";
import { requireApiUser } from "@/lib/api-auth";
import { bankStatementImportSchema } from "@/modules/finance/bank/schemas/bank-reconciliation.schema";
import { importBankStatement } from "@/modules/finance/bank/services/bank-csv.service";

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser(); if (user instanceof Response) return user;
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) throw new Error("File Excel sao kê là bắt buộc");
    if (!file.name.toLowerCase().endsWith(".xlsx")) throw new Error("File sao kê phải là .xlsx");
    const { bankAccountId } = bankStatementImportSchema.parse({
      bankAccountId: String(form.get("bankAccountId") || ""),
    });
    const result = await importBankStatement({
      buffer: Buffer.from(await file.arrayBuffer()),
      fileName: file.name,
      bankAccountId,
      actorId: user.id,
    });
    return apiSuccess(result, 201);
  } catch (error) { return handleApiError(error, "Không thể import sao kê ngân hàng"); }
}
