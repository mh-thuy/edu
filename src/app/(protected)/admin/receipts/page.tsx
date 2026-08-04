import { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { ReceiptList } from "@/modules/finance/receipts/ReceiptList";

export const metadata: Metadata = {
  title: "Biên lai học phí",
};

export default async function ReceiptsPage() {
  const user = await requireRole(["ADMIN", "STAFF"]);

  return <ReceiptList role={user.role} />;
}
