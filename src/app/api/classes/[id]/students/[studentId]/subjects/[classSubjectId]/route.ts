import { apiSuccess, handleApiError } from "@/lib/api";
import { requireApiRole } from "@/lib/api-auth";
import { removeSubjectFromEnrollment } from "@/modules/class/services/class.service";

type Params = Promise<{
  id: string;
  studentId: string;
  classSubjectId: string;
}>;

export async function DELETE(
  _request: Request,
  context: { params: Params },
) {
  try {
    const user = await requireApiRole(["ADMIN", "STAFF"]);
    if (user instanceof Response) return user;
    const { id, studentId, classSubjectId } = await context.params;
    const result = await removeSubjectFromEnrollment(
      id,
      studentId,
      classSubjectId,
      user.id,
    );
    return apiSuccess(result);
  } catch (error: unknown) {
    return handleApiError(error, "Không thể bỏ môn học của học viên");
  }
}
