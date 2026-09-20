"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  FormControl,
  FormHelperText,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
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
import { ConfirmDialog } from "@/components/shared/dialogs/ConfirmDialog";
import { extractApiErrorMessage, unwrapApiResponse } from "@/lib/api-client";
import { useSnackbar } from "@/hooks/useSnackbar";
import { MonthPickerField } from "@/components/shared/forms/MonthPickerField";
import { getVietnamMonth } from "@/lib/vietnam-time";

type ClassData = {
  id: string;
  code: string;
  name: string;
  status: "DRAFT" | "ACTIVE" | "COMPLETED" | "CANCELLED";
};
type BankAccount = {
  id: string;
  bankName: string;
  accountNo: string;
  accountName: string;
};
type Fee = {
  id: string;
  feeNo: string;
  originalAmount: number;
  finalAmount: number;
  status: "UNPAID" | "PARTIAL" | "PAID" | "OVERDUE" | "EXEMPTED" | "CANCELLED";
  paidAmount: number;
  remainingAmount: number;
  billingYear: number;
  billingMonth: number;
  student: { code: string; fullName: string };
  items: Array<{ itemName: string; amount: number }>;
  paymentAllocations?: Array<{
    paymentBatch: { id: string; batchNo: string; status: string };
  }>;
};

const currentMonth = () => {
  return getVietnamMonth();
};
const money = (value: number) => `${new Intl.NumberFormat("vi-VN").format(Number(value))} VND`;
const statusLabel: Record<Fee["status"], string> = { UNPAID: "Chưa thu", PARTIAL: "Đã thu một phần", PAID: "Đã thu", OVERDUE: "Quá hạn", EXEMPTED: "Miễn phí", CANCELLED: "Đã hủy" };
const statusColor: Record<Fee["status"], "warning" | "success" | "error" | "info" | "default"> = { UNPAID: "warning", PARTIAL: "info", PAID: "success", OVERDUE: "error", EXEMPTED: "info", CANCELLED: "default" };
const classStatusLabel: Record<ClassData["status"], string> = { DRAFT: "Bản nháp", ACTIVE: "Đang hoạt động", COMPLETED: "Đã hoàn thành", CANCELLED: "Đã hủy" };
const classStatusColor: Record<ClassData["status"], "default" | "success" | "info" | "error"> = { DRAFT: "default", ACTIVE: "success", COMPLETED: "info", CANCELLED: "error" };

