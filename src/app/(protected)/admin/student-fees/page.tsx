import { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { StudentFeeList } from "@/modules/finance/student-fees/components/StudentFeeList";

export const metadata: Metadata = {
  title: "Student Fees | Classroom Rental",
};

export default async function StudentFeesPage() {
  const user = await requireRole(["ADMIN", "STAFF"]);

  return <StudentFeeList role={user.role} />;
}
