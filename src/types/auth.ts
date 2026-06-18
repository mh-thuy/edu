import type { RoleCode } from "@/constants/roles";

export type SessionUser = {
  id: string;
  email: string;
  fullName: string;
  role: RoleCode;
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
