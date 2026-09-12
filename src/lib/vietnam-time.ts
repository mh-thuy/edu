const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function isSameUtcDate(
  value: Date,
  year: number,
  month: number,
  day: number,
) {
  return (
    value.getUTCFullYear() === year &&
    value.getUTCMonth() === month - 1 &&
    value.getUTCDate() === day
  );
}

/** Convert a YYYY-MM-DD calendar date in Vietnam to its UTC instant. */
export function parseVietnamDateStart(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  if (!isSameUtcDate(calendarDate, year, month, day)) return null;

  return new Date(calendarDate.getTime() - VIETNAM_OFFSET_MS);
}

/** Start of the current Vietnam calendar day as a UTC instant. */
export function getVietnamDayStart(asOf = new Date()): Date {
  const vietnamNow = new Date(asOf.getTime() + VIETNAM_OFFSET_MS);
  const calendarDate = new Date(
    Date.UTC(
      vietnamNow.getUTCFullYear(),
      vietnamNow.getUTCMonth(),
      vietnamNow.getUTCDate(),
    ),
  );
  return new Date(calendarDate.getTime() - VIETNAM_OFFSET_MS);
}

export function getVietnamDayEndExclusive(value: string): Date | null {
  const start = parseVietnamDateStart(value);
  return start ? new Date(start.getTime() + DAY_MS) : null;
}

export function getVietnamMonthRange(
  value: string,
): { start: Date; end: Date } | null {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const start = parseVietnamDateStart(`${value}-01`);
  if (!start) return null;

  const nextMonthCalendar = new Date(Date.UTC(year, month, 1));
  return {
    start,
    end: new Date(nextMonthCalendar.getTime() - VIETNAM_OFFSET_MS),
  };
}
