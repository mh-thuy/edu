import { handleApiError, apiSuccess } from "@/lib/api";
import { requireApiRole } from "@/lib/api-auth";
import { bankAccountUpdateSchema } from "@/modules/finance/bank/schemas/bank-account.schema";
import { updateBankAccount } from "@/modules/finance/bank/services/bank-account.service";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const user = await requireApiRole(["ADMIN"]); if (user instanceof Response) return user; return apiSuccess(await updateBankAccount((await params).id, bankAccountUpdateSchema.parse(await request.json()), user.id)); }
  catch (error) { return handleApiError(error, "Không thể cập nhật tài khoản ngân hàng"); }
}
