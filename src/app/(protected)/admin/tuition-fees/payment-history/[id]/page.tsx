import { Metadata } from "next";
import { requireAuth } from "@/lib/auth";
import { resolveReturnTo } from "@/lib/return-to";
import { PaymentBatchDetail } from "@/modules/finance/payments/components/PaymentBatchDetail";

export const metadata: Metadata = { title: "Chi tiết đợt thanh toán" };

export default async function PaymentBatchDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  await requireAuth();
  const backHref = resolveReturnTo(
    (await searchParams).returnTo,
    ["/admin/tuition-fees"],
    "/admin/tuition-fees/payment-history",
  );
  return <PaymentBatchDetail id={(await params).id} backHref={backHref} />;
}
