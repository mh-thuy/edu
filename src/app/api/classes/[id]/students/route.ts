import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess, handleApiError } from "@/lib/api";
import { requireApiUser } from "@/lib/api-auth";
import { assignStudentToClass, removeStudentFromClass, getClassStudents, getClassStudentsPage } from "@/modules/class/services/class.service";

const assignStudentRequestSchema = z.object({
  studentId: z.string().min(1, "studentId is required"),
  classSubjectIds: z.array(z.string().uuid()).min(1, "Hãy chọn ít nhất một môn học"),
});

const removeStudentRequestSchema = z.object({
  studentId: z.string().min(1, "studentId is required"),
  force: z.boolean().optional(),
  reason: z.string().trim().max(500).optional(),
}).superRefine((data, ctx) => {
  if (data.force && !data.reason) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["reason"],
      message: "Bắt buộc nhập lý do khi force rời lớp",
    });
  }
});

type Params = Promise<{
  id: string;
}>;

async function getClassId(context: { params?: Params }) {
  const routeParams = await context.params;
  if (!routeParams?.id) throw new Error("CLASS_ID_REQUIRED");
  return routeParams.id;
}

export async function GET(_request: NextRequest, context: { params?: Params }) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) return user;
    const id = await getClassId(context);
    const searchParams = _request.nextUrl.searchParams;
    const hasPagination = ["page", "pageSize", "search", "status", "subjectId", "month"].some((key) => searchParams.has(key));
    if (!hasPagination) return apiSuccess(await getClassStudents(id));
    const filters = z.object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(20),
      search: z.string().optional(),
      status: z.enum(["ACTIVE", "PAUSED", "COMPLETED"]).optional(),
      subjectId: z.string().uuid().optional(),
      month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    }).parse({
      page: searchParams.get("page") || undefined,
      pageSize: searchParams.get("pageSize") || undefined,
      search: searchParams.get("search") || undefined,
      status: searchParams.get("status") || undefined,
      subjectId: searchParams.get("subjectId") || undefined,
      month: searchParams.get("month"),
    });
    return apiSuccess(await getClassStudentsPage(id, filters));
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "CLASS_ID_REQUIRED") return apiError("BAD_REQUEST", "Thiếu mã lớp học", 400);
    return handleApiError(error, "Failed to fetch class students");
  }
}

export async function POST(request: NextRequest, context: { params?: Params }) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) return user;
    const id = await getClassId(context);
    const body: unknown = await request.json();
    const { studentId, classSubjectIds } = assignStudentRequestSchema.parse(body);

    const result = await assignStudentToClass(id, studentId, classSubjectIds, user.id);
    return apiSuccess(result, 201);
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "CLASS_ID_REQUIRED") return apiError("BAD_REQUEST", "Thiếu mã lớp học", 400);
    return handleApiError(error, "Failed to assign student to class");
  }
}

export async function DELETE(request: NextRequest, context: { params?: Params }) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) return user;
    const id = await getClassId(context);
    const body: unknown = await request.json();
    const { studentId, force, reason } = removeStudentRequestSchema.parse(body);

    await removeStudentFromClass(id, studentId, {
      force,
      reason,
    }, user.id);
    return apiSuccess({ deleted: true });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "CLASS_ID_REQUIRED") return apiError("BAD_REQUEST", "Thiếu mã lớp học", 400);
    return handleApiError(error, "Failed to remove student from class");
  }
}
