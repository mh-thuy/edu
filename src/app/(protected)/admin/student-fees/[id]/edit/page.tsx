import { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { StudentFeeEditPage } from "@/modules/finance/student-fees/components/StudentFeeEditPage";

export const metadata: Metadata = {
  title: "Edit Tuition Fee | Classroom Rental",
};

type Params = Promise<{ id: string }>;

export default async function StudentFeeEditRoute({
  params,
}: {
  params: Params;
}) {
  await requireRole(["ADMIN", "STAFF"]);
  const { id } = await params;

  return <StudentFeeEditPage feeId={id} />;
}
