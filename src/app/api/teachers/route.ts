import { NextRequest, NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/errors";
import {
  teacherCreateSchema,
  teacherFilterSchema,
} from "@/modules/teacher/schemas/teacher.schema";
import {
  createTeacher,
  getTeachers,
} from "@/modules/teacher/services/teacher.service";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const filter = teacherFilterSchema.parse({
      search: searchParams.get("search") || undefined,
      status: searchParams.get("status") || undefined,
      page: parseInt(searchParams.get("page") || "1"),
      limit: parseInt(searchParams.get("limit") || "10"),
    });

    const result = await getTeachers(filter);
    return NextResponse.json({
      items: result.teachers,
      total: result.total,
      page: result.page,
      limit: result.limit,
      pages: result.pages,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = teacherCreateSchema.parse(body);

    const teacher = await createTeacher(data);
    return NextResponse.json(teacher, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 });
  }
}
