import { prisma } from "@/lib/prisma";
import { ConflictError } from "@/lib/errors";
import type { Prisma, Room } from "@prisma/client";
import type {
  RoomCreate,
  RoomFilter,
  RoomUpdate,
} from "@/modules/room/schemas/room.schema";

function normalizeEmptyToNull(value?: string | null): string | null {
  return value?.trim() ? value : null;
}

function buildRoomCreateInput(data: RoomCreate): Prisma.RoomCreateInput {
  return {
    code: data.code,
    name: data.name,
    capacity: data.capacity,
    floor: data.floor,
    location: normalizeEmptyToNull(data.location),
    status: data.status,
    note: normalizeEmptyToNull(data.note),
  };
}

function buildRoomUpdateInput(data: RoomUpdate): Prisma.RoomUpdateInput {
  return {
    ...(data.code !== undefined && { code: data.code }),
    ...(data.name !== undefined && { name: data.name }),
    ...(data.capacity !== undefined && { capacity: data.capacity }),
    ...(data.floor !== undefined && { floor: data.floor }),
    ...(data.location !== undefined && {
      location: normalizeEmptyToNull(data.location),
    }),
    ...(data.status !== undefined && { status: data.status }),
    ...(data.note !== undefined && {
      note: normalizeEmptyToNull(data.note),
    }),
  };
}

export async function createRoom(data: RoomCreate): Promise<Room> {
  return prisma.room.create({
    data: buildRoomCreateInput(data),
  });
}

export async function getRoomById(id: string): Promise<Room | null> {
  return prisma.room.findUnique({
    where: { id },
  });
}

export async function getRooms(filter: RoomFilter) {
  const page = Math.max(filter.page ?? 1, 1);
  const limit = Math.max(filter.limit ?? 10, 1);
  const skip = (page - 1) * limit;

  const where: Prisma.RoomWhereInput = {
    ...(filter.search && {
      OR: [
        {
          code: {
            contains: filter.search,
            mode: "insensitive",
          },
        },
        {
          name: {
            contains: filter.search,
            mode: "insensitive",
          },
        },
      ],
    }),
    ...(filter.status && {
      status: filter.status,
    }),
  };

  const [rooms, total] = await Promise.all([
    prisma.room.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.room.count({
      where,
    }),
  ]);

  return {
    items: rooms,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  };
}

export async function updateRoom(id: string, data: RoomUpdate): Promise<Room> {
  return prisma.room.update({
    where: { id },
    data: buildRoomUpdateInput(data),
  });
}

export async function deleteRoom(id: string): Promise<Room> {
  const room = await prisma.room.findUnique({
    where: { id },
    select: {
      _count: {
        select: {
          classes: true,
          classSchedules: true,
        },
      },
    },
  });

  if (!room) {
    throw new Error("Room not found");
  }

  if (room._count.classes > 0) {
    throw new ConflictError("Cannot delete room with assigned classes");
  }

  if (room._count.classSchedules > 0) {
    throw new ConflictError("Cannot delete room with schedules");
  }

  return prisma.room.delete({
    where: { id },
  });
}

export async function checkRoomConflict(
  roomId: string,
  dayOfWeek: number,
  startTime: string,
  endTime: string,
  excludeScheduleId?: string,
): Promise<boolean> {
  const conflict = await prisma.classSchedule.findFirst({
    where: {
      roomId,
      dayOfWeek,
      ...(excludeScheduleId && {
        id: {
          not: excludeScheduleId,
        },
      }),
      startTime: {
        lt: endTime,
      },
      endTime: {
        gt: startTime,
      },
    },
    select: {
      id: true,
    },
  });

  return !!conflict;
}
