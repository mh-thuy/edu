import { NextRequest, NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/errors";
import { classUpdateSchema } from "@/modules/class/schemas/class.schema";
import { getClassById, updateClass, deleteClass } from "@/modules/class/services/class.service";

type Params = Promise<{
  id: string;
}>;

export async function GET(request: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const classData = await getClassById(id);
    if (!classData) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }
    return NextResponse.json(classData);
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const data = classUpdateSchema.parse(body);

    const classData = await updateClass(id, data);
    return NextResponse.json(classData);
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const classData = await deleteClass(id);
    return NextResponse.json(classData);
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 });
  }
}
