"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Alert,
  Button,
  Box,
  Chip,
  Divider,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Typography,
} from "@mui/material";
import Link from "next/link";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import { extractApiErrorMessage, unwrapApiResponse } from "@/lib/api-client";

type Fee = {
  id: string;
  feeNo: string;
  originalAmount: number;
  discountAmount: number;
  additionalAmount: number;
  finalAmount: number;
  dueDate?: string | null;
  status: "UNPAID" | "PAID" | "OVERDUE" | "EXEMPTED" | "CANCELLED";
  student: { code: string; fullName: string; phone?: string | null };
  class: { code: string; name: string };
  items: Array<{ itemName: string; quantity: number; amount: number }>;
  paymentAllocations?: Array<{ paymentBatch: { id: string; batchNo: string; status: string } }>;
  payments: Array<{
    id: string;
    paymentNo: string;
    amount: number;
    paymentMethod: string;
    paymentDate: string;
    receipt?: { id: string } | null;
  }>;
};
const labels = {
  UNPAID: "Chưa thanh toán",
  PAID: "Đã thanh toán",
  OVERDUE: "Quá hạn",
  EXEMPTED: "Miễn học phí",
  CANCELLED: "Đã hủy",
};

export function TuitionDetail({ id }: { id: string }) {
  const [fee, setFee] = useState<Fee | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/tuition-fees/${id}`);
      if (!response.ok)
        throw new Error(
          await extractApiErrorMessage(
            response,
            "Không thể tải chi tiết học phí",
          ),
        );
      setFee(await unwrapApiResponse<Fee>(response));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Không thể tải chi tiết học phí",
      );
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);
  if (loading) return <Typography>Đang tải chi tiết học phí...</Typography>;
  if (error || !fee)
    return <Alert severity="error">{error || "Không tìm thấy học phí"}</Alert>;
  const paid = fee.status === "PAID";
  const pendingBatch = fee.paymentAllocations?.[0]?.paymentBatch;
  const canPay =
    !paid &&
    fee.status !== "EXEMPTED" &&
    fee.status !== "CANCELLED" &&
    !fee.paymentAllocations?.length;
  return (
    <Stack spacing={2}>
      <Paper sx={{ p: { xs: 2, md: 3 } }}>
        <Stack spacing={2}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            justifyContent="space-between"
            gap={2}
          >
            <Stack spacing={0.75}>
              <Typography variant="h5" fontWeight={700}>
                Chi tiết học phí
              </Typography>
              <Typography color="text.secondary">{fee.feeNo}</Typography>
              <Chip
                sx={{ alignSelf: "flex-start" }}
                color={
                  fee.status === "PAID"
                    ? "success"
                    : fee.status === "OVERDUE"
                      ? "error"
                      : "warning"
                }
                label={labels[fee.status]}
              />
            </Stack>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              sx={{ alignItems: { xs: "stretch", sm: "center" }, flexWrap: "wrap" }}
            >
              {canPay && (
                <Button
                  component={Link}
                  href={`/admin/tuition-fees/payment?tuitionFeeId=${id}`}
                  variant="contained"
                >
                  Thanh toán học phí
                </Button>
              )}
              {pendingBatch && (
                <Button
                  component="a"
                  href={`/api/payment-batches/${pendingBatch.id}/notice/pdf`}
                  variant="outlined"
                >
                  Xuất thông báo
                </Button>
              )}
              {!paid && !pendingBatch && (
                <Button
                  component={Link}
                  href={`/admin/tuition-fees/${id}/edit`}
                  variant="outlined"
                  startIcon={<EditOutlinedIcon />}
                >
                  Chỉnh sửa
                </Button>
              )}
              <Button component={Link} href="/admin/tuition-fees" variant="outlined">
                Quay lại
              </Button>
            </Stack>
          </Stack>
          {pendingBatch && (
            <Alert severity="warning">
              Khoản phí đang chờ thanh toán trong đợt {pendingBatch.batchNo}. Không thể chỉnh sửa hoặc tạo thanh toán khác.
            </Alert>
          )}
        </Stack>
      </Paper>

      <Paper sx={{ p: { xs: 2, md: 3 } }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          justifyContent="space-between"
          gap={3}
        >
          <Stack direction={{ xs: "column", sm: "row" }} spacing={4}>
            <Info title="Học viên">
              <Typography fontWeight={600}>
                {fee.student.code} — {fee.student.fullName}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                SĐT: {fee.student.phone || "-"}
              </Typography>
            </Info>
            <Info title="Lớp học">
              <Typography fontWeight={600}>{fee.class.code}</Typography>
              <Typography variant="body2" color="text.secondary">
                {fee.class.name}
              </Typography>
            </Info>
            <Info title="Hạn thanh toán">
              <Typography fontWeight={600}>
                {fee.dueDate
                  ? new Date(fee.dueDate).toLocaleDateString("vi-VN")
                  : "Chưa xác định"}
              </Typography>
            </Info>
          </Stack>
          <Box sx={{ minWidth: 220, textAlign: { xs: "left", md: "right" } }}>
            <Typography variant="body2" color="text.secondary">
              Tổng phải thanh toán
            </Typography>
            <Typography variant="h5" fontWeight={800} color="primary.main">
              {Number(fee.finalAmount).toLocaleString("vi-VN")} VND
            </Typography>
          </Box>
        </Stack>
      </Paper>

      <Paper sx={{ p: { xs: 2, md: 3 }, overflow: "auto" }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          Chi tiết từng môn và khoản phí
        </Typography>
        <Table size="small">
          <TableBody>
            {fee.items.map((item, index) => (
              <TableRow key={index}>
                <TableCell>
                  {item.itemName}
                  <Typography component="span" variant="body2" color="text.secondary">
                    {` × ${Number(item.quantity)}`}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  {Number(item.amount).toLocaleString("vi-VN")} VND
                </TableCell>
              </TableRow>
            ))}
            <TableRow sx={{ "& td": { borderTop: 1, borderColor: "divider" } }}>
              <TableCell>Học phí gốc</TableCell>
              <TableCell align="right">
                {Number(fee.originalAmount).toLocaleString("vi-VN")} VND
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Giảm giá / học bổng</TableCell>
              <TableCell align="right">
                -{Number(fee.discountAmount).toLocaleString("vi-VN")} VND
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Phụ phí</TableCell>
              <TableCell align="right">
                {Number(fee.additionalAmount).toLocaleString("vi-VN")} VND
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell>
                <strong>Tổng phải thanh toán</strong>
              </TableCell>
              <TableCell align="right">
                <strong>
                  {Number(fee.finalAmount).toLocaleString("vi-VN")} VND
                </strong>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <Divider sx={{ my: 2 }} />
      </Paper>
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>Lịch sử thanh toán</Typography>
        {fee.payments.length ? (
          fee.payments.map((payment) => (
            <Stack
              key={payment.id}
              direction={{ xs: "column", md: "row" }}
              justifyContent="space-between"
              sx={{ py: 1 }}
            >
              <Typography>
                {payment.paymentNo} · {payment.paymentMethod} ·{" "}
                {new Date(payment.paymentDate).toLocaleDateString("vi-VN")}
              </Typography>
              <Typography>
                {Number(payment.amount).toLocaleString("vi-VN")} VND{" "}
                {payment.receipt && (
                  <Button
                    size="small"
                    variant="outlined"
                    href={`/api/tuition-receipts/${payment.receipt.id}/pdf`}
                  >
                    Xuất biên lai
                  </Button>
                )}
              </Typography>
            </Stack>
          ))
        ) : (
          <Typography color="text.secondary">
            Chưa có giao dịch thành công
          </Typography>
        )}
      </Paper>
    </Stack>
  );
}

function Info({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Stack minWidth={200}>
      <Typography variant="caption" color="text.secondary">
        {title}
      </Typography>
      {children}
    </Stack>
  );
}
