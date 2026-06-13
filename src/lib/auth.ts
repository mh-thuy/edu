import type { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import type { SessionUser } from "@/types/auth";
import { getSessionFromCookie } from "@/lib/session";

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await getSessionFromCookie();

  return session?.user ?? null;
}

export async function requireAuth(): Promise<SessionUser> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function requireRole(roles: Role[]): Promise<SessionUser> {
  const user = await requireAuth();

  if (!roles.includes(user.role)) {
    redirect("/forbidden");
  }

  return user;
}
