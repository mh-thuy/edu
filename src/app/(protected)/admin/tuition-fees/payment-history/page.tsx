import { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { PaymentBatchHistory } from "@/modules/finance/payments/components/PaymentBatchHistory";

export const metadata: Metadata = { title: "Lịch sử thu học phí" };
export default async function PaymentBatchHistoryPage() { await requireRole(["ADMIN", "STAFF"]); return <PaymentBatchHistory />; }
