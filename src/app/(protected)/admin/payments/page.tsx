import { Metadata } from "next";
import { PaymentList } from "@/modules/finance/payments/components/PaymentList";

export const metadata: Metadata = {
  title: "Payments | Classroom Rental",
};

export default function PaymentsPage() {
  return <PaymentList />;
}
