export function pick<T>(items: readonly T[]): T {
  const item = items[Math.floor(Math.random() * items.length)];
  if (item === undefined) {
    throw new Error("Cannot pick from empty array.");
  }
  return item;
}

export function takeRandom<T>(items: readonly T[], count: number): T[] {
  return [...items].sort(() => Math.random() - 0.5).slice(0, count);
}

export function padNumber(value: number, length = 3): string {
  return String(value).padStart(length, "0");
}

export function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function nextMonthDueDate(day = 5): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, day);
}

export function clean(value: string | null | undefined): string | null {
  if (value == null) return null;
  return value.replace(/[\x00-\x1F\x7F]/g, "").trim();
}
