import { apiSuccess, handleApiError } from "@/lib/api";
import { requireApiRole } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET() { try { const user = await requireApiRole(["ADMIN", "STAFF"]); if (user instanceof Response) return user; return apiSuccess(await prisma.tuitionReceipt.findMany({ include: { payment: { include: { tuitionFee: { include: { student: true, class: true } } } } }, orderBy: { issuedAt: "desc" }, take: 200 })); } catch (error) { return handleApiError(error, "Không thể tải biên lai"); } }
