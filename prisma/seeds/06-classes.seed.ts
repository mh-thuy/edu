import type { Class, PrismaClient, Room, Teacher } from "@prisma/client";
import { faker } from "@faker-js/faker";
import { pick } from "../helpers/random";
import { money } from "../helpers/money";

export async function seedClasses(
  prisma: PrismaClient,
  input: {
    teachers: Teacher[];
    rooms: Room[];
    userId: string;
  },
): Promise<Class[]> {
  const classes: Class[] = [];
  const classNames = [
    "Math Beginner",
    "Math Advanced",
    "English Kids",
    "English Communication",
    "Piano Beginner",
    "Science Lab",
    "Programming Basic",
    "Art Creative",
  ];

  for (let i = 0; i < classNames.length; i += 1) {
    const start = faker.date.future({ years: 1 });
    const end = new Date(start.getTime() + 1000 * 60 * 60 * 24 * 30 * pick([2, 3, 4]));

    classes.push(
      await prisma.class.create({
        data: {
          code: `C${200 + i}`,
          name: classNames[i],
          teacherId: pick(input.teachers).id,
          roomId: pick(input.rooms).id,
          tuitionFee: money(pick([1500000, 2000000, 2500000, 3000000])),
          totalSessions: pick([8, 12, 16, 20]),
          maxStudents: pick([15, 20, 25, 30]),
          startDate: start,
          endDate: end,
          status: pick(["DRAFT", "ACTIVE", "COMPLETED"]),
          createdBy: input.userId,
          updatedBy: input.userId,
        },
      }),
    );
  }

  return classes;
}
