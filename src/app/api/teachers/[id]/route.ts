import { NextRequest, NextResponse } from "next/server";
import { ConflictError, getErrorMessage } from "@/lib/errors";
import { teacherUpdateSchema } from "@/modules/teacher/schemas/teacher.schema";
import { getTeacherById, updateTeacher, deleteTeacher } from "@/modules/teacher/services/teacher.service";

type Params = Promise<{
  id: string;
}>;

export async function GET(request: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const teacher = await getTeacherById(id);
    if (!teacher) {
      return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
    }
    return NextResponse.json(teacher);
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const data = teacherUpdateSchema.parse(body);

    const teacher = await updateTeacher(id, data);
    return NextResponse.json(teacher);
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const teacher = await deleteTeacher(id);
    return NextResponse.json(teacher);
  } catch (error: unknown) {
    if (error instanceof ConflictError) {
      return NextResponse.json({ error: getErrorMessage(error) }, { status: 409 });
    }
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 });
  }
}
