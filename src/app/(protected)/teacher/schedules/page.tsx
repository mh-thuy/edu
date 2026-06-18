import { requireRole } from "@/lib/auth";
import { TeacherScheduleList } from "@/modules/teacher/components/TeacherScheduleList";

export default async function TeacherSchedulesPage() {
  await requireRole(["TEACHER"]);

  return <TeacherScheduleList />;
}
