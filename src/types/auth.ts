import type { Role } from "@prisma/client";

export type SessionUser = {
  id: string;
  email: string;
  fullName: string;
  role: Role;
};

export type SessionPayload = {
  user: SessionUser;
  exp: number;
  iat: number;
};

export type AuthActionState = {
  success: boolean;
  message?: string;
  fieldErrors?: {
    email?: string;
    password?: string;
  };
};
