import { NotFoundError } from "@/lib/errors";
import { handleApiError } from "@/lib/api";
import { StudentFeeAssetService } from "@/modules/finance/student-fees/services/student-fee-asset.service";

type Params = Promise<{ fileName: string }>;

export async function GET(_: Request, { params }: { params: Params }) {
  try {
    const { fileName } = await params;
    const bytes = await StudentFeeAssetService.readNoticePdf(fileName);

    if (!bytes) {
      throw new NotFoundError("Không tìm thấy file PDF");
    }

    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return handleApiError(error, "Không thể tải file PDF");
  }
}
