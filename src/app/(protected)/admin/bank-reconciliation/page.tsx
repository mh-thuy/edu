import { Metadata } from "next";
import { requireAuth } from "@/lib/auth";
import { BankReconciliationPanel } from "@/modules/finance/bank/components/BankReconciliationPanel";

export const metadata: Metadata = { title: "Đối soát ngân hàng" };

export default async function BankReconciliationPage() { await requireAuth(); return <BankReconciliationPanel />; }
