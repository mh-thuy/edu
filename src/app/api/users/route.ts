import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api";
import { requireApiRole } from "@/lib/api-auth";
import { userCreateSchema, userFilterSchema } from "@/modules/user/schemas/user.schema";
import { createUser, getRoles, getUsers } from "@/modules/user/services/user.service";

export async function GET(request: NextRequest) {
  try {
    const user = await requireApiRole(["ADMIN"]);
    if (user instanceof Response) return user;
    const params = request.nextUrl.searchParams;
    const filter = userFilterSchema.parse({ search: params.get("search") || undefined, status: params.get("status") || undefined, page: Number(params.get("page") || 1), pageSize: Number(params.get("pageSize") || 20) });
    return apiSuccess({ ...(await getUsers(filter)), roles: await getRoles() });
  } catch (error) { return handleApiError(error, "Không thể tải danh sách người dùng"); }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiRole(["ADMIN"]);
    if (user instanceof Response) return user;
    return apiSuccess(await createUser(userCreateSchema.parse(await request.json())), 201);
  } catch (error) { return handleApiError(error, "Không thể tạo người dùng"); }
}
