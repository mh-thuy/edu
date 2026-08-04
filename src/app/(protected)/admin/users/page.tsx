import { requireRole } from "@/lib/auth";
import { UserManagement } from "@/modules/user/components/UserManagement";

export default async function UsersPage() {
  await requireRole(["ADMIN"]);
  return <UserManagement />;
}
