import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, handleApiError } from "@/lib/api";
import { requireApiRole } from "@/lib/api-auth";
import { completeFullRefund } from "@/modules/finance/tuition/services/tuition-refund.service";

const schema = z.object({ paymentId: z.string().uuid(), refundMethod: z.enum(["CASH", "BANK_TRANSFER", "OTHER"]), reason: z.string().trim().min(1).max(1000), bankTransactionNo: z.string().trim().max(150).optional() });
export async function POST(request: NextRequest) { try { const user = await requireApiRole(["ADMIN"]); if (user instanceof Response) return user; const data = schema.parse(await request.json()); const { paymentId, ...refund } = data; return apiSuccess(await completeFullRefund(paymentId, refund, user.id), 201); } catch (error) { return handleApiError(error, "Không thể hoàn tiền"); } }
