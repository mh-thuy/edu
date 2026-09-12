import { getSessionFromCookie } from "@/lib/session";
import { apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { UserStatus } from "@prisma/client";
import type { SessionUser } from "@/types/auth";

export async function requireApiUser(): Promise<
  SessionUser | Response
> {
  const session = await getSessionFromCookie();

  if (!session?.user) {
    return apiError("UNAUTHORIZED", "Unauthorized", 401);
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { status: true, deletedAt: true },
  });
  if (!user || user.status !== UserStatus.ACTIVE || user.deletedAt) {
    return apiError("UNAUTHORIZED", "Tài khoản không còn hoạt động", 401);
  }

  return session.user;
}
