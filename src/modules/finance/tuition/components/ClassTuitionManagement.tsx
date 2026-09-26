"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  FormHelperText,
  InputLabel,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableSortLabel,
  TableRow,
  Typography,
} from "@mui/material";
import AddCardOutlinedIcon from "@mui/icons-material/AddCardOutlined";
import ArrowBackOutlinedIcon from "@mui/icons-material/ArrowBackOutlined";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import PictureAsPdfOutlinedIcon from "@mui/icons-material/PictureAsPdfOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import Link from "next/link";
import { ConfirmDialog } from "@/components/shared/dialogs/ConfirmDialog";
import { extractApiErrorMessage, unwrapApiResponse } from "@/lib/api-client";
import { useSnackbar } from "@/hooks/useSnackbar";
import { MonthPickerField } from "@/components/shared/forms/MonthPickerField";
import { AppTextField } from "@/components/shared/forms/AppTextField";
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
type FeeSortKey = "student" | "item" | "finalAmount" | "paidAmount" | "remainingAmount" | "status";

const currentMonth = () => {
  return getVietnamMonth();
};
const money = (value: number) => `${new Intl.NumberFormat("vi-VN").format(Number(value))} ₫`;
const statusLabel: Record<Fee["status"], string> = { UNPAID: "Chưa thu", PARTIAL: "Đã thu một phần", PAID: "Đã thu", OVERDUE: "Quá hạn", EXEMPTED: "Miễn phí", CANCELLED: "Đã hủy" };
const statusColor: Record<Fee["status"], "warning" | "success" | "error" | "info" | "default"> = { UNPAID: "warning", PARTIAL: "info", PAID: "success", OVERDUE: "error", EXEMPTED: "info", CANCELLED: "default" };
const classStatusLabel: Record<ClassData["status"], string> = { DRAFT: "Bản nháp", ACTIVE: "Đang hoạt động", COMPLETED: "Đã hoàn thành", CANCELLED: "Đã hủy" };
const classStatusColor: Record<ClassData["status"], "default" | "success" | "info" | "error"> = { DRAFT: "default", ACTIVE: "success", COMPLETED: "info", CANCELLED: "error" };
const feeStatusOrder: Record<Fee["status"], number> = {
  UNPAID: 1,
  PARTIAL: 2,
  OVERDUE: 3,
  PAID: 4,
  EXEMPTED: 5,
  CANCELLED: 6,
};

