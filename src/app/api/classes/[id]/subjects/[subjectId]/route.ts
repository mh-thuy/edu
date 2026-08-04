import { NextRequest } from "next/server";
import { apiError, apiSuccess, handleApiError } from "@/lib/api";
import { requireApiRole } from "@/lib/api-auth";
import { classSubjectUpdateSchema } from "@/modules/class/schemas/class-subject.schema";
import { removeClassSubject, updateClassSubject } from "@/modules/class/services/class.service";

type Params = Promise<{ id: string; subjectId: string }>;

async function getIds(context: { params?: Params }) {
  const params = await context.params;
  if (!params?.id || !params.subjectId) throw new Error("CLASS_SUBJECT_IDS_REQUIRED");
  return params;
}

export async function PATCH(request: NextRequest, context: { params?: Params }) {
  try {
    const user = await requireApiRole(["ADMIN", "STAFF"]);
    if (user instanceof Response) return user;
    const { id, subjectId } = await getIds(context);
    return apiSuccess(await updateClassSubject(id, subjectId, classSubjectUpdateSchema.parse(await request.json())));
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "CLASS_SUBJECT_IDS_REQUIRED") return apiError("BAD_REQUEST", "Thiếu mã lớp hoặc môn học", 400);
    return handleApiError(error, "Không thể cập nhật môn học");
  }
}

export async function DELETE(_request: NextRequest, context: { params?: Params }) {
  try {
    const user = await requireApiRole(["ADMIN", "STAFF"]);
    if (user instanceof Response) return user;
    const { id, subjectId } = await getIds(context);
    await removeClassSubject(id, subjectId);
    return apiSuccess({ id: subjectId });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "CLASS_SUBJECT_IDS_REQUIRED") return apiError("BAD_REQUEST", "Thiếu mã lớp hoặc môn học", 400);
    return handleApiError(error, "Không thể xóa môn học");
  }
}
