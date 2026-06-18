export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export function getErrorMessage(
  error: unknown,
  fallback = "An unexpected error occurred",
): string {
  return error instanceof Error ? error.message : fallback;
}
