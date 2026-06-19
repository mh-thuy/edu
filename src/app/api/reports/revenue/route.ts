import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, handleApiError } from "@/lib/api";
import { requireApiRole } from "@/lib/api-auth";
import { PaymentService } from "@/modules/finance/payments/services/payment.service";

const revenueQuerySchema = z.object({
  startDate: z
    .string()
    .min(1)
    .refine((value) => !Number.isNaN(Date.parse(value)), "Invalid start date"),
  endDate: z
    .string()
    .min(1)
    .refine((value) => !Number.isNaN(Date.parse(value)), "Invalid end date"),
  classId: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireApiRole(["ADMIN", "STAFF", "TEACHER"]);
    if (user instanceof Response) {
      return user;
    }

    const { searchParams } = new URL(request.url);
    const validated = revenueQuerySchema.parse({
      startDate: searchParams.get("startDate"),
      endDate: searchParams.get("endDate"),
      classId: searchParams.get("classId") || undefined,
    });

    const result = await PaymentService.getRevenueSummary(
      new Date(validated.startDate),
      new Date(validated.endDate),
      validated.classId,
    );

    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error, "Failed to fetch revenue summary");
  }
}
