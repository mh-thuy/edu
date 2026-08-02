import { apiSuccess, handleApiError } from "@/lib/api";
import { StudentFeeService } from "@/modules/finance/student-fees/services/student-fee.service";

type Params = Promise<{ id: string }>;

export async function POST(_: Request, { params }: { params: Params }) {
  try {
    const { id } = await params;
    return apiSuccess(await StudentFeeService.generatePaymentPackage(id));
  } catch (error) {
    return handleApiError(error, "Không thể tạo bộ thanh toán");
  }
}
