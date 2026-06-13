import { requireAuth } from "@/lib/auth";
import { TeacherList } from "@/modules/teacher/components/TeacherList";
import type { ReactElement } from "react";

export const dynamic = "force-dynamic";

export default async function TeachersPage(): Promise<ReactElement> {
  await requireAuth();

  return (
    <div style={{ padding: "20px" }}>
      <h1>Teacher Management</h1>
      <TeacherList />
    </div>
  );
}
