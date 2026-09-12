import type { ReactElement } from "react";
import { requireAuth } from "@/lib/auth";
import { ClassTuitionReportPage } from "@/modules/finance/reports/components/ClassTuitionReportPage";

export default async function ReportsPage(): Promise<ReactElement> {
  await requireAuth();
  return <ClassTuitionReportPage />;
}
