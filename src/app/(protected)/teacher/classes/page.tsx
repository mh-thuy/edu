import { requireRole } from "@/lib/auth";
import { TeacherClassList } from "@/modules/teacher/components/TeacherClassList";

export default async function TeacherClassesPage() {
  await requireRole(["TEACHER"]);

  return <TeacherClassList />;
}
