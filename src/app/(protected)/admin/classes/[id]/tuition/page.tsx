import { requireAuth } from "@/lib/auth";
import { ClassTuitionManagement } from "@/modules/finance/tuition/components/ClassTuitionManagement";

export default async function ClassTuitionPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAuth();
  return <ClassTuitionManagement id={(await params).id} />;
}
