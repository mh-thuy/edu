import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess, handleApiError } from "@/lib/api";
import { getSessionFromCookie } from "@/lib/session";
import { assignStudentToClass, removeStudentFromClass, getClassStudents } from "@/modules/class/services/class.service";

const assignStudentRequestSchema = z.object({
  studentId: z.string().min(1, "studentId is required"),
  classSubjectIds: z.array(z.string().uuid()).min(1, "Hãy chọn ít nhất một môn học"),
});

const removeStudentRequestSchema = z.object({
  studentId: z.string().min(1, "studentId is required"),
  force: z.boolean().optional(),
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
    const id = await getClassId(context);
    const students = await getClassStudents(id);
    return apiSuccess(students);
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "CLASS_ID_REQUIRED") return apiError("BAD_REQUEST", "Thiếu mã lớp học", 400);
    return handleApiError(error, "Failed to fetch class students");
  }
}

export async function POST(request: NextRequest, context: { params?: Params }) {
  try {
    const id = await getClassId(context);
    const body: unknown = await request.json();
    const { studentId, classSubjectIds } = assignStudentRequestSchema.parse(body);

    const session = await getSessionFromCookie();
    const result = await assignStudentToClass(id, studentId, classSubjectIds, session?.user?.id);
    return apiSuccess(result, 201);
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "CLASS_ID_REQUIRED") return apiError("BAD_REQUEST", "Thiếu mã lớp học", 400);
    return handleApiError(error, "Failed to assign student to class");
  }
}

export async function DELETE(request: NextRequest, context: { params?: Params }) {
  try {
    const id = await getClassId(context);
    const body: unknown = await request.json();
    const { studentId, force } = removeStudentRequestSchema.parse(body);
    const session = await getSessionFromCookie();

    await removeStudentFromClass(id, studentId, {
      force,
      isAdmin: session?.user?.role === "ADMIN",
    });
    return apiSuccess({ deleted: true });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "CLASS_ID_REQUIRED") return apiError("BAD_REQUEST", "Thiếu mã lớp học", 400);
    return handleApiError(error, "Failed to remove student from class");
  }
}
