import { z } from "zod";
import { apiSuccess, handleApiError } from "@/lib/api";
import { StudentFeeService } from "@/modules/finance/student-fees/services/student-fee.service";

const sendNoticeSchema = z.object({
  sendMethod: z.string().trim().min(1).max(50).optional(),
});

type Params = Promise<{ id: string }>;

export async function POST(request: Request, { params }: { params: Params }) {
  try {
    const body = await request.json().catch(() => ({}));
    const validated = sendNoticeSchema.parse(body);
    const { id } = await params;
    const notice = await StudentFeeService.sendPaymentNotice(
      id,
      validated.sendMethod,
    );
    return apiSuccess(notice);
  } catch (error) {
    return handleApiError(error, "Failed to send payment notice");
  }
}
