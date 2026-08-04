"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Alert,
  Button,
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
  const canPay =
    !paid && fee.status !== "EXEMPTED" && fee.status !== "CANCELLED";
  return (
    <Stack spacing={2}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
      >
        <Stack>
          <Typography variant="h5" fontWeight={700}>
            Chi tiết học phí {fee.feeNo}
          </Typography>
          <Typography color="text.secondary">
            Thông tin học viên, khoản phí và trạng thái thanh toán
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button
            component={Link}
            href="/admin/tuition-fees"
            variant="outlined"
          >
            Quay lại
          </Button>
          {!paid && (
            <Button
              component={Link}
              href={`/admin/tuition-fees/${id}/edit`}
              variant="outlined"
              startIcon={<EditOutlinedIcon />}
            >
              Chỉnh sửa
            </Button>
          )}
          {canPay && (
            <Button
              component={Link}
              href={`/admin/tuition-fees/payment?tuitionFeeId=${id}`}
              variant="contained"
            >
              Thanh toán học phí
            </Button>
          )}
        </Stack>
      </Stack>
      <Paper sx={{ p: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={4}>
          <Info title="Học viên">
            <Typography>
              {fee.student.code} — {fee.student.fullName}
            </Typography>
            <Typography variant="body2">
              SĐT: {fee.student.phone || "-"}
            </Typography>
          </Info>
          <Info title="Lớp học">
            {fee.class.code} — {fee.class.name}
          </Info>
          <Info title="Trạng thái">
            <Chip
              color={
                fee.status === "PAID"
                  ? "success"
                  : fee.status === "OVERDUE"
                    ? "error"
                    : "warning"
              }
              label={labels[fee.status]}
            />
          </Info>
        </Stack>
      </Paper>
      <Paper sx={{ p: 2, overflow: "auto" }}>
        <Typography variant="h6">Chi tiết khoản phí</Typography>
        <Table size="small">
          <TableBody>
            {fee.items.map((item, index) => (
              <TableRow key={index}>
                <TableCell>
                  {item.itemName} × {Number(item.quantity)}
                </TableCell>
                <TableCell align="right">
                  {Number(item.amount).toLocaleString("vi-VN")} VND
                </TableCell>
              </TableRow>
            ))}
            <TableRow>
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
        <Typography>
          Hạn thanh toán:{" "}
          {fee.dueDate
            ? new Date(fee.dueDate).toLocaleDateString("vi-VN")
            : "Chưa xác định"}
        </Typography>
      </Paper>
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6">Thông tin thanh toán</Typography>
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
