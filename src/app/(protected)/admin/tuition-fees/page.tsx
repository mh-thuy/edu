import { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { TuitionList } from "@/modules/finance/tuition/components/TuitionList";

export const metadata: Metadata = { title: "Danh sách học phí" };

export default async function TuitionFeesPage() { await requireRole(["ADMIN", "STAFF"]); return <TuitionList />; }
