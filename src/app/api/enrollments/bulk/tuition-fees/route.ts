import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, handleApiError } from "@/lib/api";
import { requireApiUser } from "@/lib/api-auth";
import { getAuditContext } from "@/lib/audit";
import { createEnrollmentTuitionFees } from "@/modules/finance/tuition/services/bulk-enrollment-tuition.service";

const requestSchema = z.object({
  studentId: z.string().uuid(),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  classIds: z.array(z.string().uuid()).min(1).max(50),
}).superRefine((data, context) => {
  if (new Set(data.classIds).size !== data.classIds.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["classIds"], message: "Không chọn lớp trùng lặp" });
  }
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) return user;
    const input = requestSchema.parse(await request.json());
    const results = await createEnrollmentTuitionFees(input, user.id, getAuditContext(request));
    return apiSuccess({ results });
  } catch (error: unknown) {
    return handleApiError(error, "Không thể tạo học phí cho các lớp");
  }
}
