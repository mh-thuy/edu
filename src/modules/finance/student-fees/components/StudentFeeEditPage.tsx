"use client";

import React, { useEffect, useState } from "react";
import { Alert, Box, CircularProgress } from "@mui/material";
import { useRouter } from "next/navigation";
import { StudentFeeForm } from "./StudentFeeForm";
import { extractApiErrorMessage, unwrapApiResponse } from "@/lib/api-client";

interface StudentFeeEditData {
  id: string;
  studentId: string;
  classId: string;
  month: string;
  amount: number;
  discount: number;
  finalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  dueDate: string;
  status: "UNPAID" | "PARTIAL" | "PAID";
  note?: string | null;
  student?: {
    code: string;
    fullName: string;
  } | null;
  class?: {
    code: string;
    name: string;
  } | null;
}

type StudentFeeEditPageProps = {
  feeId: string;
};

export function StudentFeeEditPage({ feeId }: StudentFeeEditPageProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fee, setFee] = useState<StudentFeeEditData | null>(null);

  useEffect(() => {
    const loadFee = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/student-fees/${feeId}`);
        if (!response.ok) {
          throw new Error(
            await extractApiErrorMessage(response, "Không tải được học phí"),
          );
        }
        const data = await unwrapApiResponse<StudentFeeEditData>(response);
        setFee(data);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Không tải được học phí");
      } finally {
        setLoading(false);
      }
    };

    void loadFee();
  }, [feeId]);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !fee) {
    return <Alert severity="error">{error || "Không tìm thấy học phí"}</Alert>;
  }

  return (
    <StudentFeeForm
      initialData={fee}
      onClose={() => router.push(`/admin/student-fees/${feeId}`)}
      onSuccess={() => router.push(`/admin/student-fees/${feeId}`)}
    />
  );
}
