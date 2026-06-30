"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useRouter, useSearchParams } from "next/navigation";
import EditIcon from "@mui/icons-material/Edit";
import PaymentIcon from "@mui/icons-material/Payment";
import DescriptionIcon from "@mui/icons-material/Description";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import PrintIcon from "@mui/icons-material/Print";
import VisibilityIcon from "@mui/icons-material/Visibility";
import DownloadIcon from "@mui/icons-material/Download";
import { useSnackbar } from "@/hooks/useSnackbar";
import { extractApiErrorMessage, unwrapApiResponse } from "@/lib/api-client";

type TuitionStatus = "UNPAID" | "PARTIAL" | "PAID" | "OVERDUE";

interface StudentFeeDetail {
  id: string;
  feeNumber?: string;
  month: string;
  amount: number;
  discount: number;
  finalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  dueDate: string | null;
  status: "UNPAID" | "PARTIAL" | "PAID";
  displayStatus?: TuitionStatus;
  student?: {
    code: string;
    fullName: string;
  } | null;
  class?: {
    code: string;
    name: string;
  } | null;
  payments: Array<{
    id: string;
    amount: number;
    method: "CASH" | "TRANSFER" | "WALLET";
    paymentDate: string;
    status: "PENDING" | "CONFIRMED" | "CANCELLED" | "FAILED" | "REFUNDED";
    receipt?: {
      id: string;
      receiptNumber: string;
      createdAt: string;
    } | null;
  }>;
  paymentRequests: Array<{
    id: string;
    notices: Array<{
      id: string;
      noticeNumber: string;
      createdAt: string;
      amount: number;
      status: "DRAFT" | "GENERATED" | "PRINTED" | "SENT" | "CANCELLED";
      pdfUrl?: string | null;
      isLatest: boolean;
    }>;
  }>;
}

type StudentFeeDetailPageProps = {
  feeId: string;
};

const formatCurrency = (value: number) =>
  `${new Intl.NumberFormat("vi-VN").format(value)} ₫`;

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString("vi-VN") : "-";

const getFeeStatusLabel = (status: TuitionStatus) => {
  switch (status) {
    case "PAID":
      return "Đã thanh toán";
    case "PARTIAL":
      return "Thanh toán một phần";
    case "OVERDUE":
      return "Quá hạn";
    default:
      return "Chưa thanh toán";
  }
};

const getFeeStatusColor = (status: TuitionStatus) => {
  switch (status) {
    case "PAID":
      return "success";
    case "PARTIAL":
      return "warning";
    case "OVERDUE":
      return "error";
    default:
      return "default";
  }
};

const getPaymentMethodLabel = (method: "CASH" | "TRANSFER" | "WALLET") => {
  if (method === "CASH") return "Tiền mặt";
  if (method === "TRANSFER") return "Chuyển khoản";
  return "Ví điện tử";
};

const getPaymentStatusLabel = (status: string) => {
  if (status === "CONFIRMED") return "Đã xác nhận";
  if (status === "PENDING") return "Chờ xác nhận";
  if (status === "CANCELLED") return "Đã hủy";
  if (status === "FAILED") return "Thất bại";
  return "Hoàn tiền";
};

