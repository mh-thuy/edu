import { apiError, apiSuccess, handleApiError } from "@/lib/api";
import { requireApiRole } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) { try { const user = await requireApiRole(["ADMIN", "STAFF"]); if (user instanceof Response) return user; const receipt = await prisma.tuitionReceipt.findUnique({ where: { id: (await params).id }, include: { payment: { include: { tuitionFee: { include: { student: true, class: true, items: { include: { classSubject: { include: { subject: true } } } } } } } } } }); return receipt ? apiSuccess(receipt) : apiError("NOT_FOUND", "Không tìm thấy biên lai", 404); } catch (error) { return handleApiError(error, "Không thể tải biên lai"); } }
