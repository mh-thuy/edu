import { requireRole } from "@/lib/auth";
import { StudentList } from "@/modules/student/components/StudentList";
import type { ReactElement } from "react";


export default async function StudentsPage(): Promise<ReactElement> {
  const user = await requireRole(["ADMIN", "STAFF"]);

  return (
    <div style={{ padding: "20px" }}>
      <h1>Student Management</h1>
      <StudentList role={user.role} />
    </div>
  );
}