export function StudentFeeDetailPage({ feeId }: StudentFeeDetailPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const snackbar = useSnackbar();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [fee, setFee] = useState<StudentFeeDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadDetail = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/student-fees/${feeId}`);
      if (!response.ok) {
        throw new Error(
          await extractApiErrorMessage(response, "Không tải được chi tiết học phí"),
        );
      }
      const data = await unwrapApiResponse<StudentFeeDetail>(response);
      setFee(data);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Không tải được chi tiết học phí",
      );
    } finally {
      setLoading(false);
    }
  }, [feeId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const noticeHistory = useMemo(
    () =>
      (fee?.paymentRequests || [])
        .flatMap((request) => request.notices)
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
    [fee?.paymentRequests],
  );

  const receiptHistory = useMemo(
    () =>
      (fee?.payments || [])
        .filter((payment) => payment.receipt)
        .map((payment) => ({
          id: payment.receipt!.id,
          receiptNumber: payment.receipt!.receiptNumber,
          paymentId: payment.id,
          createdAt: payment.receipt!.createdAt,
          amount: payment.amount,
        })),
    [fee?.payments],
  );

  const handleGenerateTemporaryBill = async () => {
    try {
      setSubmitting(true);
      const response = await fetch(`/api/student-fees/${feeId}/generate-notice`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(
          await extractApiErrorMessage(response, "Không thể tạo bill tạm"),
        );
      }
      snackbar.showSuccess("Đã tạo bill tạm");
      await loadDetail();
    } catch (actionError) {
      snackbar.showError(
        actionError instanceof Error ? actionError.message : "Không thể tạo bill tạm",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleGenerateReceipt = async () => {
    try {
      setSubmitting(true);
      const response = await fetch(`/api/student-fees/${feeId}/generate-receipt`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(
          await extractApiErrorMessage(response, "Không thể tạo biên lai"),
        );
      }
      snackbar.showSuccess("Đã tạo biên lai");
      await loadDetail();
    } catch (actionError) {
      snackbar.showError(
        actionError instanceof Error ? actionError.message : "Không thể tạo biên lai",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const focus = searchParams.get("focus");

  useEffect(() => {
    if (!focus) {
      return;
    }
    const element = document.getElementById(`fee-section-${focus}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [focus, fee]);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !fee) {
    return <Alert severity="error">{error || "Không tìm thấy dữ liệu học phí"}</Alert>;
  }

  const displayStatus: TuitionStatus = fee.displayStatus || fee.status;

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
                Chi tiết học phí
              </Typography>
              <Typography color="text.secondary">
                Mã khoản phí: {fee.feeNumber ?? fee.id}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Button
                variant="outlined"
                startIcon={<EditIcon />}
                onClick={() => router.push(`/admin/student-fees/${feeId}/edit`)}
              >
                Edit Fee
              </Button>
              <Button
                variant="outlined"
                startIcon={<PaymentIcon />}
                onClick={() => router.push(`/admin/payments/new?studentFeeId=${feeId}`)}
              >
                Create Payment
              </Button>
              <Button
                variant="outlined"
                startIcon={<DescriptionIcon />}
                disabled={submitting}
                onClick={() => void handleGenerateTemporaryBill()}
              >
                Generate Temporary Bill
              </Button>
              <Button
                variant="outlined"
                startIcon={<ReceiptLongIcon />}
                disabled={submitting}
                onClick={() => void handleGenerateReceipt()}
              >
                Generate Receipt
              </Button>
              <Button variant="contained" startIcon={<PrintIcon />} onClick={() => window.print()}>
                Print
              </Button>
            </Stack>
          </Stack>
        </Paper>

        <Paper id="fee-section-info" sx={{ p: 2.5, borderRadius: 3 }}>
          <Typography variant="h6" fontWeight={700}>
            Section A: Fee Information
          </Typography>
          <Divider sx={{ my: 1.5 }} />
          <Stack
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" },
              gap: 1.5,
            }}
          >
            <Card sx={{ p: 1.5 }}>Fee Number: {fee.feeNumber ?? fee.id}</Card>
            <Card sx={{ p: 1.5 }}>
              Student Information: {fee.student?.code} - {fee.student?.fullName}
            </Card>
            <Card sx={{ p: 1.5 }}>
              Class Information: {fee.class?.code} - {fee.class?.name}
            </Card>
            <Card sx={{ p: 1.5 }}>Billing Month: {fee.month}</Card>
            <Card sx={{ p: 1.5 }}>Amount: {formatCurrency(fee.amount)}</Card>
            <Card sx={{ p: 1.5 }}>Discount: {formatCurrency(fee.discount)}</Card>
            <Card sx={{ p: 1.5 }}>Final Amount: {formatCurrency(fee.finalAmount)}</Card>
            <Card sx={{ p: 1.5 }}>Due Date: {formatDate(fee.dueDate)}</Card>
            <Card sx={{ p: 1.5 }}>
              Status:{" "}
              <Chip
                size="small"
                label={getFeeStatusLabel(displayStatus)}
                color={getFeeStatusColor(displayStatus)}
                variant="outlined"
              />
            </Card>
          </Stack>
        </Paper>

        <Paper id="fee-section-payment" sx={{ p: 2.5, borderRadius: 3 }}>
          <Typography variant="h6" fontWeight={700}>
            Section B: Payment History
          </Typography>
          <Divider sx={{ my: 1.5 }} />
          <Stack spacing={1}>
            {fee.payments.length === 0 ? (
              <Typography color="text.secondary">Chưa có giao dịch thanh toán.</Typography>
            ) : (
              fee.payments.map((payment) => (
                <Card key={payment.id} sx={{ p: 1.5 }}>
                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    spacing={1}
                    justifyContent="space-between"
                    alignItems={{ xs: "flex-start", md: "center" }}
                  >
                    <Typography>
                      {payment.id} | {formatDate(payment.paymentDate)} |{" "}
                      {formatCurrency(payment.amount)} |{" "}
                      {getPaymentMethodLabel(payment.method)} |{" "}
                      {getPaymentStatusLabel(payment.status)}
                    </Typography>
                    <Button
                      size="small"
                      startIcon={<VisibilityIcon />}
                      onClick={() => router.push(`/admin/payments/${payment.id}`)}
                    >
                      View Payment Detail
                    </Button>
                  </Stack>
                </Card>
              ))
            )}
          </Stack>
        </Paper>

        <Paper id="fee-section-temporary-bill" sx={{ p: 2.5, borderRadius: 3 }}>
          <Typography variant="h6" fontWeight={700}>
            Section C: Temporary Bill History
          </Typography>
          <Divider sx={{ my: 1.5 }} />
          <Stack spacing={1}>
            {noticeHistory.length === 0 ? (
              <Typography color="text.secondary">Chưa có bill tạm.</Typography>
            ) : (
              noticeHistory.map((notice) => (
                <Card key={notice.id} sx={{ p: 1.5 }}>
                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    spacing={1}
                    justifyContent="space-between"
                    alignItems={{ xs: "flex-start", md: "center" }}
                  >
                    <Typography>
                      {notice.noticeNumber} | {formatDate(notice.createdAt)} |{" "}
                      {formatCurrency(notice.amount)} | {notice.status}
                    </Typography>
                    <Stack direction="row" spacing={1}>
                      <Button
                        size="small"
                        startIcon={<VisibilityIcon />}
                        disabled={!notice.pdfUrl}
                        onClick={() =>
                          notice.pdfUrl &&
                          window.open(notice.pdfUrl, "_blank", "noopener,noreferrer")
                        }
                      >
                        View Bill
                      </Button>
                      <Button
                        size="small"
                        startIcon={<DownloadIcon />}
                        onClick={() =>
                          void (async () => {
                            const response = await fetch(
                              `/api/student-fees/${feeId}/export-notice-pdf`,
                              { method: "POST" },
                            );
                            if (response.ok) {
                              const data = await unwrapApiResponse<{ pdfUrl: string }>(response);
                              window.open(data.pdfUrl, "_blank", "noopener,noreferrer");
                            }
                          })()
                        }
                      >
                        Export PDF
                      </Button>
                    </Stack>
                  </Stack>
                </Card>
              ))
            )}
          </Stack>
        </Paper>

        <Paper id="fee-section-receipt" sx={{ p: 2.5, borderRadius: 3 }}>
          <Typography variant="h6" fontWeight={700}>
            Section D: Receipt History
          </Typography>
          <Divider sx={{ my: 1.5 }} />
          <Stack spacing={1}>
            {receiptHistory.length === 0 ? (
              <Typography color="text.secondary">Chưa có biên lai.</Typography>
            ) : (
              receiptHistory.map((receipt) => (
                <Card key={receipt.id} sx={{ p: 1.5 }}>
                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    spacing={1}
                    justifyContent="space-between"
                    alignItems={{ xs: "flex-start", md: "center" }}
                  >
                    <Typography>
                      {receipt.receiptNumber} | Payment Ref: {receipt.paymentId} |{" "}
                      {formatDate(receipt.createdAt)} | {formatCurrency(receipt.amount)}
                    </Typography>
                    <Stack direction="row" spacing={1}>
                      <Button
                        size="small"
                        startIcon={<VisibilityIcon />}
                        onClick={() => router.push("/admin/receipts")}
                      >
                        View Receipt
                      </Button>
                      <Button
                        size="small"
                        startIcon={<DownloadIcon />}
                        onClick={() => router.push("/admin/receipts")}
                      >
                        Export PDF
                      </Button>
                    </Stack>
                  </Stack>
                </Card>
              ))
            )}
          </Stack>
        </Paper>
      </Stack>
      {snackbar.Snackbar}
    </>
  );
}
