import { Metadata } from "next";
import { DebtTrackingList } from "@/modules/finance/debt-tracking/DebtTrackingList";

export const metadata: Metadata = {
  title: "Debt Tracking | Classroom Rental",
};

export default function DebtTrackingPage() {
  return <DebtTrackingList />;
}