export function ClassTuitionManagement({ id }: { id: string }) {
  const [classData, setClassData] = useState<ClassData | null>(null);
  const [fees, setFees] = useState<Fee[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [sortKey, setSortKey] = useState<FeeSortKey>("student");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
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

  const filteredFees = useMemo(() => {
    const query = studentSearch.trim().toLocaleLowerCase("vi-VN");
    const filtered = query
      ? fees.filter((fee) => fee.student.fullName.toLocaleLowerCase("vi-VN").includes(query))
      : fees;
    return [...filtered].sort((left, right) => {
      let comparison = 0;
      if (sortKey === "student") {
        comparison = left.student.fullName.localeCompare(right.student.fullName, "vi", { sensitivity: "base" });
        if (comparison === 0) comparison = left.student.code.localeCompare(right.student.code, "vi", { sensitivity: "base" });
      } else if (sortKey === "item") {
        comparison = left.items.map((item) => item.itemName).join(", ").localeCompare(
          right.items.map((item) => item.itemName).join(", "),
          "vi",
          { sensitivity: "base" },
        );
      } else if (sortKey === "status") {
        comparison = feeStatusOrder[left.status] - feeStatusOrder[right.status];
      } else {
        comparison = Number(left[sortKey]) - Number(right[sortKey]);
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [fees, sortDirection, sortKey, studentSearch]);

  function handleSort(nextKey: FeeSortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => current === "asc" ? "desc" : "asc");
      return;
    }
    setSortKey(nextKey);
    setSortDirection("asc");
  }

  const totals = useMemo(() => ({
    amount: filteredFees
      .filter((fee) => fee.status !== "EXEMPTED" && fee.status !== "CANCELLED")
      .reduce((sum, fee) => sum + Number(fee.finalAmount), 0),
    paid: filteredFees.filter((fee) => fee.status === "PAID").length,
    unpaid: filteredFees.filter((fee) => fee.status === "UNPAID" || fee.status === "PARTIAL" || fee.status === "OVERDUE").length,
  }), [filteredFees]);

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

  if (!classData && loading) {
    return (
      <Stack alignItems="center" justifyContent="center" spacing={1.5} sx={{ minHeight: 360 }}>
        <CircularProgress size={30} />
        <Typography color="text.secondary">Đang tải thông tin học phí lớp...</Typography>
      </Stack>
    );
  }
  if (!classData) return <Alert severity="error">{error || "Không tìm thấy lớp học"}</Alert>;

  const metrics = [
    { label: `Số khoản phí kỳ ${month}`, value: fees.length },
    { label: "Tổng phải thu", value: money(totals.amount) },
    { label: "Số khoản đã thu", value: totals.paid },
    { label: "Số khoản còn phải thu", value: totals.unpaid },
  ];

  return <Stack spacing={{ xs: 2, md: 3 }}>
    <Box sx={{ px: { xs: 0, md: 0.5 } }}>
      <Button component={Link} href={`/admin/classes/${id}`} variant="text" size="small" startIcon={<ArrowBackOutlinedIcon />} sx={{ px: 0, mb: 1, color: "text.secondary" }}>
        Quay lại lớp {classData.code}
      </Button>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ md: "flex-end" }} gap={2}>
        <Stack direction="row" spacing={1.5} alignItems="flex-start">
          <Box sx={{ width: 48, height: 48, flexShrink: 0, borderRadius: 2.5, display: "grid", placeItems: "center", bgcolor: "primary.light", color: "primary.dark" }}>
            <AccountBalanceWalletOutlinedIcon />
          </Box>
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography variant="h4" fontWeight={800} letterSpacing="-0.02em">Học phí lớp học</Typography>
              <Chip size="small" color={classStatusColor[classData.status]} label={classStatusLabel[classData.status]} />
            </Stack>
            <Typography color="text.secondary" sx={{ mt: 0.5 }}>{classData.name} · {classData.code}</Typography>
          </Box>
        </Stack>
        <Chip icon={<CalendarMonthOutlinedIcon />} label={`Kỳ đang xem: ${month}`} color="primary" variant="outlined" sx={{ alignSelf: { xs: "flex-start", md: "center" }, fontWeight: 700 }} />
      </Stack>
    </Box>

    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 2 }}>
      <Paper sx={{ p: { xs: 2, md: 2.5 }, height: "100%" }}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1.25} alignItems="flex-start">
            <Box sx={{ width: 36, height: 36, borderRadius: 1.5, display: "grid", placeItems: "center", bgcolor: "#eff6ff", color: "primary.main", flexShrink: 0 }}>
              <CalendarMonthOutlinedIcon fontSize="small" />
            </Box>
            <Box>
              <Typography variant="subtitle1" fontWeight={800}>Kỳ học phí</Typography>
              <Typography variant="body2" color="text.secondary">Chọn kỳ cần xem hoặc tạo phí còn thiếu.</Typography>
            </Box>
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
            <MonthPickerField label="Kỳ học phí" value={month} onChange={setMonth} textFieldProps={{ size: "small" }} />
            <Button variant="outlined" startIcon={<RefreshOutlinedIcon />} onClick={() => void load()} disabled={loading} sx={{ whiteSpace: "nowrap" }}>Làm mới</Button>
          </Stack>
        </Stack>
      </Paper>
      <Paper sx={{ p: { xs: 2, md: 2.5 }, height: "100%" }}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1.25} alignItems="flex-start">
            <Box sx={{ width: 36, height: 36, borderRadius: 1.5, display: "grid", placeItems: "center", bgcolor: "#f0fdf4", color: "success.main", flexShrink: 0 }}>
              <AddCardOutlinedIcon fontSize="small" />
            </Box>
            <Box>
              <Typography variant="subtitle1" fontWeight={800}>Thao tác thu học phí</Typography>
              <Typography variant="body2" color="text.secondary">Tạo phí trước, sau đó ghi nhận tiền mặt hoặc chuyển khoản.</Typography>
            </Box>
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Button variant="contained" startIcon={<AddCardOutlinedIcon />} onClick={() => void createFees()} disabled={busy || Boolean(classClosed)} sx={{ flex: 1 }}>
              Tạo học phí tháng
            </Button>
            <Button variant="outlined" color="primary" startIcon={<PictureAsPdfOutlinedIcon />} onClick={() => void openNoticeDialog()} disabled={busy || Boolean(classClosed)} sx={{ flex: 1 }}>
              Thông báo chuyển khoản
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Box>

    {classClosed && <Alert severity="info" icon={<InfoOutlinedIcon />}>Lớp đã hoàn thành hoặc đã hủy; học phí chỉ được xem, không thể tạo mới.</Alert>}
    {error && <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => void load()}>Thử lại</Button>}>{error}</Alert>}
    <Alert severity="info" icon={<InfoOutlinedIcon />} sx={{ alignItems: "flex-start" }}>
      Học phí tính trọn tháng theo môn đang đăng ký. Dùng <strong>Thu học phí</strong> để ghi nhận thanh toán từng khoản; dùng thông báo chuyển khoản cho cả lớp.
    </Alert>

    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", lg: "repeat(4, 1fr)" }, gap: 1.5 }}>
      <MetricCard icon={<GroupsOutlinedIcon />} label={`Khoản phí kỳ ${month}`} value={metrics[0]?.value ?? 0} tone="blue" />
      <MetricCard icon={<AccountBalanceWalletOutlinedIcon />} label="Tổng phải thu" value={metrics[1]?.value ?? money(0)} tone="violet" />
      <MetricCard icon={<CheckCircleOutlineOutlinedIcon />} label="Đã thu" value={metrics[2]?.value ?? 0} tone="green" />
      <MetricCard icon={<PaymentsOutlinedIcon />} label="Còn phải thu" value={metrics[3]?.value ?? 0} tone="orange" />
    </Box>

    <Paper sx={{ overflow: "hidden" }}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ md: "center" }} gap={1.5} sx={{ p: { xs: 2, md: 2.5 }, borderBottom: "1px solid", borderColor: "divider" }}>
        <Box>
          <Typography variant="h6" fontWeight={800}>Danh sách khoản phí</Typography>
          <Typography variant="body2" color="text.secondary">Theo dõi số tiền và trạng thái thu của từng học viên trong kỳ.</Typography>
        </Box>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
          <AppTextField
            size="small"
            placeholder="Tìm theo tên học viên..."
            value={studentSearch}
            onChange={(event) => setStudentSearch(event.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchOutlinedIcon fontSize="small" color="action" />
                </InputAdornment>
              ),
            }}
            sx={{
              width: { xs: "100%", sm: 270 },
              "& .MuiOutlinedInput-root": { borderRadius: 2 },
            }}
          />
          <Chip size="small" variant="outlined" label={`${filteredFees.length} khoản phí`} sx={{ alignSelf: { xs: "flex-start", sm: "center" } }} />
        </Stack>
      </Stack>
      {loading && <LinearProgress />}
      <Box sx={{ overflowX: "auto" }}>
        <Table sx={{ minWidth: 900 }}>
          <TableHead><TableRow>
            <SortableHeader label="Học viên" sortKey="student" activeKey={sortKey} direction={sortDirection} onSort={handleSort} />
            <SortableHeader label="Môn tính phí" sortKey="item" activeKey={sortKey} direction={sortDirection} onSort={handleSort} />
            <SortableHeader label="Tổng phải thu" sortKey="finalAmount" activeKey={sortKey} direction={sortDirection} onSort={handleSort} align="right" />
            <SortableHeader label="Đã thu" sortKey="paidAmount" activeKey={sortKey} direction={sortDirection} onSort={handleSort} align="right" />
            <SortableHeader label="Còn nợ" sortKey="remainingAmount" activeKey={sortKey} direction={sortDirection} onSort={handleSort} align="right" />
            <SortableHeader label="Trạng thái" sortKey="status" activeKey={sortKey} direction={sortDirection} onSort={handleSort} />
            <TableCell align="right">Thao tác</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {filteredFees.map((fee) => {
              const pendingBatch = fee.paymentAllocations?.[0]?.paymentBatch;
              const feeStatus = pendingBatch ? "Đang chờ đối soát" : statusLabel[fee.status];
              const feeColor = pendingBatch ? "warning" : statusColor[fee.status];
              const canPay = !pendingBatch && (fee.status === "UNPAID" || fee.status === "PARTIAL" || fee.status === "OVERDUE");
              return (
                <TableRow key={fee.id} hover>
                  <TableCell sx={{ minWidth: 180 }}><Typography fontWeight={700}>{fee.student.fullName}</Typography><Typography variant="caption" color="text.secondary">{fee.student.code}</Typography></TableCell>
                  <TableCell sx={{ minWidth: 200 }}><Typography variant="body2" sx={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fee.items.map((item) => item.itemName).join(", ") || "-"}</Typography></TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap", minWidth: 150 }}><Typography fontWeight={800}>{money(Number(fee.finalAmount))}</Typography></TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap", minWidth: 135 }}>{money(Number(fee.paidAmount))}</TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap", minWidth: 135 }}><Typography fontWeight={800} color={Number(fee.remainingAmount) > 0 ? "error.main" : "success.main"}>{money(Number(fee.remainingAmount))}</Typography></TableCell>
                  <TableCell><Stack spacing={0.5} alignItems="flex-start"><Chip size="small" color={feeColor} label={feeStatus} />{pendingBatch && <Typography variant="caption" color="text.secondary">{pendingBatch.batchNo}</Typography>}</Stack></TableCell>
                  <TableCell align="right"><Stack direction={{ xs: "column", sm: "row" }} spacing={0.75} justifyContent="flex-end">
                    {pendingBatch && <><Button component={Link} href={`/admin/tuition-fees/payment-history/${pendingBatch.id}`} size="small" variant="contained" color="warning" sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>Xử lý đợt thu</Button><Button component="a" href={`/api/payment-batches/${pendingBatch.id}/notice/pdf`} size="small" variant="outlined" sx={{ whiteSpace: "nowrap" }}>Xuất thông báo tổng</Button></>}
                    {canPay && <Button component={Link} href={`/admin/tuition-fees/payment?tuitionFeeId=${fee.id}`} size="small" variant="contained" startIcon={<PaymentsOutlinedIcon />} sx={{ whiteSpace: "nowrap" }}>{fee.status === "PARTIAL" ? "Thu phần còn lại" : "Thu học phí"}</Button>}
                    <Button component={Link} href={`/admin/tuition-fees/${fee.id}`} size="small" variant="outlined" startIcon={<VisibilityOutlinedIcon />} sx={{ whiteSpace: "nowrap" }}>Chi tiết</Button>
                  </Stack></TableCell>
                </TableRow>
              );
            })}
            {!loading && !filteredFees.length && <TableRow><TableCell colSpan={7}><Stack alignItems="center" spacing={1} sx={{ py: 6, color: "text.secondary" }}><PaymentsOutlinedIcon sx={{ fontSize: 38, color: "text.disabled" }} /><Typography fontWeight={700}>{studentSearch.trim() ? "Không tìm thấy học viên phù hợp" : `Chưa có học phí cho kỳ ${month}`}</Typography><Typography variant="body2">{studentSearch.trim() ? "Thử tìm bằng tên khác hoặc xóa nội dung tìm kiếm." : "Chọn “Tạo học phí tháng” để phát sinh các khoản phí còn thiếu."}</Typography></Stack></TableCell></TableRow>}
          </TableBody>
        </Table>
      </Box>
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

