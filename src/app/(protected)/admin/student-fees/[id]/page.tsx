import { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { StudentFeeDetailPage } from "@/modules/finance/student-fees/components/StudentFeeDetailPage";

export const metadata: Metadata = {
  title: "Tuition Fee Detail | Classroom Rental",
};

type Params = Promise<{ id: string }>;

export default async function StudentFeeDetailRoute({
  params,
}: {
  params: Params;
}) {
  await requireRole(["ADMIN", "STAFF"]);
  const { id } = await params;

  return <StudentFeeDetailPage feeId={id} />;
}
