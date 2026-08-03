import { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { BankReconciliationPanel } from "@/modules/finance/bank/components/BankReconciliationPanel";

export const metadata: Metadata = { title: "Đối soát ngân hàng" };

export default async function BankReconciliationPage() { await requireRole(["ADMIN", "STAFF"]); return <BankReconciliationPanel />; }
