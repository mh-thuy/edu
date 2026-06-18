import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ConflictError, ForbiddenError } from "@/lib/errors";

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "NOT_FOUND"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "INTERNAL_ERROR"
  | "BAD_REQUEST";

export type ApiSuccessResponse<T> = {
  success: true;
  data: T;
};

export type ApiErrorResponse = {
  success: false;
  error: {
    code: ApiErrorCode;
    message: string;
    details?: unknown;
  };
};

export function apiSuccess<T>(data: T, init?: number | ResponseInit) {
  const responseInit =
    typeof init === "number" ? { status: init } : (init ?? undefined);
  return NextResponse.json<ApiSuccessResponse<T>>(
    { success: true, data },
    responseInit,
  );
}

export function apiError(
  code: ApiErrorCode,
  message: string,
  status: number,
  details?: unknown,
) {
  return NextResponse.json<ApiErrorResponse>(
    {
      success: false,
      error: {
        code,
        message,
        ...(details !== undefined && { details }),
      },
    },
    { status },
  );
}

export function handleApiError(error: unknown, fallback = "Request failed") {
  if (error instanceof ZodError) {
    return apiError(
      "VALIDATION_ERROR",
      "Validation failed",
      422,
      error.flatten(),
    );
  }

  if (error instanceof ConflictError) {
    return apiError("CONFLICT", error.message, 409);
  }

  if (error instanceof ForbiddenError) {
    return apiError("FORBIDDEN", error.message, 403);
  }

  const message = error instanceof Error ? error.message : fallback;
  return apiError("BAD_REQUEST", message, 400);
}
