import { requireRole } from "@/lib/auth";
import { ClassList } from "@/modules/class/components/ClassList";
import type { ReactElement } from "react";


export default async function ClassesPage(): Promise<ReactElement> {
  const user = await requireRole(["ADMIN", "STAFF"]);

  return (
    <div style={{ padding: "20px" }}>
      <h1>Class Management</h1>
      <ClassList role={user.role} />
    </div>
  );
}
