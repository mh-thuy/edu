"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import { extractApiErrorMessage, unwrapApiResponse } from "@/lib/api-client";

const money = (value: number) =>
  `${new Intl.NumberFormat("vi-VN").format(value)} VND`;

type Detail = {
  receiptNo: string;
  issuedAt: string;
  receiverName?: string | null;
  amount: number;
  status: string;
  payment: {
    id: string;
    paymentNo: string;
    paymentStatus: string;
    paymentMethod: string;
    transactionReference?: string | null;
    refunds: Array<{
      id: string;
      refundNo: string;
      amount: number;
      refundMethod: string;
      status: string;
      reason: string;
      bankTransactionNo?: string | null;
    }>;
    tuitionFee: {
      feeNo: string;
      discountAmount: number;
      additionalAmount: number;
      student: { code: string; fullName: string };
      class: { name: string };
      items: Array<{
        itemName: string;
        amount: number;
        classSubject?: { subject: { name: string } } | null;
      }>;
    };
  };
};
const paymentMethodLabels: Record<string, string> = {
  CASH: "Tiền mặt",
  BANK_TRANSFER: "Chuyển khoản",
  QR: "QR ngân hàng",
};
const receiptStatusLabels: Record<string, string> = {
  ACTIVE: "Đang hiệu lực",
  CANCELLED: "Đã hủy",
};
export function ReceiptDetailDialog({
  id,
  onClose,
  onCancelled,
}: {
  id: string;
  onClose: () => void;
  onCancelled?: () => void;
}) {
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [refundDialog, setRefundDialog] = useState<"CREATE" | "COMPLETE" | null>(null);
  const [refundMethod, setRefundMethod] = useState<"CASH" | "BANK_TRANSFER">("CASH");
  const [refundReason, setRefundReason] = useState("");
  const [refundBankTransactionNo, setRefundBankTransactionNo] = useState("");
  const [refundLoading, setRefundLoading] = useState(false);

  const load = useCallback(() => fetch(`/api/receipts/${id}`)
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            await extractApiErrorMessage(
              response,
              "Không thể tải chi tiết biên lai",
            ),
          );
        return unwrapApiResponse<Detail>(response);
      })
      .then(setData)
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error
            ? reason.message
          : "Không thể tải chi tiết biên lai",
        ),
      ), [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeRefund = data?.payment.refunds.find((refund) => !["REJECTED", "CANCELLED"].includes(refund.status));

  async function createRefund() {
    if (!refundReason.trim()) {
      setError("Vui lòng nhập lý do hoàn tiền");
      return;
    }
    setRefundLoading(true);
    setError("");
    try {
      const response = await fetch("/api/payment-refunds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId: data?.payment.id, refundMethod, reason: refundReason.trim() }),
      });
      if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không thể tạo yêu cầu hoàn tiền"));
      setRefundDialog(null);
      setRefundReason("");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể tạo yêu cầu hoàn tiền");
    } finally {
      setRefundLoading(false);
    }
  }

  async function approveRefund() {
    if (!activeRefund) return;
    setRefundLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/payment-refunds/${activeRefund.id}/approve`, { method: "POST" });
      if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không thể duyệt hoàn tiền"));
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể duyệt hoàn tiền");
    } finally {
      setRefundLoading(false);
    }
  }

  async function completeRefund() {
    if (!activeRefund) return;
    if (activeRefund.refundMethod === "BANK_TRANSFER" && !refundBankTransactionNo.trim()) {
      setError("Vui lòng nhập mã giao dịch hoàn tiền");
      return;
    }
    setRefundLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/payment-refunds/${activeRefund.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bankTransactionNo: refundBankTransactionNo.trim() || undefined }),
      });
      if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không thể hoàn tất hoàn tiền"));
      setRefundDialog(null);
      setRefundBankTransactionNo("");
      await load();
      onCancelled?.();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể hoàn tất hoàn tiền");
    } finally {
      setRefundLoading(false);
    }
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Chi tiết biên lai</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error">{error}</Alert>}
        {!data && !error && (
          <Stack alignItems="center" sx={{ py: 4 }}>
            <CircularProgress />
          </Stack>
        )}
        {data && (
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            <Typography>
              Số biên lai: <strong>{data.receiptNo}</strong>
            </Typography>
            <Typography>
              Trạng thái:{" "}
              <Chip
                size="small"
                color={data.status === "ACTIVE" ? "success" : "default"}
                label={receiptStatusLabels[data.status] ?? data.status}
              />
            </Typography>
            <Typography>Mã giao dịch: {data.payment.paymentNo}</Typography>
            {activeRefund && (
              <Alert severity={activeRefund.status === "COMPLETED" ? "success" : "warning"}>
                Hoàn tiền {activeRefund.refundNo}: {activeRefund.status}
              </Alert>
            )}
            <Typography>Mã học phí: {data.payment.tuitionFee.feeNo}</Typography>
            <Typography>
              Học viên: {data.payment.tuitionFee.student.code} —{" "}
              {data.payment.tuitionFee.student.fullName}
            </Typography>
            <Typography>Lớp: {data.payment.tuitionFee.class.name}</Typography>
            <Typography fontWeight={700}>Nội dung thu:</Typography>
            <Stack spacing={0.5}>
              {data.payment.tuitionFee.items
                .map((item, index) => (
                  <Typography
                    key={`${item.itemName}-${index}`}
                    variant="body2"
                  >
                    • {item.classSubject?.subject.name || item.itemName} — {money(Number(item.amount))}
                  </Typography>
                ))}
            </Stack>
            {Number(data.payment.tuitionFee.discountAmount) > 0 && (
              <Typography color="success.main">
                Giảm giá: -{money(Number(data.payment.tuitionFee.discountAmount))}
              </Typography>
            )}
            {Number(data.payment.tuitionFee.additionalAmount) > 0 && (
              <Typography>
                Phụ thu: {money(Number(data.payment.tuitionFee.additionalAmount))}
              </Typography>
            )}
            <Typography>Người nộp: {data.receiverName || "-"}</Typography>
            <Typography>
              Phương thức:{" "}
              {paymentMethodLabels[data.payment.paymentMethod] ??
                data.payment.paymentMethod}
            </Typography>
            <Typography>
              Ngày thu: {new Date(data.issuedAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}
            </Typography>
            <Divider />
            <Box sx={{ p: 2, bgcolor: "action.hover" }}>
              <Typography variant="body2" color="text.secondary">
                Tổng tiền
              </Typography>
              <Typography variant="h6" fontWeight={800}>
                {Number(data.amount).toLocaleString("vi-VN")} VND
              </Typography>
            </Box>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              {data.status === "ACTIVE" && (
                <>
                  <Button
                    variant="outlined"
                    startIcon={<DownloadOutlinedIcon />}
                    href={`/api/tuition-receipts/${id}/pdf`}
                  >
                    Tải PDF
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<PrintOutlinedIcon />}
                    href={`/api/tuition-receipts/${id}/pdf?inline=1`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Mở để in
                  </Button>
                </>
              )}
              {data.status === "ACTIVE" && data.payment.paymentStatus === "SUCCESS" && !activeRefund && (
                <Button variant="outlined" color="warning" onClick={() => setRefundDialog("CREATE")} disabled={refundLoading}>
                  Tạo yêu cầu hoàn tiền
                </Button>
              )}
              {activeRefund?.status === "PENDING" && (
                <Button variant="outlined" color="warning" onClick={() => void approveRefund()} disabled={refundLoading}>
                  Duyệt hoàn tiền
                </Button>
              )}
              {activeRefund?.status === "APPROVED" && (
                <Button variant="contained" color="warning" onClick={() => setRefundDialog("COMPLETE")} disabled={refundLoading}>
                  Hoàn tất hoàn tiền
                </Button>
              )}
            </Stack>
            <Dialog open={Boolean(refundDialog)} onClose={() => !refundLoading && setRefundDialog(null)} fullWidth maxWidth="sm">
              <DialogTitle>{refundDialog === "CREATE" ? "Tạo yêu cầu hoàn tiền toàn bộ" : "Hoàn tất hoàn tiền"}</DialogTitle>
              <DialogContent>
                {refundDialog === "CREATE" ? (
                  <Stack spacing={2} sx={{ pt: 1 }}>
                    <Typography variant="body2" color="text.secondary">Nếu payment thuộc batch nhiều khoản, toàn bộ batch sẽ được hoàn cùng lúc.</Typography>
                    <TextField select label="Phương thức hoàn" value={refundMethod} onChange={(event) => setRefundMethod(event.target.value as "CASH" | "BANK_TRANSFER")} SelectProps={{ native: true }}>
                      <option value="CASH">Tiền mặt</option>
                      <option value="BANK_TRANSFER">Chuyển khoản</option>
                    </TextField>
                    <TextField fullWidth required multiline minRows={2} label="Lý do" value={refundReason} onChange={(event) => setRefundReason(event.target.value)} inputProps={{ maxLength: 500 }} />
                  </Stack>
                ) : (
                  <TextField fullWidth sx={{ mt: 1 }} label="Mã giao dịch hoàn tiền" required={activeRefund?.refundMethod === "BANK_TRANSFER"} value={refundBankTransactionNo} onChange={(event) => setRefundBankTransactionNo(event.target.value)} disabled={activeRefund?.refundMethod === "CASH"} />
                )}
              </DialogContent>
              <DialogActions>
                <Button variant="outlined" onClick={() => setRefundDialog(null)} disabled={refundLoading}>Đóng</Button>
                <Button variant="contained" color="warning" onClick={() => void (refundDialog === "CREATE" ? createRefund() : completeRefund())} disabled={refundLoading || (refundDialog === "CREATE" ? !refundReason.trim() : activeRefund?.refundMethod === "BANK_TRANSFER" && !refundBankTransactionNo.trim())}>
                  {refundLoading ? "Đang xử lý..." : refundDialog === "CREATE" ? "Tạo yêu cầu" : "Hoàn tất"}
                </Button>
              </DialogActions>
            </Dialog>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose}>
          Đóng
        </Button>
      </DialogActions>
    </Dialog>
  );
}
