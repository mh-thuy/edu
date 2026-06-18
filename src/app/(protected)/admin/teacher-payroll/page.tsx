import { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { PayrollList } from "@/modules/finance/teacher-payroll/components/PayrollList";

export const metadata: Metadata = {
  title: "Teacher Payroll | Classroom Rental",
};

export default async function TeacherPayrollPage() {
  await requireRole(["ADMIN"]);

  return <PayrollList />;
}
