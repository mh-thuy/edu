import { requireApiRole } from "@/lib/api-auth";
import { handleApiError } from "@/lib/api";
import { generatePaymentBatchNoticePdf } from "@/modules/finance/payments/services/payment-batch-notice-pdf.service";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiRole(["ADMIN", "STAFF"]);
    if (user instanceof Response) return user;
    const result = await generatePaymentBatchNoticePdf((await params).id);
    return new Response(result.pdf, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename=thong-bao-${result.batchNo}.pdf`, "Cache-Control": "no-store" } });
  } catch (error) {
    return handleApiError(error, "Không thể xuất PDF thông báo thanh toán tổng");
  }
}
