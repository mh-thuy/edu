import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api";
import { requireApiRole } from "@/lib/api-auth";
import { TuitionService } from "@/modules/finance/tuition/services/tuition.service";
import { tuitionFeeCreateSchema } from "@/modules/finance/tuition/schemas/tuition.schema";
import { TuitionFeeStatus } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const user = await requireApiRole(["ADMIN", "STAFF"]); if (user instanceof Response) return user;
    const params = request.nextUrl.searchParams;
    const rawStatus = params.get("status");
    const status = rawStatus && Object.values(TuitionFeeStatus).includes(rawStatus as TuitionFeeStatus) ? rawStatus as TuitionFeeStatus : undefined;
    const result = await TuitionService.listFees({ studentCode: params.get("studentCode") || undefined, classId: params.get("classId") || undefined, status, page: Number(params.get("page") || 1), pageSize: params.get("export") === "csv" ? 10000 : Number(params.get("pageSize") || 50) });
    if (params.get("export") === "csv") {
      const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
      const rows = [
        ["Mã học phí", "Mã học sinh", "Học sinh", "Lớp", "Học phí gốc", "Giảm giá", "Phụ phí", "Tổng phải thu", "Hạn thanh toán", "Trạng thái"],
        ...result.items.map((fee) => [fee.feeNo, fee.student.code, fee.student.fullName, fee.class.name, fee.originalAmount, fee.discountAmount, fee.additionalAmount, fee.finalAmount, fee.dueDate?.toISOString().slice(0, 10), fee.status]),
      ];
      return new Response(`\uFEFF${rows.map((row) => row.map(escape).join(",")).join("\r\n")}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=tuition-fees.csv" } });
    }
    return apiSuccess(result);
  } catch (error) { return handleApiError(error, "Không thể tải học phí"); }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiRole(["ADMIN", "STAFF"]); if (user instanceof Response) return user;
    return apiSuccess(await TuitionService.createFee(tuitionFeeCreateSchema.parse(await request.json()), user.id), 201);
  } catch (error) { return handleApiError(error, "Không thể tạo học phí"); }
}
