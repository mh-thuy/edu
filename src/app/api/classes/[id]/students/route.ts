import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getErrorMessage } from "@/lib/errors";
import { assignStudentToClass, removeStudentFromClass, getClassStudents } from "@/modules/class/services/class.service";

const classStudentRequestSchema = z.object({
  studentId: z.string().min(1, "studentId is required"),
});

type Params = Promise<{
  id: string;
}>;

export async function GET(request: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const students = await getClassStudents(id);
    return NextResponse.json(students);
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const body: unknown = await request.json();
    const { studentId } = classStudentRequestSchema.parse(body);

    const result = await assignStudentToClass(id, studentId);
    return NextResponse.json(result, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const body: unknown = await request.json();
    const { studentId } = classStudentRequestSchema.parse(body);

    await removeStudentFromClass(id, studentId);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 });
  }
}
