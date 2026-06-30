"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import CancelIcon from "@mui/icons-material/Cancel";
import { ConfirmDialog } from "@/components/shared/dialogs/ConfirmDialog";
import { useSnackbar } from "@/hooks/useSnackbar";
import { extractApiErrorMessage, unwrapApiResponse } from "@/lib/api-client";
import { PaymentForm } from "./PaymentForm";

interface PaymentDetail {
  id: string;
  studentFeeId: string;
  amount: number;
  method: "cash" | "transfer" | "wallet";
  paymentDate: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "FAILED" | "REFUNDED";
  notes?: string | null;
  bankTransactionId?: string | null;
  studentFee?: {
    id: string;
    month: string;
    amount: number;
    discount?: number;
    student?: {
      code: string;
      fullName: string;
    } | null;
    class?: {
      code: string;
      name: string;
    } | null;
    payments?: Array<{
      id: string;
      amount: number;
    }>;
  } | null;
  receipts?: Array<{
    id: string;
    receiptNumber: string;
  }>;
}

type PaymentDetailPageProps = {
  paymentId: string;
};

const formatCurrency = (value: number) =>
  `${new Intl.NumberFormat("vi-VN").format(value)} ₫`;

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("vi-VN");

const getMethodLabel = (method: "cash" | "transfer" | "wallet") => {
  if (method === "cash") return "Tiền mặt";
  if (method === "transfer") return "Chuyển khoản";
  return "Ví điện tử";
};

export function PaymentDetailPage({ paymentId }: PaymentDetailPageProps) {
  const snackbar = useSnackbar();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payment, setPayment] = useState<PaymentDetail | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadPayment = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/payments/${paymentId}`);
      if (!response.ok) {
        throw new Error(
          await extractApiErrorMessage(response, "Không tải được chi tiết thanh toán"),
        );
      }
      const data = await unwrapApiResponse<PaymentDetail>(response);
      setPayment(data);
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Không tải được chi tiết thanh toán",
      );
    } finally {
      setLoading(false);
    }
  }, [paymentId]);

  useEffect(() => {
    void loadPayment();
  }, [loadPayment]);

  const handleGenerateReceipt = async () => {
    try {
      setSubmitting(true);
      const response = await fetch(`/api/payments/${paymentId}/receipt`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(
          await extractApiErrorMessage(response, "Không thể tạo biên lai"),
        );
      }
      snackbar.showSuccess("Đã tạo biên lai");
      await loadPayment();
    } catch (actionError) {
      snackbar.showError(
        actionError instanceof Error ? actionError.message : "Không thể tạo biên lai",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelPayment = async () => {
    try {
      setSubmitting(true);
      const response = await fetch(`/api/payments/${paymentId}/cancel`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(
          await extractApiErrorMessage(response, "Không thể hủy thanh toán"),
        );
      }
      snackbar.showSuccess("Đã hủy thanh toán");
      setShowCancelConfirm(false);
      await loadPayment();
    } catch (actionError) {
      snackbar.showError(
        actionError instanceof Error ? actionError.message : "Không thể hủy thanh toán",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !payment) {
    return <Alert severity="error">{error || "Không tìm thấy thanh toán"}</Alert>;
  }

  return (
    <>
      <Stack spacing={2.5}>
        <Paper sx={{ p: 2.5, borderRadius: 3 }}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            justifyContent="space-between"
            alignItems={{ xs: "stretch", md: "center" }}
          >
            <Box>
              <Typography variant="h6" fontWeight={700}>
                Chi tiết thanh toán
              </Typography>
              <Typography color="text.secondary">
                Payment Number: {payment.id}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Button
                variant="outlined"
                startIcon={<EditIcon />}
                onClick={() => setShowEdit(true)}
              >
                Edit Payment
              </Button>
              <Button
                variant="outlined"
                startIcon={<ReceiptLongIcon />}
                onClick={() => void handleGenerateReceipt()}
                disabled={submitting}
              >
                Generate Receipt
              </Button>
              <Button
                variant="outlined"
                color="warning"
                startIcon={<CancelIcon />}
                onClick={() => setShowCancelConfirm(true)}
                disabled={submitting || payment.status === "CANCELLED"}
              >
                Cancel Payment
              </Button>
            </Stack>
          </Stack>
        </Paper>

        <Paper sx={{ p: 2.5, borderRadius: 3 }}>
          <Stack spacing={1.25}>
            <Typography>Payment Number: {payment.id}</Typography>
            <Typography>
              Student: {payment.studentFee?.student?.code} -{" "}
              {payment.studentFee?.student?.fullName}
            </Typography>
            <Typography>Fee Reference: {payment.studentFeeId}</Typography>
            <Typography>Payment Date: {formatDate(payment.paymentDate)}</Typography>
            <Typography>Amount: {formatCurrency(payment.amount)}</Typography>
            <Typography>Payment Method: {getMethodLabel(payment.method)}</Typography>
            <Typography>
              Transaction Number: {payment.bankTransactionId || "-"}
            </Typography>
            <Typography>Notes: {payment.notes || "-"}</Typography>
          </Stack>
        </Paper>
      </Stack>

      {showEdit && (
        <PaymentForm
          initialData={payment}
          onClose={() => setShowEdit(false)}
          onSuccess={() => {
            setShowEdit(false);
            void loadPayment();
          }}
        />
      )}

      <ConfirmDialog
        open={showCancelConfirm}
        title="Hủy thanh toán"
        message="Bạn có chắc muốn hủy giao dịch thanh toán này?"
        confirmLabel="Hủy thanh toán"
        cancelLabel="Đóng"
        confirmColor="warning"
        onConfirm={() => void handleCancelPayment()}
        onCancel={() => setShowCancelConfirm(false)}
        isLoading={submitting}
      />

      {snackbar.Snackbar}
    </>
  );
}
