import { requireAuth } from "@/lib/auth";
import { ScheduleList } from "@/modules/schedule/components/ScheduleList";
import type { ReactElement } from "react";


export default async function SchedulesPage(): Promise<ReactElement> {
  await requireAuth();

  return (
    <div style={{ padding: "20px" }}>
      <h1>Schedule Management</h1>
      <ScheduleList />
    </div>
  );
}
