import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api";
import { requireApiRole } from "@/lib/api-auth";
import { importStudentsCsv } from "@/modules/student/services/student-import.service";

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiRole(["ADMIN", "STAFF"]);
    if (user instanceof Response) return user;

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new Error("Vui lòng chọn file CSV");
    }

    const result = await importStudentsCsv(Buffer.from(await file.arrayBuffer()));
    return apiSuccess(result, 201);
  } catch (error: unknown) {
    return handleApiError(error, "Không thể import học viên");
  }
}
