import { TuitionFeeStatus } from "@prisma/client";
import { getVietnamDayStart } from "@/lib/vietnam-time";

export function getEffectiveTuitionFeeStatus(
  status: TuitionFeeStatus,
  dueDate: Date | null,
  asOf = new Date(),
) {
  if (
    status === TuitionFeeStatus.UNPAID &&
    dueDate !== null &&
    dueDate < getVietnamDayStart(asOf)
  ) {
    return TuitionFeeStatus.OVERDUE;
  }
  return status;
}
