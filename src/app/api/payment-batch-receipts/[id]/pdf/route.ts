import { NextRequest } from "next/server";
import { handleApiError } from "@/lib/api";
import { requireApiUser } from "@/lib/api-auth";
import { generatePaymentBatchReceiptPdf } from "@/modules/finance/payments/services/payment-batch-receipt-pdf.service";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) return user;
    const result = await generatePaymentBatchReceiptPdf((await params).id, user.id);
    return new Response(result.pdf, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename=bien-lai-${result.batchNo}.pdf`, "Cache-Control": "no-store" } });
  } catch (error) {
    return handleApiError(error, "Không thể xuất PDF biên lai tổng");
  }
}
