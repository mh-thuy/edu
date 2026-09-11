"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import Link from "next/link";
import { extractApiErrorMessage, unwrapApiResponse } from "@/lib/api-client";
import { useSnackbar } from "@/hooks/useSnackbar";

type ClassData = { id: string; code: string; name: string };
type Fee = {
  id: string;
  feeNo: string;
  originalAmount: number;
  finalAmount: number;
  status: "UNPAID" | "PAID" | "OVERDUE" | "EXEMPTED" | "CANCELLED";
  billingYear: number;
  billingMonth: number;
  student: { code: string; fullName: string };
  items: Array<{ itemName: string; amount: number }>;
};

const currentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};
const money = (value: number) => `${new Intl.NumberFormat("vi-VN").format(Number(value))} VND`;
const statusLabel: Record<Fee["status"], string> = { UNPAID: "Chưa thu", PAID: "Đã thu", OVERDUE: "Quá hạn", EXEMPTED: "Miễn phí", CANCELLED: "Đã hủy" };
const statusColor: Record<Fee["status"], "warning" | "success" | "error" | "info" | "default"> = { UNPAID: "warning", PAID: "success", OVERDUE: "error", EXEMPTED: "info", CANCELLED: "default" };

export function ClassTuitionManagement({ id }: { id: string }) {
  const [classData, setClassData] = useState<ClassData | null>(null);
  const [fees, setFees] = useState<Fee[]>([]);
  const [month, setMonth] = useState(currentMonth);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { showSuccess, showError, Snackbar } = useSnackbar();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [classResponse, feeResponse] = await Promise.all([
        fetch(`/api/classes/${id}`),
        fetch(`/api/tuition-fees?classId=${id}&month=${encodeURIComponent(month)}&page=1&pageSize=10000`),
      ]);
      if (!classResponse.ok) throw new Error(await extractApiErrorMessage(classResponse, "Không thể tải lớp học"));
      if (!feeResponse.ok) throw new Error(await extractApiErrorMessage(feeResponse, "Không thể tải học phí"));
      const [classResult, feeResult] = await Promise.all([
        unwrapApiResponse<ClassData>(classResponse),
        unwrapApiResponse<{ items: Fee[] }>(feeResponse),
      ]);
      setClassData(classResult);
      setFees(feeResult.items);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể tải dữ liệu");
    } finally {
      setLoading(false);
    }
  }, [id, month]);

  useEffect(() => { void load(); }, [load]);

  const totals = useMemo(() => ({
    amount: fees.reduce((sum, fee) => sum + Number(fee.finalAmount), 0),
    paid: fees.filter((fee) => fee.status === "PAID").length,
    unpaid: fees.filter((fee) => fee.status === "UNPAID" || fee.status === "OVERDUE").length,
  }), [fees]);

  async function createFees() {
    setBusy(true);
    try {
      const response = await fetch(`/api/classes/${id}/tuition-fees?month=${encodeURIComponent(month)}`, { method: "POST" });
      if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không thể tạo học phí tháng"));
      const result = await unwrapApiResponse<{ created: number; skipped: number }>(response);
      await load();
      showSuccess(`Đã tạo học phí cho ${result.created} học viên`);
    } catch (reason) {
      showError(reason instanceof Error ? reason.message : "Không thể tạo học phí tháng");
    } finally {
      setBusy(false);
    }
  }

  async function createPaymentNotice() {
    setBusy(true);
    try {
      const response = await fetch(`/api/classes/${id}/tuition-notice/pdf?month=${encodeURIComponent(month)}`);
      if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không thể tạo thanh toán và thông báo"));
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `thong-bao-hoc-phi-${classData?.code ?? "lop"}-${month}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
      await load();
      showSuccess("Đã tạo thanh toán và xuất thông báo");
    } catch (reason) {
      showError(reason instanceof Error ? reason.message : "Không thể tạo thanh toán và thông báo");
    } finally {
      setBusy(false);
    }
  }

  if (!classData && loading) return <Typography>Đang tải học phí lớp...</Typography>;
  if (!classData) return <Alert severity="error">{error || "Không tìm thấy lớp học"}</Alert>;

  return <Stack spacing={2}>
    <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={1}>
      <Stack><Button component={Link} href={`/admin/classes/${id}`} sx={{ alignSelf: "flex-start", px: 0 }}>← Chi tiết lớp</Button><Typography variant="h5" fontWeight={700}>Học phí tháng</Typography><Typography color="text.secondary">{classData.code} — {classData.name}</Typography></Stack>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}><TextField label="Kỳ học phí" type="month" size="small" value={month} onChange={(event) => setMonth(event.target.value)} InputLabelProps={{ shrink: true }} /><Button variant="outlined" onClick={() => void createFees()} disabled={busy}>Tạo học phí tháng</Button><Button variant="contained" onClick={() => void createPaymentNotice()} disabled={busy}>Tạo thanh toán & xuất thông báo</Button></Stack>
    </Stack>
    {error && <Alert severity="error">{error}</Alert>}
    <Alert severity="info">Học phí được tính trọn tháng theo các môn đang đăng ký. Tạo học phí và tạo thanh toán là hai bước riêng.</Alert>
    <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
      {[["Số khoản phí", fees.length], ["Tổng phải thu", money(totals.amount)], ["Đã thanh toán", totals.paid], ["Còn phải thu", totals.unpaid]].map(([label, value]) => <Paper key={String(label)} sx={{ p: 2, flex: 1 }}><Typography variant="body2" color="text.secondary">{label}</Typography><Typography variant="h6" fontWeight={700}>{value}</Typography></Paper>)}
    </Stack>
    <Paper sx={{ overflowX: "auto" }}>
      <Table sx={{ minWidth: 1000 }}>
        <TableHead><TableRow><TableCell>Học viên</TableCell><TableCell>Môn tính phí</TableCell><TableCell>Học phí gốc</TableCell><TableCell>Tổng phải thu</TableCell><TableCell>Trạng thái</TableCell><TableCell align="right">Thao tác</TableCell></TableRow></TableHead>
        <TableBody>{fees.map((fee) => <TableRow key={fee.id} hover><TableCell><Typography fontWeight={600}>{fee.student.fullName}</Typography><Typography variant="caption" color="text.secondary">{fee.student.code}</Typography></TableCell><TableCell>{fee.items.map((item) => item.itemName).join(", ") || "-"}</TableCell><TableCell>{money(Number(fee.originalAmount))}</TableCell><TableCell><strong>{money(Number(fee.finalAmount))}</strong></TableCell><TableCell><Chip size="small" color={statusColor[fee.status]} label={statusLabel[fee.status]} /></TableCell><TableCell align="right"><Button component={Link} href={`/admin/tuition-fees/${fee.id}`} size="small">Xem chi tiết</Button></TableCell></TableRow>)}{!fees.length && <TableRow><TableCell colSpan={6}><Typography sx={{ p: 4, textAlign: "center" }} color="text.secondary">Chưa có học phí cho kỳ {month}</Typography></TableCell></TableRow>}</TableBody>
      </Table>
    </Paper>
    {Snackbar}
  </Stack>;
}
