import { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { ReportingDashboard } from "@/modules/finance/reporting/ReportingDashboard";

export const metadata: Metadata = {
  title: "Financial Reports | Classroom Rental",
};

export default async function ReportsPage() {
  await requireRole(["ADMIN"]);

  return <ReportingDashboard />;
}
