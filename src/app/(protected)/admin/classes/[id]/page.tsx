import { requireRole } from "@/lib/auth";
import { ClassDetailPanel } from "@/modules/class/components/ClassDetailPanel";

export default async function ClassDetailPage({ params }: { params: Promise<{ id: string }> }) { await requireRole(["ADMIN", "STAFF"]); return <ClassDetailPanel id={(await params).id} />; }
