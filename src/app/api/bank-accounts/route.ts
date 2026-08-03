import { apiSuccess, handleApiError } from "@/lib/api";
import { requireApiRole } from "@/lib/api-auth";
import { bankAccountCreateSchema } from "@/modules/finance/bank/schemas/bank-account.schema";
import { createBankAccount, listBankAccounts } from "@/modules/finance/bank/services/bank-account.service";

export async function GET(request: Request) {
  try { const user = await requireApiRole(["ADMIN", "STAFF"]); if (user instanceof Response) return user; return apiSuccess(await listBankAccounts(new URL(request.url).searchParams.get("includeInactive") === "true")); }
  catch (error) { return handleApiError(error, "Không thể tải tài khoản ngân hàng"); }
}

export async function POST(request: Request) {
  try { const user = await requireApiRole(["ADMIN"]); if (user instanceof Response) return user; return apiSuccess(await createBankAccount(bankAccountCreateSchema.parse(await request.json()), user.id), 201); }
  catch (error) { return handleApiError(error, "Không thể tạo tài khoản ngân hàng"); }
}
