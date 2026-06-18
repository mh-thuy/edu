import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api";
import { requireApiRole } from "@/lib/api-auth";
import { classFilterSchema } from "@/modules/class/schemas/class.schema";
import { getClassesByTeacherUserId } from "@/modules/class/services/class.service";

export async function GET(request: NextRequest) {
  try {
    const user = await requireApiRole(["TEACHER"]);
    if (user instanceof Response) {
      return user;
    }

    const searchParams = request.nextUrl.searchParams;
    const filter = classFilterSchema.parse({
      search: searchParams.get("search") || undefined,
      status: searchParams.get("status") || undefined,
      page: parseInt(searchParams.get("page") || "1"),
      pageSize: parseInt(searchParams.get("pageSize") || "10"),
    });

    const result = await getClassesByTeacherUserId(user.id, filter);
    return apiSuccess(result);
  } catch (error: unknown) {
    return handleApiError(error, "Failed to fetch teacher classes");
  }
}
