import { NextRequest } from "next/server";
import { z } from "zod";
import { handleApiError } from "@/lib/api";
import { getAuditContext } from "@/lib/audit";
import { requireApiUser } from "@/lib/api-auth";
import { generatePaymentBatchNoticesPdf } from "@/modules/finance/payments/services/payment-batch-notice-pdf.service";

const schema = z.object({
  batchIds: z.array(z.string().uuid()).min(1).max(500).superRefine((ids, ctx) => {
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Danh sách đợt thu bị trùng" });
    }
  }),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) return user;
    const { batchIds } = schema.parse(await request.json());
    const pdf = await generatePaymentBatchNoticesPdf(
      batchIds,
      user.fullName,
      user.id,
      getAuditContext(request),
    );
    return new Response(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=thong-bao-hoc-phi.pdf",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleApiError(error, "Không thể xuất PDF thông báo học phí");
  }
}
