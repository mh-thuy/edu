import type { Class, PrismaClient, Room, Teacher } from "@prisma/client";
import { pick } from "../helpers/random";

export async function seedSchedules(
  prisma: PrismaClient,
  input: {
    classes: Class[];
    teachers: Teacher[];
    rooms: Room[];
    userId: string;
  },
): Promise<void> {
  const timePairs = [
    ["08:00", "09:30"],
    ["09:45", "11:15"],
    ["13:00", "14:30"],
    ["15:00", "16:30"],
    ["18:00", "20:00"],
  ] as const;

  for (const cls of input.classes) {
    const scheduleCount = pick([1, 2]);

    for (let i = 0; i < scheduleCount; i += 1) {
      const [startTime, endTime] = pick(timePairs);

      await prisma.classSchedule.create({
        data: {
          classId: cls.id,
          roomId: cls.roomId ?? pick(input.rooms).id,
          teacherId: cls.teacherId ?? pick(input.teachers).id,
          dayOfWeek: pick([1, 2, 3, 4, 5, 6]),
          startTime,
          endTime,
          createdBy: input.userId,
          updatedBy: input.userId,
        },
      });
    }
  }
}
