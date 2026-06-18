import type { Role } from "@prisma/client";
import { getSessionFromCookie } from "@/lib/session";
import { apiError } from "@/lib/api";
import type { SessionUser } from "@/types/auth";

export async function requireApiUser(): Promise<
  SessionUser | Response
> {
  const session = await getSessionFromCookie();

  if (!session?.user) {
    return apiError("UNAUTHORIZED", "Unauthorized", 401);
  }

  return session.user;
}

export async function requireApiRole(
  roles: Role[],
): Promise<SessionUser | Response> {
  const user = await requireApiUser();

  if (user instanceof Response) {
    return user;
  }

  if (!roles.includes(user.role)) {
    return apiError("FORBIDDEN", "Insufficient permissions", 403);
  }

  return user;
}
