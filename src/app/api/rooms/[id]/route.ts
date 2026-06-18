import { NextRequest } from "next/server";
import { apiError, apiSuccess, handleApiError } from "@/lib/api";
import { roomUpdateSchema } from "@/modules/room/schemas/room.schema";
import { getRoomById, updateRoom, deleteRoom } from "@/modules/room/services/room.service";

type Params = Promise<{
  id: string;
}>;

export async function GET(request: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const room = await getRoomById(id);
    if (!room) {
      return apiError("NOT_FOUND", "Room not found", 404);
    }
    return apiSuccess(room);
  } catch (error: unknown) {
    return handleApiError(error, "Failed to fetch room");
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const data = roomUpdateSchema.parse(body);

    const room = await updateRoom(id, data);
    return apiSuccess(room);
  } catch (error: unknown) {
    return handleApiError(error, "Failed to update room");
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const room = await deleteRoom(id);
    return apiSuccess(room);
  } catch (error: unknown) {
    return handleApiError(error, "Failed to delete room");
  }
}
