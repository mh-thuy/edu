import { Metadata } from "next";
import { requireAuth } from "@/lib/auth";
import { TuitionPaymentWorkspace } from "@/modules/finance/payments/components/TuitionPaymentWorkspace";

export const metadata: Metadata = { title: "Thu học phí" };

export default async function TuitionPaymentPage({ searchParams }: { searchParams: Promise<{ tuitionFeeId?: string; tuitionFeeIds?: string }> }) {
  await requireAuth();
  const params = await searchParams;
  const ids = params.tuitionFeeIds?.split(",").filter(Boolean) ?? (params.tuitionFeeId ? [params.tuitionFeeId] : []);
  return <TuitionPaymentWorkspace initialTuitionFeeIds={ids} />;
}
