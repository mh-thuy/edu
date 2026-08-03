"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { CurrencyInput } from "@/components/shared/forms/CurrencyInput";
import { extractApiErrorMessage, unwrapApiResponse } from "@/lib/api-client";
import ArrowBackOutlinedIcon from "@mui/icons-material/ArrowBackOutlined";
import Link from "next/link";

type Fee = {
  feeNo: string;
  originalAmount: number;
  discountAmount: number;
  additionalAmount: number;
  finalAmount: number;
  dueDate?: string | null;
  note?: string | null;
  version: number;
  status: string;
};
export function TuitionEditForm({
  id,
  onSuccess,
}: {
  id: string;
  onSuccess: () => void;
}) {
  const [fee, setFee] = useState<Fee | null>(null);
  const [discount, setDiscount] = useState(0);
  const [additional, setAdditional] = useState(0);
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    void fetch(`/api/tuition-fees/${id}`)
      .then(async (r) => (r.ok ? unwrapApiResponse<Fee>(r) : null))
      .then((data) => {
        if (data) {
          setFee(data);
          setDiscount(Number(data.discountAmount));
          setAdditional(Number(data.additionalAmount));
          setDueDate(data.dueDate?.slice(0, 10) || "");
          setNote(data.note || "");
        }
      });
  }, [id]);
  async function submit() {
    if (!fee || !reason.trim()) {
      setError("Lý do thay đổi là bắt buộc");
      return;
    }
    setSaving(true);
    const response = await fetch(`/api/tuition-fees/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        discountAmount: discount,
        additionalAmount: additional,
        dueDate: dueDate || null,
        note: note || null,
        version: fee.version,
        reason,
      }),
    });
    if (!response.ok)
      setError(
        await extractApiErrorMessage(response, "Không thể cập nhật học phí"),
      );
    else onSuccess();
    setSaving(false);
  }
  if (!fee) return <Typography>Đang tải học phí...</Typography>;
  if (fee.status === "PAID")
    return (
      <Alert severity="warning">Học phí đã thanh toán và không thể sửa.</Alert>
    );
  const total = Number(fee.originalAmount) - discount + additional;
  return (
    <Stack spacing={2} maxWidth={760}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", sm: "center" }}
        spacing={1}
      >
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Sửa học phí {fee.feeNo}
          </Typography>
          <Typography color="text.secondary">
            Cập nhật thông tin trước khi ghi nhận thanh toán
          </Typography>
        </Box>
        <Button
          component={Link}
          href={`/admin/tuition-fees/${id}`}
          variant="outlined"
          startIcon={<ArrowBackOutlinedIcon />}
        >
          Quay lại
        </Button>
      </Stack>
      {error && <Alert severity="error">{error}</Alert>}
      <Paper sx={{ p: 2.5 }}>
        <Stack spacing={2}>
          <Typography variant="subtitle1" fontWeight={700}>
            Thông tin điều chỉnh
          </Typography>
          <CurrencyInput
            label="Học phí gốc"
            value={Number(fee.originalAmount)}
            readOnly
          />
          <CurrencyInput
            label="Giảm giá / học bổng"
            value={discount}
            onChange={setDiscount}
          />
          <CurrencyInput
            label="Phụ phí"
            value={additional}
            onChange={setAdditional}
          />
          <Typography variant="h6" color="primary.main">
            Tổng mới: {total.toLocaleString("vi-VN")} VND
          </Typography>
          <TextField
            type="date"
            label="Hạn thanh toán"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="Ghi chú"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            multiline
          />
          <TextField
            label="Lý do thay đổi *"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            multiline
            minRows={2}
          />
        </Stack>
      </Paper>
      <Stack direction="row" justifyContent="flex-end" spacing={1}>
        <Button
          component={Link}
          href={`/admin/tuition-fees/${id}`}
          variant="text"
        >
          Hủy
        </Button>
        <Button
          variant="contained"
          onClick={() => void submit()}
          disabled={saving}
        >
          {saving ? "Đang lưu..." : "Lưu thay đổi"}
        </Button>
      </Stack>
    </Stack>
  );
}
