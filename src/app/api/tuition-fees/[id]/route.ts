import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api";
import { requireApiUser } from "@/lib/api-auth";
import { TuitionService } from "@/modules/finance/tuition/services/tuition.service";
import { tuitionFeeStatusSchema, tuitionFeeUpdateSchema } from "@/modules/finance/tuition/schemas/tuition.schema";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) { try { const user = await requireApiUser(); if (user instanceof Response) return user; return apiSuccess(await TuitionService.getFee((await params).id)); } catch (error) { return handleApiError(error, "Không thể tải học phí"); } }
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { try { const user = await requireApiUser(); if (user instanceof Response) return user; return apiSuccess(await TuitionService.updateFee((await params).id, tuitionFeeUpdateSchema.parse(await request.json()), user.id)); } catch (error) { return handleApiError(error, "Không thể cập nhật học phí"); } }
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { try { const user = await requireApiUser(); if (user instanceof Response) return user; return apiSuccess(await TuitionService.updateStatus((await params).id, tuitionFeeStatusSchema.parse(await request.json()), user.id)); } catch (error) { return handleApiError(error, "Không thể thay đổi trạng thái học phí"); } }
