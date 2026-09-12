"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
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
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import Link from "next/link";
import { extractApiErrorMessage, unwrapApiResponse } from "@/lib/api-client";
import { useSnackbar } from "@/hooks/useSnackbar";
import { MonthPickerField } from "@/components/shared/forms/MonthPickerField";

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
  paymentAllocations?: Array<{
    paymentBatch: { batchNo: string; status: string };
  }>;
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
        fetch(`/api/tuition-fees?classId=${id}&month=${encodeURIComponent(month)}&billingType=MONTHLY&page=1&pageSize=100`),
      ]);
      if (!classResponse.ok) throw new Error(await extractApiErrorMessage(classResponse, "Không thể tải lớp học"));
      if (!feeResponse.ok) throw new Error(await extractApiErrorMessage(feeResponse, "Không thể tải học phí"));
      const [classResult, feeResult] = await Promise.all([
        unwrapApiResponse<ClassData>(classResponse),
        unwrapApiResponse<{ items: Fee[]; pagination?: { totalPages: number } }>(feeResponse),
      ]);
      const totalPages = feeResult.pagination?.totalPages ?? 1;
      const remainingPages = await Promise.all(
        Array.from({ length: Math.max(totalPages - 1, 0) }, (_, index) =>
          fetch(`/api/tuition-fees?classId=${id}&month=${encodeURIComponent(month)}&billingType=MONTHLY&page=${index + 2}&pageSize=100`).then(async (response) => {
            if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không thể tải đầy đủ học phí"));
            return unwrapApiResponse<{ items: Fee[] }>(response);
          }),
        ),
      );
      setClassData(classResult);
      setFees([feeResult.items, ...remainingPages.map((page) => page.items)].flat());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể tải dữ liệu");
    } finally {
      setLoading(false);
    }
  }, [id, month]);

  useEffect(() => { void load(); }, [load]);

  const totals = useMemo(() => ({
    amount: fees
      .filter((fee) => fee.status !== "EXEMPTED" && fee.status !== "CANCELLED")
      .reduce((sum, fee) => sum + Number(fee.finalAmount), 0),
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
      showSuccess("Đã tạo đợt thu và xuất thông báo");
    } catch (reason) {
      showError(reason instanceof Error ? reason.message : "Không thể tạo đợt thu và thông báo");
    } finally {
      setBusy(false);
    }
  }

  if (!classData && loading) return <Typography>Đang tải học phí lớp...</Typography>;
  if (!classData) return <Alert severity="error">{error || "Không tìm thấy lớp học"}</Alert>;

  const metrics = [
    { label: `Số khoản phí kỳ ${month}`, value: fees.length },
    { label: "Tổng phải thu", value: money(totals.amount) },
    { label: "Đã thu", value: totals.paid },
    { label: "Còn phải thu", value: totals.unpaid },
  ];

  return <Stack spacing={{ xs: 2, md: 3 }}>
    <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={1}>
      <Stack direction="row" spacing={1.5} alignItems="center"><Box sx={{ width: 44, height: 44, borderRadius: 2, display: "grid", placeItems: "center", bgcolor: "primary.main", color: "primary.contrastText" }}><AccountBalanceWalletOutlinedIcon /></Box><Box><Button component={Link} href={`/admin/classes/${id}`} variant="text" size="small" sx={{ alignSelf: "flex-start", px: 0 }}>← {classData.code}</Button><Typography variant="h5" fontWeight={700}>Học phí lớp học</Typography><Typography color="text.secondary">{classData.name}</Typography></Box></Stack>
    </Stack>
    <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
      <Stack spacing={2}>
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ md: "center" }} gap={2}>
          <Box><Typography variant="subtitle1" fontWeight={700}>Thiết lập kỳ học phí</Typography><Typography variant="body2" color="text.secondary">Chọn kỳ cần xem hoặc tạo học phí.</Typography></Box>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}><MonthPickerField label="Kỳ học phí" value={month} onChange={setMonth} textFieldProps={{ size: "small" }} /><Button variant="outlined" startIcon={<RefreshOutlinedIcon />} onClick={() => void load()} disabled={loading}>Làm mới</Button></Stack>
        </Stack>
        <Divider />
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ md: "center" }} gap={2}>
          <Box><Typography variant="subtitle1" fontWeight={700}>Tạo học phí và thông báo</Typography><Typography variant="body2" color="text.secondary">Bước 1 tạo khoản phí còn thiếu. Bước 2 tạo đợt thu và xuất thông báo cho học viên.</Typography></Box>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}><Button variant="outlined" onClick={() => void createFees()} disabled={busy}>1. Tạo khoản phí</Button><Button variant="contained" onClick={() => void createPaymentNotice()} disabled={busy}>2. Tạo đợt thu & thông báo</Button></Stack>
        </Stack>
      </Stack>
    </Paper>
    {error && <Alert severity="error">{error}</Alert>}
    <Alert severity="info">Học phí được tính trọn tháng theo các môn đang đăng ký. Bước 2 sẽ tự tạo các khoản phí còn thiếu, gom theo học viên thành đợt chuyển khoản và xuất thông báo.</Alert>
    <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
      {metrics.map((metric) => <Paper key={metric.label} elevation={0} sx={{ p: 2, flex: 1, border: "1px solid", borderColor: "divider", borderRadius: 2 }}><Typography variant="body2" color="text.secondary">{metric.label}</Typography><Typography variant="h6" fontWeight={700}>{metric.value}</Typography></Paper>)}
    </Stack>
    <Paper elevation={0} sx={{ overflowX: "auto", border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
      <Box sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider" }}>
        <Typography variant="h6" fontWeight={700}>Danh sách khoản phí</Typography>
        <Typography variant="body2" color="text.secondary">Kỳ {month} · {fees.length} khoản phí</Typography>
      </Box>
      <Table sx={{ minWidth: 1000 }}>
        <TableHead><TableRow><TableCell>Học viên</TableCell><TableCell>Môn tính phí</TableCell><TableCell>Học phí gốc</TableCell><TableCell>Tổng phải thu</TableCell><TableCell>Trạng thái</TableCell><TableCell align="right">Thao tác</TableCell></TableRow></TableHead>
        <TableBody>{fees.map((fee) => { const pendingBatch = fee.paymentAllocations?.[0]?.paymentBatch; const feeStatus = pendingBatch ? "Đang chờ đối soát" : statusLabel[fee.status]; const feeColor = pendingBatch ? "warning" : statusColor[fee.status]; return <TableRow key={fee.id} hover><TableCell><Typography fontWeight={600}>{fee.student.fullName}</Typography><Typography variant="caption" color="text.secondary">{fee.student.code}</Typography></TableCell><TableCell>{fee.items.map((item) => item.itemName).join(", ") || "-"}</TableCell><TableCell>{money(Number(fee.originalAmount))}</TableCell><TableCell><strong>{money(Number(fee.finalAmount))}</strong></TableCell><TableCell><Stack spacing={0.5} alignItems="flex-start"><Chip size="small" color={feeColor} label={feeStatus} />{pendingBatch && <Typography variant="caption" color="text.secondary">{pendingBatch.batchNo}</Typography>}</Stack></TableCell><TableCell align="right"><Button component={Link} href={`/admin/tuition-fees/${fee.id}`} size="small" variant="outlined">Xem chi tiết</Button></TableCell></TableRow>; })}{!fees.length && <TableRow><TableCell colSpan={6}><Typography sx={{ p: 4, textAlign: "center" }} color="text.secondary">Chưa có học phí cho kỳ {month}</Typography></TableCell></TableRow>}</TableBody>
      </Table>
    </Paper>
    {Snackbar}
  </Stack>;
}
