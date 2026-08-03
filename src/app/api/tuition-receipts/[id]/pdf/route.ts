import { NextRequest } from "next/server";
import { handleApiError } from "@/lib/api";
import { requireApiRole } from "@/lib/api-auth";
import { generateTuitionReceiptPdf } from "@/modules/finance/tuition/services/tuition-receipt-pdf.service";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiRole(["ADMIN", "STAFF"]); if (user instanceof Response) return user;
    const pdf = await generateTuitionReceiptPdf((await params).id);
    return new Response(pdf, { headers: { "Content-Type": "application/pdf", "Content-Disposition": "attachment; filename=bien-lai-hoc-phi.pdf", "Cache-Control": "no-store" } });
  } catch (error) { return handleApiError(error, "Không thể xuất PDF biên lai"); }
}
