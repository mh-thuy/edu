import { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { PaymentList } from "@/modules/finance/payments/components/PaymentList";

export const metadata: Metadata = {
  title: "Payments | Classroom Rental",
};

export default async function PaymentsPage() {
  const user = await requireRole(["ADMIN", "STAFF"]);

  return <PaymentList role={user.role} />;
}
