import { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { TuitionPaymentWorkspace } from "@/modules/finance/payments/components/TuitionPaymentWorkspace";

export const metadata: Metadata = { title: "Thu học phí" };

export default async function TuitionPaymentPage() {
  await requireRole(["ADMIN", "STAFF"]);
  return <TuitionPaymentWorkspace />;
}
