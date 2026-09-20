import { NextRequest } from "next/server";
import { z } from "zod";
import { handleApiError } from "@/lib/api";
import { requireApiUser } from "@/lib/api-auth";
import { generatePaymentBatchReceiptPdf } from "@/modules/finance/payments/services/payment-batch-receipt-pdf.service";
import { getAuditContext } from "@/lib/audit";

const routeParamsSchema = z.object({ id: z.string().uuid() });

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) return user;
    const { id } = routeParamsSchema.parse(await params);
    const result = await generatePaymentBatchReceiptPdf(id, user.id, getAuditContext(request));
    return new Response(result.pdf, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename=bien-lai-${result.batchNo}.pdf`, "Cache-Control": "no-store" } });
  } catch (error) {
    return handleApiError(error, "Không thể xuất PDF biên lai tổng");
  }
}
