import { requireRole } from "@/lib/auth";
import { SubjectManagement } from "@/modules/class/components/SubjectManagement";

export default async function SubjectsPage() {
  await requireRole(["ADMIN", "STAFF"]);
  return <SubjectManagement />;
}
