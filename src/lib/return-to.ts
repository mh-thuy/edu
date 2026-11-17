// Chỉ cho phép quay về đường dẫn nội bộ thuộc các tiền tố đã khai báo.
export function resolveReturnTo(
  raw: string | null | undefined,
  allowedPrefixes: readonly string[],
  fallback: string,
): string {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("..")) return fallback;
  const allowed = allowedPrefixes.some((prefix) => {
    if (!raw.startsWith(prefix)) return false;
    const next = raw.charAt(prefix.length);
    return next === "" || next === "/" || next === "?";
  });
  return allowed ? raw : fallback;
}

export function withReturnTo(path: string, returnTo: string): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}returnTo=${encodeURIComponent(returnTo)}`;
}
