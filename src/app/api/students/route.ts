import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api";
import { studentCreateSchema, studentFilterSchema } from "@/modules/student/schemas/student.schema";
import { createStudent, getStudents } from "@/modules/student/services/student.service";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const filter = studentFilterSchema.parse({
      search: searchParams.get("search") || undefined,
      status: searchParams.get("status") || undefined,
      page: parseInt(searchParams.get("page") || "1"),
      pageSize: parseInt(searchParams.get("pageSize") || "10"),
    });

    const result = await getStudents(filter);
    return apiSuccess(result);
  } catch (error: unknown) {
    return handleApiError(error, "Failed to fetch students");
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = studentCreateSchema.parse(body);

    const student = await createStudent(data);
    return apiSuccess(student, 201);
  } catch (error: unknown) {
    return handleApiError(error, "Failed to create student");
  }
}
