import type { RoleCode } from "@/constants/roles";

export const AUTH_ROUTES = new Set(["/login"]);

export const PUBLIC_PATH_PREFIXES = ["/_next", "/favicon.ico"];

export const PROTECTED_DEFAULT_REDIRECT = "/";

export const ROLE_ROUTE_RULES: Array<{ prefix: string; roles: RoleCode[] }> = [
  { prefix: "/admin", roles: ["ADMIN", "STAFF"] },
  { prefix: "/staff", roles: ["ADMIN", "STAFF"] },
  { prefix: "/teacher", roles: ["TEACHER"] },
];

export const API_ROLE_RULES: Array<{ prefix: string; roles: RoleCode[] }> = [
  { prefix: "/api/reports", roles: ["ADMIN", "STAFF", "TEACHER"] },
  { prefix: "/api/dashboard", roles: ["ADMIN", "STAFF", "TEACHER"] },
  { prefix: "/api/classes", roles: ["ADMIN", "STAFF"] },
  { prefix: "/api/payments", roles: ["ADMIN", "STAFF"] },
  { prefix: "/api/receipts", roles: ["ADMIN", "STAFF"] },
  { prefix: "/api/rooms", roles: ["ADMIN"] },
  { prefix: "/api/schedules", roles: ["ADMIN"] },
  { prefix: "/api/student-fees", roles: ["ADMIN", "STAFF"] },
  { prefix: "/api/students", roles: ["ADMIN", "STAFF"] },
  { prefix: "/api/teacher-payroll", roles: ["ADMIN"] },
  { prefix: "/api/teacher", roles: ["TEACHER"] },
  { prefix: "/api/teachers", roles: ["ADMIN", "STAFF"] },
];
