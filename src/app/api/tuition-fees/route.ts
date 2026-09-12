import { NextRequest } from "next/server";
import { apiError, apiSuccess, handleApiError } from "@/lib/api";
import { requireApiUser } from "@/lib/api-auth";
import { TuitionService } from "@/modules/finance/tuition/services/tuition.service";
import { TuitionFeeBillingType, TuitionFeeStatus } from "@prisma/client";
import { z } from "zod";

export async function GET(request: NextRequest) {
  try {
    const user = await requireApiUser(); if (user instanceof Response) return user;
    const params = request.nextUrl.searchParams;
    const rawStatus = params.get("status");
    const status = rawStatus && Object.values(TuitionFeeStatus).includes(rawStatus as TuitionFeeStatus) ? rawStatus as TuitionFeeStatus : undefined;
    const rawBillingType = params.get("billingType");
    const billingType = rawBillingType && Object.values(TuitionFeeBillingType).includes(rawBillingType as TuitionFeeBillingType) ? rawBillingType as TuitionFeeBillingType : undefined;
    const rawMonth = params.get("month");
    const month = rawMonth ? z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).safeParse(rawMonth) : null;
    if (rawMonth && (!month || !month.success)) return apiError("VALIDATION_ERROR", "Kỳ học phí phải có định dạng YYYY-MM", 400);
    const billingYear = month?.success ? Number(month.data.slice(0, 4)) : undefined;
    const billingMonth = month?.success ? Number(month.data.slice(5, 7)) : undefined;
    const filters = {
      studentCode: params.get("studentCode") || undefined,
      classId: params.get("classId") || undefined,
      status,
      billingType,
      billingYear,
      billingMonth,
    };
    const isExport = params.get("export") === "csv";
    let result = await TuitionService.listFees({
      ...filters,
      page: isExport ? 1 : Number(params.get("page") || 1),
      pageSize: isExport ? 100 : Number(params.get("pageSize") || 50),
    });
    if (isExport) {
      const allItems = [...result.items];
      for (let page = 2; page <= result.pagination.totalPages; page += 1) {
        const nextPage = await TuitionService.listFees({
          ...filters,
          page,
          pageSize: 100,
        });
        allItems.push(...nextPage.items);
      }
      result = { ...result, items: allItems };
      const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
      const rows = [
        ["Mã học phí", "Mã học sinh", "Học sinh", "Lớp", "Loại phí", "Kỳ", "Học phí gốc", "Giảm giá", "Phụ phí", "Tổng phải thu", "Hạn thanh toán", "Trạng thái"],
        ...result.items.map((fee) => [fee.feeNo, fee.student.code, fee.student.fullName, fee.class.name, fee.billingType, `${fee.billingYear}-${String(fee.billingMonth).padStart(2, "0")}`, fee.originalAmount, fee.discountAmount, fee.additionalAmount, fee.finalAmount, fee.dueDate?.toISOString().slice(0, 10), fee.status]),
      ];
      return new Response(`\uFEFF${rows.map((row) => row.map(escape).join(",")).join("\r\n")}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=tuition-fees.csv" } });
    }
    return apiSuccess(result);
  } catch (error) { return handleApiError(error, "Không thể tải học phí"); }
}
