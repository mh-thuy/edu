import { apiSuccess, handleApiError } from "@/lib/api";
import { requireApiUser } from "@/lib/api-auth";
import { bankReconciliationConfirmSchema } from "@/modules/finance/bank/schemas/bank-reconciliation.schema";
import { confirmBankReconciliation } from "@/modules/finance/bank/services/bank-csv.service";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) return user;
    const body = bankReconciliationConfirmSchema.parse(await request.json());
    return apiSuccess(await confirmBankReconciliation({ ...body, actorId: user.id }));
  } catch (error) {
    return handleApiError(error, "Không thể xác nhận đối soát");
  }
}