function SortableHeader({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
  align = "left",
}: {
  label: string;
  sortKey: FeeSortKey;
  activeKey: FeeSortKey;
  direction: "asc" | "desc";
  onSort: (key: FeeSortKey) => void;
  align?: "left" | "right";
}) {
  return (
    <TableCell align={align}>
      <TableSortLabel
        active={activeKey === sortKey}
        direction={activeKey === sortKey ? direction : "asc"}
        onClick={() => onSort(sortKey)}
      >
        {label}
      </TableSortLabel>
    </TableCell>
  );
}

type MetricTone = "blue" | "violet" | "green" | "orange";

type MetricCardProps = {
  icon: ReactNode;
  label: string;
  value: string | number;
  tone: MetricTone;
};

function MetricCard({ icon, label, value, tone }: MetricCardProps) {
  const toneStyles: Record<MetricTone, { background: string; color: string }> = {
    blue: { background: "#eff6ff", color: "#2563eb" },
    violet: { background: "#f5f3ff", color: "#7c3aed" },
    green: { background: "#f0fdf4", color: "#16a34a" },
    orange: { background: "#fff7ed", color: "#ea580c" },
  };
  const style = toneStyles[tone];

  return (
    <Paper sx={{ p: { xs: 1.75, md: 2 }, minWidth: 0 }}>
      <Stack direction="row" spacing={1.25} alignItems="flex-start">
        <Box sx={{ width: 36, height: 36, flexShrink: 0, borderRadius: 1.5, display: "grid", placeItems: "center", bgcolor: style.background, color: style.color }}>
          {icon}
        </Box>
        <Box minWidth={0}>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", lineHeight: 1.35 }}>{label}</Typography>
          <Typography variant="h6" fontWeight={800} noWrap sx={{ mt: 0.5 }}>{value}</Typography>
        </Box>
      </Stack>
    </Paper>
  );
}
