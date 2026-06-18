import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, handleApiError } from "@/lib/api";
import { getSessionFromCookie } from "@/lib/session";
import { assignStudentToClass, removeStudentFromClass, getClassStudents } from "@/modules/class/services/class.service";

const classStudentRequestSchema = z.object({
  studentId: z.string().min(1, "studentId is required"),
  force: z.boolean().optional(),
});

type Params = Promise<{
  id: string;
}>;

export async function GET(request: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const students = await getClassStudents(id);
    return apiSuccess(students);
  } catch (error: unknown) {
    return handleApiError(error, "Failed to fetch class students");
  }
}

export async function POST(request: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const body: unknown = await request.json();
    const { studentId } = classStudentRequestSchema.parse(body);

    const result = await assignStudentToClass(id, studentId);
    return apiSuccess(result, 201);
  } catch (error: unknown) {
    return handleApiError(error, "Failed to assign student to class");
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const body: unknown = await request.json();
    const { studentId, force } = classStudentRequestSchema.parse(body);
    const session = await getSessionFromCookie();

    await removeStudentFromClass(id, studentId, {
      force,
      isAdmin: session?.user?.role === "ADMIN",
    });
    return apiSuccess({ deleted: true });
  } catch (error: unknown) {
    return handleApiError(error, "Failed to remove student from class");
  }
}
