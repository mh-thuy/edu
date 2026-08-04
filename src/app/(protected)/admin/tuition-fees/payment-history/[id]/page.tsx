import { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { PaymentBatchDetail } from "@/modules/finance/payments/components/PaymentBatchDetail";

export const metadata: Metadata = { title: "Chi tiết đợt thanh toán" };

export default async function PaymentBatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["ADMIN", "STAFF"]);
  return <PaymentBatchDetail id={(await params).id} />;
}
