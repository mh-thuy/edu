import bcrypt from "bcrypt";
import { UserStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { RoleCode } from "@/constants/roles";
import type { LoginInput } from "@/schemas/auth.schema";

type AuthUserResult = {
  user: {
    id: string;
    email: string;
    fullName: string;
    role: RoleCode;
  };
  rememberMe: boolean;
};

export async function authenticateUser(input: LoginInput): Promise<AuthUserResult | null> {
  const user = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
    include: {
      roles: {
        include: {
          role: true,
        },
      },
      teacher: true,
    },
  });

  if (!user || user.status !== UserStatus.ACTIVE) {
    return null;
  }

  const isValid = await bcrypt.compare(input.password, user.passwordHash);

  if (!isValid) {
    return null;
  }

  const primaryRole = user.roles[0]?.role.code as RoleCode | undefined;

  if (!primaryRole) {
    return null;
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: primaryRole,
    },
    rememberMe: input.rememberMe,
  };
}
