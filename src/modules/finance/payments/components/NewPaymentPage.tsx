"use client";

import React, { useEffect, useState } from "react";
import { Alert, Box, CircularProgress } from "@mui/material";
import { useRouter } from "next/navigation";
import { PaymentForm } from "./PaymentForm";
import { extractApiErrorMessage, unwrapApiResponse } from "@/lib/api-client";

interface FeeForPayment {
  id: string;
  month: string;
  finalAmount: number;
  discount: number;
  outstandingAmount: number;
  displayStatus?: "UNPAID" | "PARTIAL" | "PAID" | "OVERDUE";
  status: "UNPAID" | "PARTIAL" | "PAID";
  student?: {
    code: string;
    fullName: string;
  } | null;
  class?: {
    code: string;
    name: string;
  } | null;
}

type NewPaymentPageProps = {
  studentFeeId: string;
};

export function NewPaymentPage({ studentFeeId }: NewPaymentPageProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fee, setFee] = useState<FeeForPayment | null>(null);

  useEffect(() => {
    const loadFee = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/student-fees/${studentFeeId}`);
        if (!response.ok) {
          throw new Error(
            await extractApiErrorMessage(response, "Không tải được dữ liệu học phí"),
          );
        }
        const data = await unwrapApiResponse<FeeForPayment>(response);
        setFee(data);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Không tải được dữ liệu học phí",
        );
      } finally {
        setLoading(false);
      }
    };

    void loadFee();
  }, [studentFeeId]);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !fee) {
    return <Alert severity="error">{error || "Không tìm thấy khoản học phí"}</Alert>;
  }

  return (
    <PaymentForm
      presetStudentFee={{
        id: fee.id,
        month: fee.month,
        amount: fee.finalAmount,
        discount: fee.discount,
        outstanding: fee.outstandingAmount,
        status:
          fee.displayStatus === "OVERDUE"
            ? "unpaid"
            : fee.displayStatus === "PARTIAL" || fee.status === "PARTIAL"
              ? "partial"
              : fee.displayStatus === "PAID" || fee.status === "PAID"
                ? "paid"
                : "unpaid",
        student: fee.student,
        class: fee.class,
      }}
      onClose={() => router.push(`/admin/student-fees/${studentFeeId}`)}
      onSuccess={() => router.push(`/admin/student-fees/${studentFeeId}`)}
    />
  );
}
