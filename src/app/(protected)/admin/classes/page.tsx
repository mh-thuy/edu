import { requireRole } from "@/lib/auth";
import { ClassList } from "@/modules/class/components/ClassList";
import type { ReactElement } from "react";


export default async function ClassesPage(): Promise<ReactElement> {
  const user = await requireRole(["ADMIN", "STAFF"]);

  return <ClassList role={user.role} />;
}
