export type BillingPeriod = {
  billingYear: number;
  billingMonth: number;
  month: string;
};

// Tháng tính theo giờ Việt Nam, không theo múi giờ của trình duyệt hay máy chủ.
export function getNextBillingPeriod(now: Date): BillingPeriod {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const currentMonth = Number(parts.find((part) => part.type === "month")?.value);
  const billingYear = currentMonth === 12 ? year + 1 : year;
  const billingMonth = currentMonth === 12 ? 1 : currentMonth + 1;
  return {
    billingYear,
    billingMonth,
    month: `${billingYear}-${String(billingMonth).padStart(2, "0")}`,
  };
}

// Cùng logic với createClassTuitionFees phía server: lớp không giới hạn khi ngày null.
export function isClassCoveringPeriod(
  cls: { startDate?: string | null; endDate?: string | null },
  period: BillingPeriod,
): boolean {
  const periodStart = Date.UTC(period.billingYear, period.billingMonth - 1, 1);
  const periodEnd = Date.UTC(period.billingYear, period.billingMonth, 0);
  if (cls.startDate && new Date(cls.startDate).getTime() > periodEnd) return false;
  if (cls.endDate && new Date(cls.endDate).getTime() < periodStart) return false;
  return true;
}
