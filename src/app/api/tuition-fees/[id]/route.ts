import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api";
import { requireApiRole } from "@/lib/api-auth";
import { TuitionService } from "@/modules/finance/tuition/services/tuition.service";
import { tuitionFeeUpdateSchema } from "@/modules/finance/tuition/schemas/tuition.schema";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) { try { const user = await requireApiRole(["ADMIN", "STAFF"]); if (user instanceof Response) return user; return apiSuccess(await TuitionService.getFee((await params).id)); } catch (error) { return handleApiError(error, "Không thể tải học phí"); } }
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { try { const user = await requireApiRole(["ADMIN", "STAFF"]); if (user instanceof Response) return user; return apiSuccess(await TuitionService.updateFee((await params).id, tuitionFeeUpdateSchema.parse(await request.json()), user.id)); } catch (error) { return handleApiError(error, "Không thể cập nhật học phí"); } }
