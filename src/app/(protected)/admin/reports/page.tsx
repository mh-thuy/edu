import { Metadata } from "next";
import { ReportingDashboard } from "@/modules/finance/reporting/ReportingDashboard";

export const metadata: Metadata = {
  title: "Financial Reports | Classroom Rental",
};

export default function ReportsPage() {
  return <ReportingDashboard />;
}
