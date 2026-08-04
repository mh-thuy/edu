import { requireRole } from "@/lib/auth";
import { StudentList } from "@/modules/student/components/StudentList";
import type { ReactElement } from "react";

export default async function StudentsPage(): Promise<ReactElement> {
  const user = await requireRole(["ADMIN", "STAFF"]);

  return <StudentList role={user.role} />;
}
