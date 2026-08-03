import { apiSuccess, handleApiError } from "@/lib/api";
import { requireApiRole } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try { const user = await requireApiRole(["ADMIN", "STAFF"]); if (user instanceof Response) return user; return apiSuccess(await prisma.bankAccount.findMany({ where: { isActive: true }, orderBy: { bankName: "asc" } })); }
  catch (error) { return handleApiError(error, "Không thể tải tài khoản ngân hàng"); }
}
