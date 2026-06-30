import { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { NewPaymentPage } from "@/modules/finance/payments/components/NewPaymentPage";

export const metadata: Metadata = {
  title: "Create Payment | Classroom Rental",
};

type SearchParams = Promise<{ studentFeeId?: string }>;

export default async function NewPaymentRoute({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole(["ADMIN", "STAFF"]);
  const { studentFeeId } = await searchParams;

  if (!studentFeeId) {
    redirect("/admin/student-fees");
  }

  return <NewPaymentPage studentFeeId={studentFeeId} />;
}
