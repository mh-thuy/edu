import { apiSuccess, handleApiError } from "@/lib/api";
import { StudentFeeService } from "@/modules/finance/student-fees/services/student-fee.service";

type Params = Promise<{ id: string }>;

export async function POST(_: Request, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const qr = await StudentFeeService.generatePaymentQr(id);
    return apiSuccess(qr, 201);
  } catch (error) {
    return handleApiError(error, "Failed to generate payment QR");
  }
}
