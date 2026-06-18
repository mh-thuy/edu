import type { PrismaClient, Room } from "@prisma/client";
import { faker } from "@faker-js/faker";
import { pick, clean } from "../helpers/random";

export async function seedRooms(
  prisma: PrismaClient,
  userId: string,
): Promise<Room[]> {
  const rooms: Room[] = [];

  for (let i = 1; i <= 6; i += 1) {
    rooms.push(
      await prisma.room.create({
        data: {
          code: `R${100 + i}`,
          name: `${pick(["Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta"])} Room ${i}`,
          capacity: pick([10, 15, 20, 25, 30]),
          floor: String(pick([1, 2, 3])),
          location: clean(faker.location.city()),
          status: "AVAILABLE",
          isActive: true,
          createdBy: userId,
          updatedBy: userId,
        },
      }),
    );
  }

  return rooms;
}
