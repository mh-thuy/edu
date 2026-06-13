import bcrypt from "bcrypt";
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash("123456", 10);

  const users = [
    {
      email: "admin@example.com",
      fullName: "System Admin",
      role: Role.ADMIN,
    },
    {
      email: "staff@example.com",
      fullName: "Center Staff",
      role: Role.STAFF,
    },
    {
      email: "teacher@example.com",
      fullName: "Lead Teacher",
      role: Role.TEACHER,
    },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        fullName: user.fullName,
        role: user.role,
        passwordHash,
        isActive: true,
      },
      create: {
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        passwordHash,
      },
    });
  }

  await prisma.room.upsert({
    where: { code: "R101" },
    update: {
      name: "Room 101",
      capacity: 40,
      location: "Building A",
    },
    create: {
      code: "R101",
      name: "Room 101",
      capacity: 40,
      location: "Building A",
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error("Seed failed", error);
    await prisma.$disconnect();
    process.exit(1);
  });
