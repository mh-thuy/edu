import { requireApiRole } from "@/lib/api-auth";
import { handleApiError } from "@/lib/api";
import { createClassPaymentBatches, generateClassTuitionNoticePdf } from "@/modules/finance/tuition/services/class-tuition-notice-pdf.service";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiRole(["ADMIN", "STAFF"]);
    if (user instanceof Response) return user;
    const classId = (await params).id;
    await createClassPaymentBatches(classId, user.id);
    const result = await generateClassTuitionNoticePdf(classId, user.fullName);
    const inline = new URL(request.url).searchParams.get("inline") === "1";
    return new Response(result.pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename=thong-bao-hoc-phi-${result.classCode}.pdf`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleApiError(error, "Không thể xuất thông báo học phí theo lớp");
  }
}
