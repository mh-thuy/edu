import type { Role } from "@prisma/client";

export const AUTH_ROUTES = new Set(["/login"]);

export const PUBLIC_PATH_PREFIXES = ["/_next", "/favicon.ico"];

export const PROTECTED_DEFAULT_REDIRECT = "/";

export const ROLE_ROUTE_RULES: Array<{ prefix: string; roles: Role[] }> = [
  { prefix: "/admin", roles: ["ADMIN"] },
  { prefix: "/staff", roles: ["ADMIN", "STAFF"] },
  { prefix: "/teacher", roles: ["ADMIN", "STAFF", "TEACHER"] },
];

export const API_ROLE_RULES: Array<{ prefix: string; roles: Role[] }> = [
  { prefix: "/api/classes", roles: ["ADMIN"] },
  { prefix: "/api/payments", roles: ["ADMIN"] },
  { prefix: "/api/rooms", roles: ["ADMIN"] },
  { prefix: "/api/schedules", roles: ["ADMIN"] },
  { prefix: "/api/student-fees", roles: ["ADMIN"] },
  { prefix: "/api/students", roles: ["ADMIN"] },
  { prefix: "/api/teacher-payroll", roles: ["ADMIN"] },
  { prefix: "/api/teachers", roles: ["ADMIN"] },
];
