import { requireRole } from "@/lib/auth";
import { ClassTuitionManagement } from "@/modules/finance/tuition/components/ClassTuitionManagement";

export default async function ClassTuitionPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["ADMIN", "STAFF"]);
  return <ClassTuitionManagement id={(await params).id} />;
}
