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
    const notice = await StudentFeeService.generatePaymentNotice(id);
    return apiSuccess(notice, 201);
  } catch (error) {
    return handleApiError(error, "Failed to generate temporary invoice");
  }
}
