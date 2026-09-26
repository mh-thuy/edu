import { handleApiError } from "@/lib/api";
import { requireApiUser } from "@/lib/api-auth";
import { bankReconciliationReportSchema } from "@/modules/finance/bank/schemas/bank-reconciliation-report.schema";
import { buildBankReconciliationReportExcel } from "@/modules/finance/bank/services/bank-reconciliation-report-excel.service";

export const runtime = "nodejs";

function safeFilePart(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) return user;
    const report = bankReconciliationReportSchema.parse(await request.json());
    const file = await buildBankReconciliationReportExcel(report);
    const period = [report.statement.fromDate, report.statement.toDate]
      .filter(Boolean)
      .map((value) => safeFilePart(value!))
      .join("-");
    const fileName = `bao-cao-doi-soat-${safeFilePart(report.bankName)}-${safeFilePart(report.accountNo)}${period ? `-${period}` : ""}.xlsx`;
    return new Response(file as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleApiError(error, "Không thể xuất báo cáo đối soát ngân hàng");
  }
}
