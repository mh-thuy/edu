import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api";
import { requireApiRole } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { buildVietQrUrl } from "@/modules/finance/tuition/services/vietqr.service";

export async function GET(request: NextRequest) {
  try {
    const user = await requireApiRole(["ADMIN", "STAFF"]); if (user instanceof Response) return user;
    const id = request.nextUrl.searchParams.get("tuitionFeeId") || "";
    if (!id) throw new Error("tuitionFeeId là bắt buộc");
    const fees = await prisma.tuitionFee.findMany({ where: { id, status: { in: ["UNPAID", "OVERDUE"] } }, include: { student: true } });
    if (fees.length !== 1) throw new Error("Không tìm thấy khoản học phí có thể thanh toán");
    const account = await prisma.bankAccount.findFirst({ where: { isActive: true }, orderBy: { createdAt: "asc" } });
    if (!account) throw new Error("Chưa cấu hình tài khoản ngân hàng nhận học phí");
    const amount = fees.reduce((total, fee) => total + Number(fee.finalAmount), 0);
    const content = `HP ${fees[0]?.student.code || ""} ${fees[0]?.feeNo || ""}`.slice(0, 50);
    const qrUrl = buildVietQrUrl({ bankCode: account.bankCode, accountNo: account.accountNo, accountName: account.accountName, amount, addInfo: content });
    return apiSuccess({ qrUrl, amount, account });
  } catch (error) { return handleApiError(error, "Không thể tạo QR thanh toán"); }
}
