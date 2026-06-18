export const ROLES = {
  ADMIN: "ADMIN",
  STAFF: "STAFF",
  TEACHER: "TEACHER",
} as const;

export type RoleCode = (typeof ROLES)[keyof typeof ROLES];
