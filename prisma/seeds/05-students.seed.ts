import type { PrismaClient, Student } from "@prisma/client";
import { faker } from "@faker-js/faker";
import { clean, padNumber } from "../helpers/random";

export async function seedStudents(
  prisma: PrismaClient,
  userId: string,
): Promise<Student[]> {
  const students: Student[] = [];

  for (let i = 1; i <= 40; i += 1) {
    students.push(
      await prisma.student.create({
        data: {
          code: `S${padNumber(1000 + i, 4)}`,
          fullName: clean(faker.person.fullName())!,
          email: clean(faker.internet.email().toLowerCase()),
          phone: clean(faker.phone.number()),
          birthday: faker.date.birthdate({ min: 6, max: 18, mode: "age" }),
          parentName: clean(faker.person.fullName()),
          address: clean(faker.location.streetAddress()),
          status: "ACTIVE",
          createdBy: userId,
          updatedBy: userId,
        },
      }),
    );
  }

  return students;
}
