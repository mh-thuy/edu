"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Chip,
  Divider,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import Link from "next/link";
import ArrowBackOutlinedIcon from "@mui/icons-material/ArrowBackOutlined";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import { extractApiErrorMessage, unwrapApiResponse } from "@/lib/api-client";
import { ConfirmDialog } from "@/components/shared/dialogs/ConfirmDialog";

type Batch = {
  id: string;
  batchNo: string;
  totalAmount: number;
  paymentMethod: string;
  status: string;
  paymentDate?: string | null;
  createdAt: string;
  updatedAt: string;
  confirmedAt?: string | null;
  bankTransactionNo?: string | null;
  transactionReference?: string | null;
  payerName?: string | null;
  paymentContent?: string | null;
  student: { code: string; fullName: string; phone?: string | null };
  bankAccount?: { accountNo: string; accountName: string; bankName: string } | null;
  receipt?: { id: string; receiptNo: string; issuedAt: string; amount: number } | null;
  createdByUser?: { fullName: string; email: string } | null;
  confirmedByUser?: { fullName: string; email: string } | null;
  receivedByUser?: { fullName: string; email: string } | null;
  allocations: Array<{
    amount: number;
    tuitionFee: {
      feeNo: string;
      finalAmount: number;
      originalAmount: number;
      discountAmount: number;
      additionalAmount: number;
      dueDate?: string | null;
      class: { code: string; name: string };
      items: Array<{
        itemName: string;
        quantity: number;
        unitPrice: number;
        amount: number;
        classSubject?: { subject: { name: string } } | null;
      }>;
    };
  }>;
  payments: Array<{
    paymentNo: string;
    amount: number;
    paymentDate: string;
    paymentMethod: string;
    receipt?: { id: string; receiptNo: string } | null;
  }>;
};

const money = (value: number) =>
  `${new Intl.NumberFormat("vi-VN").format(Number(value))} VND`;
const date = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString("vi-VN") : "-";
const dateTime = (value?: string | null) =>
  value ? new Date(value).toLocaleString("vi-VN") : "-";
const statusLabels: Record<string, string> = {
  PENDING: "Chờ chuyển khoản / đối soát",
  SUCCESS: "Đã thanh toán",
  FAILED: "Thất bại",
  CANCELLED: "Đã hủy",
};
const statusColors: Record<string, "warning" | "success" | "error" | "default"> = {
  PENDING: "warning",
  SUCCESS: "success",
  FAILED: "error",
  CANCELLED: "default",
};

