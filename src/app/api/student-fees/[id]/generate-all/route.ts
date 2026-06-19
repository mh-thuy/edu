import { apiSuccess, handleApiError } from "@/lib/api";
import { StudentFeeService } from "@/modules/finance/student-fees/services/student-fee.service";

type Params = Promise<{ id: string }>;

export async function POST(_: Request, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const result = await StudentFeeService.generateAll(id);
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error, "Failed to generate full tuition flow");
  }
}
