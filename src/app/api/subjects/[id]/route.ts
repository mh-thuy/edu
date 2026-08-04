import { NextRequest } from "next/server";
import { apiError, apiSuccess, handleApiError } from "@/lib/api";
import { requireApiRole } from "@/lib/api-auth";
import { subjectUpdateSchema } from "@/modules/class/schemas/class-subject.schema";
import { updateSubject } from "@/modules/class/services/class.service";

type Params = Promise<{ id: string }>;

export async function PATCH(request: NextRequest, context: { params?: Params }) {
  try {
    const user = await requireApiRole(["ADMIN", "STAFF"]);
    if (user instanceof Response) return user;
    const params = await context.params;
    if (!params?.id) return apiError("BAD_REQUEST", "Thiếu mã môn học", 400);
    return apiSuccess(await updateSubject(params.id, subjectUpdateSchema.parse(await request.json())));
  } catch (error: unknown) {
    return handleApiError(error, "Không thể cập nhật môn học");
  }
}