export function PaymentBatchDetail({ id }: { id: string }) {
  const [batch, setBatch] = useState<Batch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cashDialogOpen, setCashDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/payment-batches/${id}`);
      if (!response.ok)
        throw new Error(
          await extractApiErrorMessage(response, "Không thể tải chi tiết đợt thanh toán"),
        );
      setBatch(await unwrapApiResponse<Batch>(response));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể tải chi tiết đợt thanh toán");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function convertToCash() {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/payment-batches/${id}/cash`, {
        method: "POST",
      });
      if (!response.ok)
        throw new Error(
          await extractApiErrorMessage(response, "Không thể chuyển sang tiền mặt"),
        );
      setCashDialogOpen(false);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể chuyển sang tiền mặt");
    } finally {
      setActionLoading(false);
    }
  }

  async function cancelPayment() {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/payment-batches/${id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Hủy từ chi tiết đợt thanh toán" }),
      });
      if (!response.ok)
        throw new Error(
          await extractApiErrorMessage(response, "Không thể hủy thanh toán"),
        );
      setCancelDialogOpen(false);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể hủy thanh toán");
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) return <Typography>Đang tải chi tiết đợt thanh toán...</Typography>;
  if (error || !batch)
    return <Alert severity="error">{error || "Không tìm thấy đợt thanh toán"}</Alert>;

  return (
    <Stack spacing={2.5}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", md: "center" }}
        gap={1}
      >
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Chi tiết đợt thanh toán
          </Typography>
          <Typography color="text.secondary">{batch.batchNo}</Typography>
        </Box>
        <Button
          component={Link}
          href="/admin/tuition-fees/payment-history"
          variant="outlined"
          startIcon={<ArrowBackOutlinedIcon />}
        >
          Quay lại lịch sử
        </Button>
      </Stack>

      <Paper sx={{ p: { xs: 2, md: 3 } }}>
        <Stack spacing={2}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            justifyContent="space-between"
            gap={2}
          >
            <Stack spacing={0.75}>
              <Typography variant="h6">{batch.batchNo}</Typography>
              <Chip
                sx={{ alignSelf: "flex-start" }}
                color={statusColors[batch.status] || "default"}
                label={statusLabels[batch.status] || batch.status}
              />
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              {batch.status === "PENDING" && (
                <>
                  <Button
                    variant="outlined"
                    color="warning"
                    onClick={() => setCashDialogOpen(true)}
                  >
                    Chuyển sang tiền mặt
                  </Button>
                  <Button
                    variant="outlined"
                    color="error"
                    onClick={() => setCancelDialogOpen(true)}
                  >
                    Hủy thanh toán
                  </Button>
                  <Button
                    variant="outlined"
                    href={`/api/payment-batches/${batch.id}/notice/pdf`}
                  >
                    Tải thông báo PDF
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<PrintOutlinedIcon />}
                    component="a"
                    href={`/api/payment-batches/${batch.id}/notice/pdf?inline=1`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Mở để in
                  </Button>
                </>
              )}
              {batch.receipt && (
                <Button
                  variant="outlined"
                  href={`/api/payment-batch-receipts/${batch.receipt.id}/pdf`}
                >
                  Tải biên lai
                </Button>
              )}
            </Stack>
          </Stack>
          <Divider />
          <InfoGrid>
            <Info label="Học viên" value={`${batch.student.code} — ${batch.student.fullName}`} />
            <Info label="Số điện thoại" value={batch.student.phone || "-"} />
            <Info label="Phương thức" value={paymentMethodLabel(batch.paymentMethod)} />
            <Info label="Tổng tiền" value={money(batch.totalAmount)} strong />
            <Info label="Ngày tạo" value={dateTime(batch.createdAt)} />
            <Info label="Ngày thanh toán" value={dateTime(batch.paymentDate)} />
            <Info label="Nhân viên tạo" value={batch.createdByUser?.fullName || "-"} />
            <Info
              label={batch.paymentMethod === "CASH" ? "Nhân viên nhận tiền" : "Nhân viên xác nhận"}
              value={
                batch.paymentMethod === "CASH"
                  ? batch.receivedByUser?.fullName || batch.confirmedByUser?.fullName || "-"
                  : batch.confirmedByUser?.fullName || "-"
              }
            />
          </InfoGrid>
        </Stack>
      </Paper>

      {batch.status === "PENDING" && (
        <Alert
          severity="warning"
          variant="filled"
          sx={{
            alignItems: "flex-start",
            boxShadow: 2,
            "& .MuiAlert-message": { width: "100%" },
          }}
        >
          <AlertTitle sx={{ fontWeight: 800 }}>
            Đợt thanh toán đang chờ xử lý
          </AlertTitle>
          Chưa ghi nhận thanh toán thành công. Vui lòng đối soát chuyển khoản,
          chuyển sang tiền mặt hoặc hủy thanh toán nếu cần.
        </Alert>
      )}
      {batch.status === "CANCELLED" && (
        <Alert severity="error" variant="filled" sx={{ boxShadow: 2 }}>
          <AlertTitle sx={{ fontWeight: 800 }}>Đợt thanh toán đã bị hủy</AlertTitle>
          Các khoản học phí trong đợt đã được giải phóng để có thể tạo thanh toán lại.
        </Alert>
      )}

      <Paper sx={{ p: { xs: 2, md: 3 } }}>
        <Typography variant="h6" fontWeight={700} gutterBottom>
          Các khoản học phí trong đợt
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Tiền môn học lấy theo chi tiết từng môn; tổng khoản học phí là số tiền sau khi áp dụng giảm giá và phụ phí.
        </Typography>
        <Table sx={{ minWidth: 760 }} size="small">
          <TableHead>
            <TableRow>
              <TableCell>Mã học phí</TableCell>
              <TableCell>Lớp</TableCell>
              <TableCell>Môn học</TableCell>
              <TableCell align="right">Tiền môn học</TableCell>
              <TableCell>Hạn thanh toán</TableCell>
              <TableCell align="right">Tổng khoản học phí</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {batch.allocations.map((allocation) => {
              const items = allocation.tuitionFee.items.length
                ? allocation.tuitionFee.items
                : [null];
              return items.map((item, index) => (
                <TableRow key={`${allocation.tuitionFee.feeNo}-${item?.itemName || "total"}`}>
                  <TableCell>{index === 0 ? allocation.tuitionFee.feeNo : ""}</TableCell>
                  <TableCell>{index === 0 ? `${allocation.tuitionFee.class.code} — ${allocation.tuitionFee.class.name}` : ""}</TableCell>
                  <TableCell>
                    {item?.classSubject?.subject.name || item?.itemName || "Chưa có chi tiết môn học"}
                  </TableCell>
                  <TableCell align="right">{money(item ? item.amount : allocation.amount)}</TableCell>
                  {index === 0 && (
                    <TableCell rowSpan={items.length}>{date(allocation.tuitionFee.dueDate)}</TableCell>
                  )}
                  {index === 0 && (
                    <TableCell align="right" rowSpan={items.length}>
                      <Typography fontWeight={700}>{money(allocation.amount)}</Typography>
                      {(allocation.tuitionFee.discountAmount || allocation.tuitionFee.additionalAmount) && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          Sau điều chỉnh
                        </Typography>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ));
            })}
            <TableRow>
              <TableCell colSpan={5} align="right"><Typography fontWeight={700}>Tổng cộng đợt thanh toán</Typography></TableCell>
              <TableCell align="right"><Typography fontWeight={700}>{money(batch.totalAmount)}</Typography></TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Paper>

      <Paper sx={{ p: { xs: 2, md: 3 } }}>
        <Typography variant="h6" fontWeight={700} gutterBottom>
          Thông tin thanh toán và đối soát
        </Typography>
        <InfoGrid>
          <Info label="Người nộp" value={batch.payerName || "-"} />
          <Info label="Nội dung thanh toán" value={batch.paymentContent || "-"} />
          <Info label="Mã giao dịch ngân hàng" value={batch.bankTransactionNo || "-"} />
          <Info label="Mã tham chiếu" value={batch.transactionReference || "-"} />
          <Info label="Tài khoản nhận" value={batch.bankAccount ? `${batch.bankAccount.bankName} — ${batch.bankAccount.accountNo}` : "-"} />
          <Info label="Ngày cập nhật" value={dateTime(batch.updatedAt)} />
        </InfoGrid>
        {batch.receipt && (
          <Alert severity="success" sx={{ mt: 2 }}>
            Biên lai {batch.receipt.receiptNo} đã phát hành ngày {dateTime(batch.receipt.issuedAt)}
            {batch.paymentMethod === "CASH" &&
            (batch.receivedByUser || batch.confirmedByUser)
              ? ` bởi ${(batch.receivedByUser || batch.confirmedByUser)?.fullName}.`
              : "."}
          </Alert>
        )}
      </Paper>

      <ConfirmDialog
        open={cashDialogOpen}
        title="Chuyển sang thanh toán tiền mặt"
        message={`Xác nhận đã nhận ${money(batch.totalAmount)} tiền mặt từ ${batch.student.fullName}? Hệ thống sẽ hoàn tất thanh toán và phát hành biên lai.`}
        confirmLabel="Xác nhận tiền mặt"
        cancelLabel="Quay lại"
        confirmColor="warning"
        onConfirm={() => void convertToCash()}
        onCancel={() => setCashDialogOpen(false)}
        isLoading={actionLoading}
      />
      <ConfirmDialog
        open={cancelDialogOpen}
        title="Hủy thanh toán"
        message={`Hủy đợt ${batch.batchNo}? Các khoản học phí sẽ được giải phóng để có thể tạo thanh toán lại.`}
        confirmLabel="Hủy thanh toán"
        cancelLabel="Quay lại"
        onConfirm={() => void cancelPayment()}
        onCancel={() => setCancelDialogOpen(false)}
        isLoading={actionLoading}
      />
    </Stack>
  );
}

function InfoGrid({ children }: { children: React.ReactNode }) {
  return <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "repeat(4, 1fr)" }, gap: 2 }}>{children}</Box>;
}

function Info({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <Box><Typography variant="caption" color="text.secondary">{label}</Typography><Typography fontWeight={strong ? 700 : 500}>{value}</Typography></Box>;
}

function paymentMethodLabel(value: string) {
  if (value === "BANK_TRANSFER") return "Chuyển khoản / VietQR";
  if (value === "CASH") return "Tiền mặt";
  return "Khác";
}
