import type { Role } from "@prisma/client";

export const ROLES: Record<Role, Role> = {
  ADMIN: "ADMIN",
  STAFF: "STAFF",
  TEACHER: "TEACHER",
};
