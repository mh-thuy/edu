import bcrypt from "bcrypt";
import type { PrismaClient, User } from "@prisma/client";
import { Role } from "@prisma/client";

export interface SeedUsersResult {
  admin: User;
  staff: User;
}

export async function seedUsers(prisma: PrismaClient): Promise<SeedUsersResult> {
  const passwordHash = await bcrypt.hash("password", 10);

  const admin = await prisma.user.create({
    data: {
      email: "admin@example.test",
      fullName: "Administrator",
      passwordHash,
      role: Role.ADMIN,
    },
  });

  const staff = await prisma.user.create({
    data: {
      email: "staff@example.test",
      fullName: "Staff Member",
      passwordHash,
      role: Role.STAFF,
    },
  });

  return { admin, staff };
}
