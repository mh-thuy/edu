import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";

export default async function StaffPage() {
  await requireRole(["ADMIN", "STAFF"]);
  redirect("/admin/students");
}
