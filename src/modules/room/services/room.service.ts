/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma";
import type { Room } from "@prisma/client";
import type { RoomCreate, RoomFilter, RoomUpdate } from "@/modules/room/schemas/room.schema";

export async function createRoom(data: RoomCreate): Promise<Room> {
  return prisma.room.create({
    data,
  });
}

export async function getRoomById(id: string): Promise<Room | null> {
  return prisma.room.findUnique({
    where: { id },
  });
}

export async function getRooms(filter: RoomFilter) {
  const { search, status, page, limit } = filter;
  const skip = (page - 1) * limit;

  const where: any = {};
  if (search) {
    where.OR = [
      { code: { contains: search, mode: "insensitive" } },
      { name: { contains: search, mode: "insensitive" } },
    ];
  }
  if (status) {
    where.status = status;
  }

  const [items, total] = await Promise.all([
    prisma.room.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.room.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  };
}

export async function updateRoom(id: string, data: RoomUpdate): Promise<Room> {
  return prisma.room.update({
    where: { id },
    data,
  });
}

export async function deleteRoom(id: string): Promise<Room> {
  return prisma.room.delete({
    where: { id },
  });
}

export async function checkRoomConflict(roomId: string, dayOfWeek: number, startTime: string, endTime: string): Promise<boolean> {
  const conflict = await prisma.classSchedule.findFirst({
    where: {
      roomId,
      dayOfWeek,
      OR: [
        {
          AND: [
            { startTime: { lte: startTime } },
            { endTime: { gt: startTime } },
          ],
        },
        {
          AND: [
            { startTime: { lt: endTime } },
            { endTime: { gte: endTime } },
          ],
        },
      ],
    },
  });

  return !!conflict;
}
