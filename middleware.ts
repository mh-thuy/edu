import { jwtVerify } from "jose";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { AUTH_COOKIE_NAME } from "@/constants/auth";
import {
  API_ROLE_RULES,
  AUTH_ROUTES,
  PROTECTED_DEFAULT_REDIRECT,
  PUBLIC_PATH_PREFIXES,
  ROLE_ROUTE_RULES,
} from "@/constants/routes";
import type { SessionUser } from "@/types/auth";

function getSecret(): Uint8Array | null {
  const secret = process.env.SESSION_SECRET;

  if (!secret || secret.length < 32) {
    return null;
  }

  return new TextEncoder().encode(secret);
}

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return true;
  }

  return /\.[^/]+$/.test(pathname);
}

function isApiPath(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

function unauthorizedApiResponse(status: 401 | 403, message: string): NextResponse {
  return apiError(
    status === 401 ? "UNAUTHORIZED" : "FORBIDDEN",
    message,
    status,
  );
}

async function getUserFromRequest(request: NextRequest): Promise<SessionUser | null> {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const secret = getSecret();

  if (!secret) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, secret);

    if (!payload.user || typeof payload.user !== "object") {
      return null;
    }

    const user = payload.user as Partial<SessionUser>;

    if (!user.id || !user.email || !user.role || !user.fullName) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
    };
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const apiPath = isApiPath(pathname);

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const user = await getUserFromRequest(request);
  const isAuthRoute = AUTH_ROUTES.has(pathname);

  if (!user && !isAuthRoute) {
    if (apiPath) {
      return unauthorizedApiResponse(401, "Authentication required");
    }

    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL(PROTECTED_DEFAULT_REDIRECT, request.url));
  }

  if (!user) {
    return NextResponse.next();
  }

  if (apiPath) {
    for (const rule of API_ROLE_RULES) {
      if (pathname.startsWith(rule.prefix) && !rule.roles.includes(user.role)) {
        return unauthorizedApiResponse(403, "Insufficient permissions");
      }
    }

    return NextResponse.next();
  }

  for (const rule of ROLE_ROUTE_RULES) {
    if (pathname.startsWith(rule.prefix) && !rule.roles.includes(user.role)) {
      return NextResponse.redirect(new URL("/forbidden", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
