import { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { BankAccountManagement } from "@/modules/finance/bank/components/BankAccountManagement";

export const metadata: Metadata = { title: "Tài khoản nhận chuyển khoản" };

export default async function BankAccountsPage() { await requireRole(["ADMIN"]); return <BankAccountManagement />; }
