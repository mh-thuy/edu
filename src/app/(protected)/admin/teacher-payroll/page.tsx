import { Metadata } from "next";
import { PayrollList } from "@/modules/finance/teacher-payroll/components/PayrollList";

export const metadata: Metadata = {
  title: "Teacher Payroll | Classroom Rental",
};

export default function TeacherPayrollPage() {
  return <PayrollList />;
}
