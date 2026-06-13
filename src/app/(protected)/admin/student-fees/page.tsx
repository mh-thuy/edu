import { Metadata } from "next";
import { StudentFeeList } from "@/modules/finance/student-fees/components/StudentFeeList";

export const metadata: Metadata = {
  title: "Student Fees | Classroom Rental",
};

export default function StudentFeesPage() {
  return <StudentFeeList />;
}
