import bcrypt from "bcrypt";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { LoginInput } from "@/schemas/auth.schema";

type AuthUserResult = {
  user: Pick<User, "id" | "email" | "fullName" | "role" | "isActive">;
  rememberMe: boolean;
};

export async function authenticateUser(input: LoginInput): Promise<AuthUserResult | null> {
  const user = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
  });

  if (!user || !user.isActive) {
    return null;
  }

  const isValid = await bcrypt.compare(input.password, user.passwordHash);

  if (!isValid) {
    return null;
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      isActive: user.isActive,
    },
    rememberMe: input.rememberMe,
  };
}
