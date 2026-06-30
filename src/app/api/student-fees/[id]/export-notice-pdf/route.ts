import { apiSuccess, handleApiError } from "@/lib/api";
import { requireApiRole } from "@/lib/api-auth";
import { StudentFeeService } from "@/modules/finance/student-fees/services/student-fee.service";

type Params = Promise<{ id: string }>;

export async function POST(_: Request, { params }: { params: Params }) {
  try {
    const user = await requireApiRole(["ADMIN", "STAFF"]);
    if (user instanceof Response) {
      return user;
    }

    const { id } = await params;
    const result = await StudentFeeService.exportPaymentNoticePdf(id);
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error, "Failed to export payment notice PDF");
  }
}
