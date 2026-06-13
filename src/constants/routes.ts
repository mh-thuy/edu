import type { Role } from "@prisma/client";

export const AUTH_ROUTES = new Set(["/login"]);

export const PUBLIC_PATH_PREFIXES = ["/_next", "/favicon.ico"];

export const PROTECTED_DEFAULT_REDIRECT = "/";

export const ROLE_ROUTE_RULES: Array<{ prefix: string; roles: Role[] }> = [
  { prefix: "/admin", roles: ["ADMIN"] },
  { prefix: "/staff", roles: ["ADMIN", "STAFF"] },
  { prefix: "/teacher", roles: ["ADMIN", "STAFF", "TEACHER"] },
];
