import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api";
import { roomCreateSchema, roomFilterSchema } from "@/modules/room/schemas/room.schema";
import { createRoom, getRooms } from "@/modules/room/services/room.service";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const filter = roomFilterSchema.parse({
      search: searchParams.get("search") || undefined,
      status: searchParams.get("status") || undefined,
      page: parseInt(searchParams.get("page") || "1"),
      pageSize: parseInt(searchParams.get("pageSize") || "10"),
    });

    const result = await getRooms(filter);
    return apiSuccess(result);
  } catch (error: unknown) {
    return handleApiError(error, "Failed to fetch rooms");
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = roomCreateSchema.parse(body);

    const room = await createRoom(data);
    return apiSuccess(room, 201);
  } catch (error: unknown) {
    return handleApiError(error, "Failed to create room");
  }
}
