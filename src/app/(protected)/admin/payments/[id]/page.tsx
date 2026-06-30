import { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { PaymentDetailPage } from "@/modules/finance/payments/components/PaymentDetailPage";

export const metadata: Metadata = {
  title: "Payment Detail | Classroom Rental",
};

type Params = Promise<{ id: string }>;

export default async function PaymentDetailRoute({
  params,
}: {
  params: Params;
}) {
  await requireRole(["ADMIN", "STAFF"]);
  const { id } = await params;
  return <PaymentDetailPage paymentId={id} />;
}
