import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, handleApiError } from "@/lib/api";
import { requireApiRole } from "@/lib/api-auth";
import { pauseStudentEnrollment } from "@/modules/class/services/class.service";

const pauseSchema = z.object({
  startMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  endMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  reason: z.string().max(500).optional(),
});

type Params = Promise<{
  id: string;
  studentId: string;
}>;

export async function POST(
  request: NextRequest,
  context: { params: Params },
) {
  try {
    const user = await requireApiRole(["ADMIN", "STAFF"]);
    if (user instanceof Response) return user;
    const { id, studentId } = await context.params;
    const data = pauseSchema.parse(await request.json());
    const result = await pauseStudentEnrollment(id, studentId, data, user.id);
    return apiSuccess(result, 201);
  } catch (error: unknown) {
    return handleApiError(error, "Không thể tạo thời gian tạm nghỉ");
  }
}
