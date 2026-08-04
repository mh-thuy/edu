import { requireRole } from "@/lib/auth";
import { TeacherList } from "@/modules/teacher/components/TeacherList";
import type { ReactElement } from "react";

export default async function TeachersPage(): Promise<ReactElement> {
  const user = await requireRole(["ADMIN", "STAFF"]);

  return <TeacherList role={user.role} />;
}
