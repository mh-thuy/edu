import { Metadata } from "next";
import { ReceiptList } from "@/modules/finance/receipts/ReceiptList";

export const metadata: Metadata = {
  title: "Receipts | Classroom Rental",
};

export default function ReceiptsPage() {
  return <ReceiptList />;
}
