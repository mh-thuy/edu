import type { ReactElement } from "react";
import { requireRole } from "@/lib/auth";
import { ClassTuitionReportPage } from "@/modules/finance/reports/components/ClassTuitionReportPage";

export default async function ReportsPage(): Promise<ReactElement> {
  await requireRole(["ADMIN", "STAFF"]);
  return <ClassTuitionReportPage />;
}
