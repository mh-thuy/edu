import { NextRequest } from "next/server";
import { apiError, apiSuccess, handleApiError } from "@/lib/api";
import { requireApiRole } from "@/lib/api-auth";
import { TuitionService } from "@/modules/finance/tuition/services/tuition.service";
import { TuitionFeeStatus } from "@prisma/client";
import { z } from "zod";

export async function GET(request: NextRequest) {
  try {
    const user = await requireApiRole(["ADMIN", "STAFF"]); if (user instanceof Response) return user;
    const params = request.nextUrl.searchParams;
    const rawStatus = params.get("status");
    const status = rawStatus && Object.values(TuitionFeeStatus).includes(rawStatus as TuitionFeeStatus) ? rawStatus as TuitionFeeStatus : undefined;
    const rawMonth = params.get("month");
    const month = rawMonth ? z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).safeParse(rawMonth) : null;
    if (rawMonth && (!month || !month.success)) return apiError("VALIDATION_ERROR", "Kỳ học phí phải có định dạng YYYY-MM", 400);
    const billingYear = month?.success ? Number(month.data.slice(0, 4)) : undefined;
    const billingMonth = month?.success ? Number(month.data.slice(5, 7)) : undefined;
    const result = await TuitionService.listFees({ studentCode: params.get("studentCode") || undefined, classId: params.get("classId") || undefined, status, billingYear, billingMonth, page: Number(params.get("page") || 1), pageSize: params.get("export") === "csv" ? 10000 : Number(params.get("pageSize") || 50) });
    if (params.get("export") === "csv") {
      const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
      const rows = [
        ["Mã học phí", "Mã học sinh", "Học sinh", "Lớp", "Kỳ", "Học phí gốc", "Giảm giá", "Phụ phí", "Tổng phải thu", "Hạn thanh toán", "Trạng thái"],
        ...result.items.map((fee) => [fee.feeNo, fee.student.code, fee.student.fullName, fee.class.name, `${fee.billingYear}-${String(fee.billingMonth).padStart(2, "0")}`, fee.originalAmount, fee.discountAmount, fee.additionalAmount, fee.finalAmount, fee.dueDate?.toISOString().slice(0, 10), fee.status]),
      ];
      return new Response(`\uFEFF${rows.map((row) => row.map(escape).join(",")).join("\r\n")}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=tuition-fees.csv" } });
    }
    return apiSuccess(result);
  } catch (error) { return handleApiError(error, "Không thể tải học phí"); }
}
