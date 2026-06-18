import bcrypt from "bcrypt";
import type { PrismaClient, Teacher } from "@prisma/client";
import { faker } from "@faker-js/faker";
import { Role } from "@prisma/client";
import { clean, pick } from "../helpers/random";

export async function seedTeachers(
  prisma: PrismaClient,
  userId: string,
): Promise<Teacher[]> {
  const passwordHash = await bcrypt.hash("password", 10);
  const teachers: Teacher[] = [];

  for (let i = 1; i <= 6; i += 1) {
    const email = clean(faker.internet.email().toLowerCase())!;
    const fullName = clean(faker.person.fullName())!;

    const user = await prisma.user.create({
      data: {
        email,
        fullName,
        passwordHash,
        role: Role.TEACHER,
      },
    });

    teachers.push(
      await prisma.teacher.create({
        data: {
          userId: user.id,
          code: `T${100 + i}`,
          fullName,
          email,
          phone: clean(faker.phone.number()),
          specialty: pick(["Math", "English", "Music", "Science", "Art", "Programming"]),
          status: "ACTIVE",
          createdBy: userId,
          updatedBy: userId,
        },
      }),
    );
  }

  return teachers;
}
