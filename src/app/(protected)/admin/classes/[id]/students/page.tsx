import { requireRole } from "@/lib/auth";
import { ClassStudentManagement } from "@/modules/class/components/ClassStudentManagement";

export default async function ClassStudentsPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["ADMIN", "STAFF"]);
  return <ClassStudentManagement id={(await params).id} />;
}
