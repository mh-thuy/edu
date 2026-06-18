import { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { DebtTrackingList } from "@/modules/finance/debt-tracking/DebtTrackingList";

export const metadata: Metadata = {
  title: "Debt Tracking | Classroom Rental",
};

export default async function DebtTrackingPage() {
  await requireRole(["ADMIN"]);

  return <DebtTrackingList />;
}