export function ClassTuitionManagement({ id }: { id: string }) {
  const [classData, setClassData] = useState<ClassData | null>(null);
  const [fees, setFees] = useState<Fee[]>([]);
  const [month, setMonth] = useState(currentMonth);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [noticeConfirmOpen, setNoticeConfirmOpen] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [bankAccountId, setBankAccountId] = useState("");
  const [bankAccountsLoading, setBankAccountsLoading] = useState(false);
  const [bankAccountsError, setBankAccountsError] = useState("");
  const [error, setError] = useState("");
  const { showSuccess, showError, Snackbar } = useSnackbar();
  const classClosed = classData?.status === "COMPLETED" || classData?.status === "CANCELLED";

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
    unpaid: fees.filter((fee) => fee.status === "UNPAID" || fee.status === "PARTIAL" || fee.status === "OVERDUE").length,
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
    if (!bankAccountId) {
      setBankAccountsError("Hãy chọn tài khoản nhận tiền");
      return;
    }
    setNoticeConfirmOpen(false);
    setBusy(true);
    try {
      const response = await fetch(`/api/classes/${id}/tuition-notice/pdf?month=${encodeURIComponent(month)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bankAccountId }),
      });
      if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không thể tạo thông báo chuyển khoản"));
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `thong-bao-hoc-phi-${classData?.code ?? "lop"}-${month}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
      await load();
      showSuccess("Đã tạo đợt chuyển khoản và xuất thông báo");
    } catch (reason) {
      showError(reason instanceof Error ? reason.message : "Không thể tạo thông báo chuyển khoản");
    } finally {
      setBusy(false);
    }
  }

  async function openNoticeDialog() {
    setNoticeConfirmOpen(true);
    setBankAccountsLoading(true);
    setBankAccountsError("");
    try {
      const response = await fetch("/api/bank-accounts");
      if (!response.ok)
        throw new Error(await extractApiErrorMessage(response, "Không thể tải tài khoản ngân hàng"));
      const accounts = await unwrapApiResponse<BankAccount[]>(response);
      setBankAccounts(accounts);
      setBankAccountId((current) =>
        accounts.some((account) => account.id === current)
          ? current
          : accounts[0]?.id || "",
      );
      if (!accounts.length) setBankAccountsError("Chưa cấu hình tài khoản nhận tiền");
    } catch (reason) {
      setBankAccounts([]);
      setBankAccountId("");
      setBankAccountsError(reason instanceof Error ? reason.message : "Không thể tải tài khoản ngân hàng");
    } finally {
      setBankAccountsLoading(false);
    }
  }

  if (!classData && loading) return <Typography>Đang tải học phí lớp...</Typography>;
  if (!classData) return <Alert severity="error">{error || "Không tìm thấy lớp học"}</Alert>;

  const metrics = [
    { label: `Số khoản phí kỳ ${month}`, value: fees.length },
    { label: "Tổng phải thu", value: money(totals.amount) },
    { label: "Số khoản đã thu", value: totals.paid },
    { label: "Số khoản còn phải thu", value: totals.unpaid },
  ];

  return <Stack spacing={{ xs: 2, md: 3 }}>
    <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={1}>
      <Stack direction="row" spacing={1.5} alignItems="center"><Box sx={{ width: 44, height: 44, borderRadius: 2, display: "grid", placeItems: "center", bgcolor: "primary.main", color: "primary.contrastText" }}><AccountBalanceWalletOutlinedIcon /></Box><Box><Button component={Link} href={`/admin/classes/${id}`} variant="text" size="small" sx={{ alignSelf: "flex-start", px: 0 }}>← {classData.code}</Button><Stack direction="row" spacing={1} alignItems="center"><Typography variant="h5" fontWeight={700}>Học phí lớp học</Typography><Chip size="small" color={classStatusColor[classData.status]} label={classStatusLabel[classData.status]} /></Stack><Typography color="text.secondary">{classData.name}</Typography></Box></Stack>
    </Stack>
    <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
      <Stack spacing={2}>
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ md: "center" }} gap={2}>
          <Box><Typography variant="subtitle1" fontWeight={700}>Thiết lập kỳ học phí</Typography><Typography variant="body2" color="text.secondary">Chọn kỳ cần xem hoặc tạo học phí.</Typography></Box>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}><MonthPickerField label="Kỳ học phí" value={month} onChange={setMonth} textFieldProps={{ size: "small" }} /><Button variant="outlined" startIcon={<RefreshOutlinedIcon />} onClick={() => void load()} disabled={loading}>Làm mới</Button></Stack>
        </Stack>
        <Divider />
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ md: "center" }} gap={2}>
          <Box><Typography variant="subtitle1" fontWeight={700}>Tạo học phí</Typography><Typography variant="body2" color="text.secondary">Tạo các khoản phí còn thiếu cho kỳ đã chọn. Phương thức thanh toán sẽ được chọn khi thu tiền.</Typography></Box>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}><Button variant="contained" onClick={() => void createFees()} disabled={busy || Boolean(classClosed)}>Tạo học phí tháng</Button><Button variant="outlined" onClick={() => void openNoticeDialog()} disabled={busy || Boolean(classClosed)}>Tạo thông báo chuyển khoản</Button></Stack>
        </Stack>
      </Stack>
    </Paper>
    {classClosed && <Alert severity="info">Lớp đã hoàn thành hoặc đã hủy; học phí chỉ được xem, không thể tạo mới.</Alert>}
    {error && <Alert severity="error">{error}</Alert>}
    <Alert severity="info">Học phí được tính trọn tháng theo các môn đang đăng ký. Sau khi tạo khoản phí, hãy chọn “Thu học phí” để ghi nhận tiền mặt hoặc tạo giao dịch chuyển khoản. Chỉ chọn “Tạo thông báo chuyển khoản” khi muốn lập đợt chuyển khoản cho cả lớp.</Alert>
    <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
      {metrics.map((metric) => <Paper key={metric.label} elevation={0} sx={{ p: 2, flex: 1, border: "1px solid", borderColor: "divider", borderRadius: 2 }}><Typography variant="body2" color="text.secondary">{metric.label}</Typography><Typography variant="h6" fontWeight={700}>{metric.value}</Typography></Paper>)}
    </Stack>
    <Paper elevation={0} sx={{ overflowX: "auto", border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
      <Box sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider" }}>
        <Typography variant="h6" fontWeight={700}>Danh sách khoản phí</Typography>
        <Typography variant="body2" color="text.secondary">Kỳ {month} · {fees.length} khoản phí</Typography>
      </Box>
      {loading && <LinearProgress />}
      <Table sx={{ minWidth: 1000 }}>
      <TableHead><TableRow><TableCell>Học viên</TableCell><TableCell>Môn tính phí</TableCell><TableCell>Học phí gốc</TableCell><TableCell>Tổng phải thu</TableCell><TableCell>Đã thu</TableCell><TableCell>Còn nợ</TableCell><TableCell>Trạng thái</TableCell><TableCell align="right">Thao tác</TableCell></TableRow></TableHead>
    <TableBody>{fees.map((fee) => { const pendingBatch = fee.paymentAllocations?.[0]?.paymentBatch; const feeStatus = pendingBatch ? "Đang chờ đối soát" : statusLabel[fee.status]; const feeColor = pendingBatch ? "warning" : statusColor[fee.status]; const canPay = !pendingBatch && (fee.status === "UNPAID" || fee.status === "PARTIAL" || fee.status === "OVERDUE"); return <TableRow key={fee.id} hover><TableCell><Typography fontWeight={600}>{fee.student.fullName}</Typography><Typography variant="caption" color="text.secondary">{fee.student.code}</Typography></TableCell><TableCell>{fee.items.map((item) => item.itemName).join(", ") || "-"}</TableCell><TableCell>{money(Number(fee.originalAmount))}</TableCell><TableCell><strong>{money(Number(fee.finalAmount))}</strong></TableCell><TableCell>{money(Number(fee.paidAmount))}</TableCell><TableCell><strong>{money(Number(fee.remainingAmount))}</strong></TableCell><TableCell><Stack spacing={0.5} alignItems="flex-start"><Chip size="small" color={feeColor} label={feeStatus} />{pendingBatch && <Typography variant="caption" color="text.secondary">{pendingBatch.batchNo}</Typography>}</Stack></TableCell><TableCell align="right"><Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="flex-end">{pendingBatch && <Button component={Link} href={`/admin/tuition-fees/payment-history/${pendingBatch.id}`} size="small" variant="contained" color="warning" sx={{ fontWeight: 700, boxShadow: 2, whiteSpace: "nowrap" }}>Xử lý đợt thu</Button>}{canPay && <Button component={Link} href={`/admin/tuition-fees/payment?tuitionFeeId=${fee.id}`} size="small" variant="contained">{fee.status === "PARTIAL" ? "Thu phần còn lại" : "Thu học phí"}</Button>}<Button component={Link} href={`/admin/tuition-fees/${fee.id}`} size="small" variant="outlined">Xem chi tiết</Button></Stack></TableCell></TableRow>; })}{!fees.length && <TableRow><TableCell colSpan={8}><Typography sx={{ p: 4, textAlign: "center" }} color="text.secondary">Chưa có học phí cho kỳ {month}</Typography></TableCell></TableRow>}</TableBody>
      </Table>
    </Paper>
    <ConfirmDialog
      open={noticeConfirmOpen}
      title="Tạo thông báo chuyển khoản"
      message={`Hệ thống sẽ gom các khoản chưa thu của kỳ ${month} theo từng học viên, tạo đợt chuyển khoản đang chờ đối soát và xuất PDF thông báo. Nếu học viên nộp tiền mặt, hãy dùng “Thu học phí” thay vì thao tác này.`}
      content={<Stack spacing={1.5} sx={{ mt: 2 }}><FormControl fullWidth required error={Boolean(bankAccountsError)}><InputLabel id="class-bank-account-label">Tài khoản nhận tiền</InputLabel><Select labelId="class-bank-account-label" label="Tài khoản nhận tiền" value={bankAccountId} onChange={(event) => { setBankAccountId(event.target.value); setBankAccountsError(""); }} disabled={bankAccountsLoading || !bankAccounts.length}><MenuItem value="">{bankAccountsLoading ? "Đang tải tài khoản..." : "Chọn tài khoản nhận tiền"}</MenuItem>{bankAccounts.map((account) => <MenuItem key={account.id} value={account.id}>{account.bankName} — {account.accountNo} — {account.accountName}</MenuItem>)}</Select><FormHelperText>{bankAccountsError || (fees.some((fee) => fee.paymentAllocations?.length) ? "Các đợt đang chờ sẽ giữ tài khoản đã lưu; tài khoản này chỉ áp dụng cho đợt mới." : "Tài khoản này sẽ được gắn vào các đợt chuyển khoản mới của lớp")}</FormHelperText></FormControl></Stack>}
      confirmLabel="Tạo thông báo"
      cancelLabel="Quay lại"
      onConfirm={() => void createPaymentNotice()}
      onCancel={() => setNoticeConfirmOpen(false)}
      isLoading={busy || bankAccountsLoading}
      confirmDisabled={!bankAccountId || Boolean(bankAccountsError)}
    />
    {Snackbar}
  </Stack>;
}
