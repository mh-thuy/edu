"use client";

import { Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Collapse,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  Typography,
} from "@mui/material";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import CallSplitOutlinedIcon from "@mui/icons-material/CallSplitOutlined";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import ExpandMoreOutlinedIcon from "@mui/icons-material/ExpandMoreOutlined";
import HourglassTopOutlinedIcon from "@mui/icons-material/HourglassTopOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import MergeTypeOutlinedIcon from "@mui/icons-material/MergeTypeOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import TaskAltOutlinedIcon from "@mui/icons-material/TaskAltOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import Link from "next/link";
import { ClassSelectDialog, type ClassItem } from "@/components/shared/dialogs/ClassSelectDialog";
import { StudentSelectDialog, type StudentItem } from "@/components/shared/dialogs/StudentSelectDialog";
import { AppTextField } from "@/components/shared/forms/AppTextField";
import { MasterSelectField, type MasterSelectValue } from "@/components/shared/forms/MasterSelectField";
import { ConfirmDialog } from "@/components/shared/dialogs/ConfirmDialog";
import { MonthPickerField } from "@/components/shared/forms/MonthPickerField";
import { useDisclosure } from "@/hooks/useDisclosure";
import { useSnackbar } from "@/hooks/useSnackbar";
import { getVietnamMonth } from "@/lib/vietnam-time";
import {
  fetchNoticeBankAccounts,
  fetchOutstandingFees,
  fetchPendingBatches,
  fetchSuccessfulBatches,
  issueNoticeBatches,
  restructurePendingBatches,
  type NoticeBankAccount,
  type NoticeFee,
  type PendingBatch,
} from "@/modules/finance/payments/services/payment-batch-management.client";

type View = "UNISSUED" | "PENDING" | "SUCCESS";
type NoticeMode = "GROUPED" | "SEPARATE";
type RestructureMode = "SPLIT" | "MERGE";
type IssuedBatch = { id: string; batchNo: string; totalAmount: number };

const money = (value: number) =>
  `${new Intl.NumberFormat("vi-VN").format(Number(value))} ₫`;

const feeStatusLabels: Record<NoticeFee["status"], string> = {
  UNPAID: "Chưa thu",
  PARTIAL: "Đã thu một phần",
  OVERDUE: "Quá hạn",
};

const feeStatusColors: Record<
  NoticeFee["status"],
  "warning" | "info" | "error"
> = {
  UNPAID: "warning",
  PARTIAL: "info",
  OVERDUE: "error",
};

function sameStudent<T extends { student: { id: string } }>(items: T[]) {
  return new Set(items.map((item) => item.student.id)).size <= 1;
}

function groupByStudent<T extends { student: { id: string; code: string; fullName: string } }>(items: T[]) {
  const groups = new Map<string, { student: T["student"]; items: T[] }>();
  for (const item of items) {
    const existing = groups.get(item.student.id);
    if (existing) {
      existing.items.push(item);
    } else {
      groups.set(item.student.id, { student: item.student, items: [item] });
    }
  }
  return [...groups.values()];
}

export function PaymentBatchManagement() {
  const [view, setView] = useState<View>("UNISSUED");
  const [month, setMonth] = useState(getVietnamMonth());
  const [search, setSearch] = useState("");
  const [student, setStudent] = useState<MasterSelectValue | null>(null);
  const [selectedClass, setSelectedClass] = useState<MasterSelectValue | null>(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [fees, setFees] = useState<NoticeFee[]>([]);
  const [pendingBatches, setPendingBatches] = useState<PendingBatch[]>([]);
  const [successfulBatches, setSuccessfulBatches] = useState<PendingBatch[]>([]);
  const [bankAccounts, setBankAccounts] = useState<NoticeBankAccount[]>([]);
  const [selectedFeeIds, setSelectedFeeIds] = useState<string[]>([]);
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
  const [noticeMode, setNoticeMode] = useState<NoticeMode | null>(null);
  const [bankAccountId, setBankAccountId] = useState("");
  const [restructureMode, setRestructureMode] = useState<RestructureMode | null>(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [issuedBatches, setIssuedBatches] = useState<IssuedBatch[]>([]);
  const { showSuccess, showError, Snackbar } = useSnackbar();
  const studentDialog = useDisclosure();
  const classDialog = useDisclosure();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [feeItems, batchItems, paidBatchItems, accounts] = await Promise.all([
        fetchOutstandingFees(month),
        fetchPendingBatches(),
        fetchSuccessfulBatches(),
        fetchNoticeBankAccounts(),
      ]);
      setFees(feeItems);
      setPendingBatches(batchItems);
      setSuccessfulBatches(paidBatchItems);
      setBankAccounts(accounts);
      setBankAccountId((current) =>
        accounts.some((account) => account.id === current)
          ? current
          : accounts[0]?.id ?? "",
      );
      setSelectedFeeIds([]);
      setSelectedBatchIds([]);
    } catch (reasonValue) {
      setError(reasonValue instanceof Error ? reasonValue.message : "Không thể tải dữ liệu");
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    void load();
  }, [load]);

  const query = search.trim().toLocaleLowerCase("vi-VN");
  const studentFilter = student?.id ?? "ALL";
  const classFilter = selectedClass?.name ?? "ALL";
  const unissuedFees = useMemo(
    () => fees.filter((fee) => {
      const hasPendingBatch = Boolean(fee.paymentAllocations?.length);
      const matchesStudent = studentFilter === "ALL" || fee.student.id === studentFilter;
      const matchesClass = classFilter === "ALL" || fee.class.name === classFilter;
      const matchesSearch = !query || [fee.feeNo, fee.student.code, fee.student.fullName, fee.class.name]
        .join(" ")
        .toLocaleLowerCase("vi-VN")
        .includes(query);
      return !hasPendingBatch && matchesStudent && matchesClass && matchesSearch;
    }),
    [classFilter, fees, query, studentFilter],
  );

  const visiblePendingBatches = useMemo(
    () => pendingBatches.filter((batch) => {
      const hasMonth = batch.allocations.some(
        (allocation) => `${allocation.tuitionFee.billingYear}-${String(allocation.tuitionFee.billingMonth).padStart(2, "0")}` === month,
      );
      const matchesStudent = studentFilter === "ALL" || batch.student.id === studentFilter;
      const matchesClass = classFilter === "ALL" || batch.allocations.some((allocation) => allocation.tuitionFee.class?.name === classFilter);
      const matchesSearch = !query || [batch.batchNo, batch.student.code, batch.student.fullName]
        .concat(batch.allocations.flatMap((allocation) => [
          allocation.tuitionFee.feeNo,
          allocation.tuitionFee.class?.name || "",
        ]))
        .join(" ")
        .toLocaleLowerCase("vi-VN")
        .includes(query);
      return hasMonth && matchesStudent && matchesClass && matchesSearch;
    }),
    [classFilter, month, pendingBatches, query, studentFilter],
  );

  const visibleSuccessfulBatches = useMemo(
    () => successfulBatches.filter((batch) => {
      const hasMonth = batch.allocations.some(
        (allocation) => `${allocation.tuitionFee.billingYear}-${String(allocation.tuitionFee.billingMonth).padStart(2, "0")}` === month,
      );
      const matchesStudent = studentFilter === "ALL" || batch.student.id === studentFilter;
      const matchesClass = classFilter === "ALL" || batch.allocations.some((allocation) => allocation.tuitionFee.class?.name === classFilter);
      const matchesSearch = !query || [batch.batchNo, batch.student.code, batch.student.fullName]
        .concat(batch.allocations.flatMap((allocation) => [
          allocation.tuitionFee.feeNo,
          allocation.tuitionFee.class?.name || "",
        ]))
        .join(" ")
        .toLocaleLowerCase("vi-VN")
        .includes(query);
      return hasMonth && matchesStudent && matchesClass && matchesSearch;
    }),
    [classFilter, month, query, studentFilter, successfulBatches],
  );

  const unissuedGroups = useMemo(() => groupByStudent(unissuedFees), [unissuedFees]);
  const pendingGroups = useMemo(() => groupByStudent(visiblePendingBatches), [visiblePendingBatches]);
  const successfulGroups = useMemo(() => groupByStudent(visibleSuccessfulBatches), [visibleSuccessfulBatches]);

  const selectedFees = fees.filter((fee) => selectedFeeIds.includes(fee.id));
  const selectedBatches = pendingBatches.filter((batch) => selectedBatchIds.includes(batch.id));
  const selectedFeeTotal = selectedFees.reduce((sum, fee) => sum + Number(fee.remainingAmount), 0);
  const selectedBatchTotal = selectedBatches.reduce((sum, batch) => sum + Number(batch.totalAmount), 0);
  const canGroupFees = selectedFees.length > 0 && sameStudent(selectedFees);
  const canMergeBatches = selectedBatches.length >= 2 &&
    sameStudent(selectedBatches) &&
    new Set(selectedBatches.map((batch) => batch.bankAccountId)).size <= 1;
  const splitTarget = selectedBatches.length === 1 ? selectedBatches[0] : undefined;
  const selectedBatchStudent = selectedBatches[0]?.student.id;
  const selectedCount = view === "UNISSUED" ? selectedFeeIds.length : selectedBatchIds.length;
  const selectedTotal = view === "UNISSUED" ? selectedFeeTotal : selectedBatchTotal;

  useEffect(() => {
    const visibleIds = new Set(unissuedFees.map((fee) => fee.id));
    setSelectedFeeIds((current) => current.filter((id) => visibleIds.has(id)));
  }, [unissuedFees]);

  useEffect(() => {
    const visibleIds = new Set(visiblePendingBatches.map((batch) => batch.id));
    setSelectedBatchIds((current) => current.filter((id) => visibleIds.has(id)));
  }, [visiblePendingBatches]);

  function toggleFee(id: string) {
    setSelectedFeeIds((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id]);
  }

  function toggleBatch(id: string) {
    setSelectedBatchIds((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id]);
  }

  function handleStudentFilterSelect(item: StudentItem) {
    setStudent({ id: item.id, code: item.code, name: item.fullName });
    studentDialog.onClose();
  }

  function handleClassFilterSelect(item: ClassItem) {
    setSelectedClass({ id: item.id, code: item.code, name: item.name });
    classDialog.onClose();
  }

  function openNoticeDialog(mode: NoticeMode) {
    if (!selectedFees.length) {
      showError("Hãy chọn ít nhất một khoản học phí");
      return;
    }
    if (mode === "GROUPED" && !canGroupFees) {
      showError("Chỉ được gộp học phí của cùng một học sinh");
      return;
    }
    setNoticeMode(mode);
    setDialogError("");
  }

  async function submitNotice() {
    if (!noticeMode || !bankAccountId) {
      setDialogError("Tài khoản nhận tiền là bắt buộc");
      return;
    }
    setBusy(true);
    setDialogError("");
    try {
      const result = await issueNoticeBatches({
        tuitionFeeIds: selectedFeeIds,
        mode: noticeMode,
        bankAccountId,
        idempotencyKey: crypto.randomUUID(),
      });
      setNoticeMode(null);
      await load();
      setIssuedBatches(result.batches);
      showSuccess(`Đã phát hành ${result.batches.length} thông báo học phí`);
    } catch (reasonValue) {
      setDialogError(reasonValue instanceof Error ? reasonValue.message : "Không thể phát hành thông báo");
    } finally {
      setBusy(false);
    }
  }

  function openRestructureDialog(mode: RestructureMode) {
    if (mode === "SPLIT" && (!splitTarget || splitTarget.allocations.length < 2)) {
      showError("Hãy chọn một batch có ít nhất hai khoản học phí");
      return;
    }
    if (mode === "MERGE" && !canMergeBatches) {
      showError("Hãy chọn ít nhất hai batch của cùng học sinh và cùng tài khoản nhận tiền");
      return;
    }
    setRestructureMode(mode);
    setReason("");
    setDialogError("");
  }

  async function submitRestructure() {
    if (!restructureMode || !reason.trim()) {
      setDialogError("Lý do là bắt buộc");
      return;
    }
    setBusy(true);
    setDialogError("");
    try {
      const input = restructureMode === "SPLIT"
        ? {
            operation: "SPLIT" as const,
            sourceBatchId: splitTarget!.id,
            reason: reason.trim(),
            idempotencyKey: crypto.randomUUID(),
          }
        : {
            operation: "MERGE" as const,
            batchIds: selectedBatchIds,
            reason: reason.trim(),
            idempotencyKey: crypto.randomUUID(),
          };
      const result = await restructurePendingBatches(input);
      setRestructureMode(null);
      await load();
      setIssuedBatches(result.batches);
      showSuccess(`Đã tạo lại ${result.batches.length} đợt thanh toán`);
    } catch (reasonValue) {
      setDialogError(reasonValue instanceof Error ? reasonValue.message : "Không thể tách hoặc gộp đợt thu");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Stack spacing={{ xs: 2, md: 3 }}>
      <Paper
        sx={{
          p: { xs: 2, md: 3 },
          color: "common.white",
          background: "linear-gradient(120deg, #123b63 0%, #176b87 58%, #159b8a 100%)",
          boxShadow: "0 12px 28px rgba(18, 59, 99, 0.18)",
        }}
      >
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ md: "center" }} gap={2}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box sx={{ display: "grid", placeItems: "center", width: 48, height: 48, borderRadius: 2, bgcolor: "rgba(255,255,255,0.16)" }}>
              <CampaignOutlinedIcon sx={{ fontSize: 28 }} />
            </Box>
            <Box>
              <Typography variant="h5" fontWeight={800}>Quản lý thông báo và đợt thu</Typography>
              <Typography variant="body2" sx={{ mt: 0.5, color: "rgba(255,255,255,0.78)" }}>
                Phát hành, theo dõi và điều chỉnh thông báo chuyển khoản theo từng học sinh.
              </Typography>
            </Box>
          </Stack>
          <Button
            variant="outlined"
            color="inherit"
            startIcon={<RefreshOutlinedIcon />}
            onClick={() => void load()}
            disabled={loading}
            sx={{ alignSelf: { xs: "stretch", md: "auto" }, borderColor: "rgba(255,255,255,0.45)", color: "common.white" }}
          >
            Làm mới dữ liệu
          </Button>
        </Stack>
      </Paper>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" }, gap: 1.5 }}>
        <DashboardMetric icon={<CampaignOutlinedIcon />} label="Chưa phát" value={unissuedFees.length} tone="primary" />
        <DashboardMetric icon={<HourglassTopOutlinedIcon />} label="Đang chờ" value={visiblePendingBatches.length} tone="warning" />
        <DashboardMetric icon={<TaskAltOutlinedIcon />} label="Đã thanh toán" value={visibleSuccessfulBatches.length} tone="success" />
        <DashboardMetric icon={<CheckCircleOutlineOutlinedIcon />} label="Đang chọn" value={selectedCount} tone="info" detail={selectedCount ? money(selectedTotal) : undefined} />
      </Box>

      <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 2 }, borderRadius: 2.5 }}>
        <Stack spacing={1.5}>
          <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={1}>
            <Stack direction="row" spacing={1} alignItems="center">
              <TuneOutlinedIcon color="primary" fontSize="small" />
              <Box>
                <Typography variant="subtitle1" fontWeight={800}>Bộ lọc dữ liệu</Typography>
                <Typography variant="caption" color="text.secondary">Chọn kỳ học phí và tìm nhanh theo mã học sinh, khoản thu hoặc batch.</Typography>
              </Box>
            </Stack>
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap justifyContent={{ sm: "flex-end" }}>
              {student && <Chip size="small" label={`HV: ${student.code}`} onDelete={() => setStudent(null)} />}
              {selectedClass && <Chip size="small" label={`Lớp: ${selectedClass.name}`} onDelete={() => setSelectedClass(null)} />}
              {search && <Chip size="small" label={`Từ khóa: ${search}`} onDelete={() => setSearch("")} />}
            </Stack>
          </Stack>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.25} alignItems={{ md: "center" }}>
            <Box sx={{ width: { xs: "100%", md: 220 }, flexShrink: 0 }}>
              <MonthPickerField label="Kỳ học phí" value={month} onChange={(value) => { setIssuedBatches([]); setMonth(value); }} textFieldProps={{ size: "small" }} />
            </Box>
            <AppTextField label="Tìm học sinh, mã học phí hoặc batch" size="small" value={search} onChange={(event) => setSearch(event.target.value)} sx={{ flex: 1, minWidth: 0 }} />
            <Button
              size="small"
              variant="text"
              color="inherit"
              startIcon={<TuneOutlinedIcon />}
              endIcon={<ExpandMoreOutlinedIcon sx={{ transform: showAdvancedFilters ? "rotate(180deg)" : "none", transition: "transform 180ms ease" }} />}
              onClick={() => setShowAdvancedFilters((current) => !current)}
              sx={{ color: "text.secondary", whiteSpace: "nowrap", alignSelf: { xs: "flex-start", md: "center" } }}
            >
              Bộ lọc nâng cao
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={() => { setSearch(""); setStudent(null); setSelectedClass(null); }}
              disabled={!search && !student && !selectedClass}
              sx={{ whiteSpace: "nowrap", alignSelf: { xs: "stretch", md: "center" } }}
            >
              Xóa lọc
            </Button>
          </Stack>
          <Collapse in={showAdvancedFilters}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.25} alignItems={{ md: "center" }} sx={{ pt: 0.5 }}>
              <MasterSelectField
                label="Học viên"
                value={student}
                onOpen={studentDialog.onOpen}
                size="small"
                codeLabel="Mã học viên"
                nameLabel="Họ tên"
                sx={{ flex: 1, minWidth: { md: 280 } }}
              />
              <MasterSelectField
                label="Lớp học"
                value={selectedClass}
                onOpen={classDialog.onOpen}
                size="small"
                codeLabel="Mã lớp"
                nameLabel="Tên lớp"
                sx={{ flex: 1, minWidth: { md: 280 } }}
              />
            </Stack>
          </Collapse>
          <Tabs value={view} variant="scrollable" scrollButtons="auto" onChange={(_, value: View) => { setView(value); setSelectedFeeIds([]); setSelectedBatchIds([]); }}>
            <Tab icon={<CampaignOutlinedIcon fontSize="small" />} iconPosition="start" value="UNISSUED" label={`Chưa phát thông báo (${unissuedFees.length})`} />
            <Tab icon={<HourglassTopOutlinedIcon fontSize="small" />} iconPosition="start" value="PENDING" label={`Đang chờ thanh toán (${visiblePendingBatches.length})`} />
            <Tab icon={<TaskAltOutlinedIcon fontSize="small" />} iconPosition="start" value="SUCCESS" label={`Đã thanh toán (${visibleSuccessfulBatches.length})`} />
          </Tabs>
        </Stack>
      </Paper>

      {error && <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => void load()}>Thử lại</Button>}>{error}</Alert>}
      {loading && <LinearLoading />}
      {issuedBatches.length > 0 && <Paper sx={{ p: { xs: 1.75, md: 2 }, border: "1px solid", borderColor: "success.light", bgcolor: "success.50" }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} justifyContent="space-between" alignItems={{ md: "center" }}>
          <Stack direction="row" spacing={1} alignItems="flex-start">
            <CheckCircleOutlineOutlinedIcon color="success" />
            <Box>
              <Typography fontWeight={800}>Thông báo vừa phát hành</Typography>
              <Typography variant="body2" color="text.secondary">Tải PDF ngay hoặc mở chi tiết đợt thu để tiếp tục xử lý.</Typography>
            </Box>
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} flexWrap="wrap" useFlexGap>
            {issuedBatches.map((batch) => <Fragment key={batch.id}><Button component="a" href={`/api/payment-batches/${batch.id}/notice/pdf`} size="small" variant="outlined" startIcon={<DownloadOutlinedIcon />}>Tải {batch.batchNo}</Button><Button component={Link} href={`/admin/tuition-fees/payment-history/${batch.id}`} size="small">Xem chi tiết</Button></Fragment>)}
          </Stack>
        </Stack>
      </Paper>}

      {view === "UNISSUED" ? (
        <Stack spacing={1.5}>
          <SectionHeader icon={<CampaignOutlinedIcon />} title="Khoản học phí chưa phát thông báo" subtitle="Chọn từng khoản hoặc chọn theo học sinh để phát hành thông báo tổng." />
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) 300px" }, gap: 2 }}>
          <Paper sx={{ overflow: "hidden" }}>
            <Box sx={{ overflowX: "auto" }}>
              <Table sx={{ minWidth: 900 }} size="small">
                <TableHead><TableRow><TableCell padding="checkbox"><Checkbox checked={Boolean(unissuedFees.length) && selectedFeeIds.length === unissuedFees.length} onChange={(event) => setSelectedFeeIds(event.target.checked ? unissuedFees.map((fee) => fee.id) : [])} /></TableCell><TableCell>Học sinh</TableCell><TableCell>Khoản học phí</TableCell><TableCell>Lớp</TableCell><TableCell>Phải thu</TableCell><TableCell>Còn nợ</TableCell><TableCell>Trạng thái</TableCell></TableRow></TableHead>
                <TableBody>
                  {unissuedGroups.map((group) => {
                    const groupIds = group.items.map((fee) => fee.id);
                    const groupSelected = groupIds.every((id) => selectedFeeIds.includes(id));
                    return <Fragment key={group.student.id}>
                      <TableRow sx={{ bgcolor: "action.hover" }}>
                        <TableCell padding="checkbox"><Checkbox checked={groupSelected} onChange={(event) => setSelectedFeeIds((current) => event.target.checked ? [...new Set([...current, ...groupIds])] : current.filter((id) => !groupIds.includes(id)))} /></TableCell>
                        <TableCell colSpan={6}><Typography fontWeight={800}>{group.student.fullName}</Typography><Typography variant="caption" color="text.secondary">{group.student.code} · {group.items.length} khoản chưa phát thông báo</Typography></TableCell>
                      </TableRow>
                      {group.items.map((fee) => <TableRow key={fee.id} hover>
                        <TableCell padding="checkbox"><Checkbox checked={selectedFeeIds.includes(fee.id)} onChange={() => toggleFee(fee.id)} /></TableCell>
                        <TableCell>{fee.student.fullName}<Typography variant="caption" display="block" color="text.secondary">{fee.student.code}</Typography></TableCell>
                        <TableCell><Button component={Link} href={`/admin/tuition-fees/${fee.id}`} size="small" sx={{ p: 0, justifyContent: "flex-start" }}>{fee.feeNo}</Button><Typography variant="caption" display="block" color="text.secondary">{fee.items.map((item) => item.itemName).join(", ") || "-"}</Typography></TableCell>
                        <TableCell>{fee.class.name}</TableCell>
                        <TableCell>{money(fee.finalAmount)}</TableCell>
                        <TableCell><Typography fontWeight={700}>{money(fee.remainingAmount)}</Typography></TableCell>
                        <TableCell><Chip size="small" color={feeStatusColors[fee.status]} label={feeStatusLabels[fee.status]} /></TableCell>
                      </TableRow>)}
                    </Fragment>;
                  })}
                  {!loading && !unissuedFees.length && <TableRow><TableCell colSpan={7}><EmptyState message="Không có khoản học phí chưa phát thông báo trong kỳ này" /></TableCell></TableRow>}
                </TableBody>
              </Table>
            </Box>
          </Paper>
          <SelectionSummary count={selectedFeeIds.length} total={selectedFeeTotal} details={selectedFees.slice(0, 5).map((fee) => `${fee.feeNo} · ${fee.student.fullName}`)}>
            <Button fullWidth variant="contained" startIcon={<MergeTypeOutlinedIcon />} onClick={() => openNoticeDialog("GROUPED")} disabled={!canGroupFees}>Phát hành 1 thông báo tổng</Button>
            <Button fullWidth variant="outlined" startIcon={<SendOutlinedIcon />} onClick={() => openNoticeDialog("SEPARATE")} disabled={!selectedFeeIds.length}>Phát hành riêng từng khoản</Button>
            {!sameStudent(selectedFees) && <Alert severity="info">Muốn gộp, các khoản phải thuộc cùng một học sinh.</Alert>}
          </SelectionSummary>
          </Box>
        </Stack>
      ) : view === "PENDING" ? (
        <Stack spacing={1.5}>
          <SectionHeader icon={<HourglassTopOutlinedIcon />} title="Đợt thu đang chờ thanh toán" subtitle="Có thể xuất lại thông báo, tách một batch thành nhiều batch hoặc gộp các batch cùng điều kiện." />
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) 300px" }, gap: 2 }}>
          <Paper sx={{ overflow: "hidden" }}>
            <Box sx={{ overflowX: "auto" }}>
              <Table sx={{ minWidth: 900 }} size="small">
                <TableHead><TableRow><TableCell padding="checkbox"><Checkbox checked={Boolean(visiblePendingBatches.length) && selectedBatchIds.length === visiblePendingBatches.length} onChange={(event) => setSelectedBatchIds(event.target.checked ? visiblePendingBatches.map((batch) => batch.id) : [])} /></TableCell><TableCell>Đợt thu</TableCell><TableCell>Học sinh</TableCell><TableCell>Các khoản</TableCell><TableCell>Tổng tiền</TableCell><TableCell>Thao tác</TableCell></TableRow></TableHead>
                <TableBody>
                  {pendingGroups.map((group) => {
                    const groupIds = group.items.map((batch) => batch.id);
                    const groupSelected = groupIds.every((id) => selectedBatchIds.includes(id));
                    return <Fragment key={group.student.id}>
                      <TableRow sx={{ bgcolor: "action.hover" }}>
                        <TableCell padding="checkbox"><Checkbox checked={groupSelected} onChange={(event) => setSelectedBatchIds((current) => event.target.checked ? [...new Set([...current, ...groupIds])] : current.filter((id) => !groupIds.includes(id)))} /></TableCell>
                        <TableCell colSpan={5}><Typography fontWeight={800}>{group.student.fullName}</Typography><Typography variant="caption" color="text.secondary">{group.student.code} · {group.items.length} đợt đang chờ</Typography></TableCell>
                      </TableRow>
                      {group.items.map((batch) => <TableRow key={batch.id} hover>
                        <TableCell padding="checkbox"><Checkbox checked={selectedBatchIds.includes(batch.id)} onChange={() => toggleBatch(batch.id)} /></TableCell>
                        <TableCell><Typography fontWeight={700}>{batch.batchNo}</Typography><Chip size="small" color="warning" label="Đang chờ" /></TableCell>
                        <TableCell>{batch.student.fullName}<Typography variant="caption" display="block" color="text.secondary">{batch.student.code}</Typography></TableCell>
                        <TableCell>{batch.allocations.map((allocation) => `${allocation.tuitionFee.feeNo} — ${allocation.tuitionFee.class?.name || "-"}`).join(", ")}</TableCell>
                        <TableCell><Typography fontWeight={800}>{money(batch.totalAmount)}</Typography></TableCell>
                        <TableCell><Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap><Button component="a" href={`/api/payment-batches/${batch.id}/notice/pdf`} size="small" startIcon={<DownloadOutlinedIcon />}>Xuất PDF</Button><Button component={Link} href={`/admin/tuition-fees/payment-history/${batch.id}`} size="small">Chi tiết</Button></Stack></TableCell>
                      </TableRow>)}
                    </Fragment>;
                  })}
                  {!loading && !visiblePendingBatches.length && <TableRow><TableCell colSpan={6}><EmptyState message="Không có đợt thanh toán đang chờ trong kỳ này" /></TableCell></TableRow>}
                </TableBody>
              </Table>
            </Box>
          </Paper>
          <SelectionSummary count={selectedBatchIds.length} total={selectedBatchTotal} details={selectedBatches.slice(0, 5).map((batch) => `${batch.batchNo} · ${batch.student.fullName}`)}>
            <Button fullWidth variant="contained" color="warning" startIcon={<CallSplitOutlinedIcon />} onClick={() => openRestructureDialog("SPLIT")} disabled={!splitTarget || splitTarget.allocations.length < 2}>Tách đợt thu</Button>
            <Button fullWidth variant="outlined" startIcon={<MergeTypeOutlinedIcon />} onClick={() => openRestructureDialog("MERGE")} disabled={!canMergeBatches}>Gộp đợt thu</Button>
            {selectedBatches.length > 0 && !sameStudent(selectedBatches) && <Alert severity="info">Chỉ được gộp các đợt của cùng một học sinh.</Alert>}
            {selectedBatches.length > 0 && selectedBatchStudent && new Set(selectedBatches.map((batch) => batch.bankAccountId)).size > 1 && <Alert severity="info">Các đợt phải dùng cùng tài khoản nhận tiền.</Alert>}
          </SelectionSummary>
          </Box>
        </Stack>
      ) : (
        <Stack spacing={1.5}>
          <SectionHeader icon={<TaskAltOutlinedIcon />} title="Lịch sử đợt thu đã thanh toán" subtitle="Dữ liệu chỉ xem; các batch đã thanh toán không thể tách hoặc gộp lại." />
          <Paper sx={{ overflow: "hidden" }}>
            <Box sx={{ overflowX: "auto" }}>
              <Table sx={{ minWidth: 850 }} size="small">
              <TableHead><TableRow><TableCell>Đợt thu</TableCell><TableCell>Học sinh</TableCell><TableCell>Các khoản</TableCell><TableCell>Tổng tiền</TableCell><TableCell>Trạng thái</TableCell><TableCell>Thao tác</TableCell></TableRow></TableHead>
              <TableBody>
                {successfulGroups.map((group) => <Fragment key={group.student.id}>
                  <TableRow sx={{ bgcolor: "action.hover" }}>
                    <TableCell colSpan={6}><Typography fontWeight={800}>{group.student.fullName}</Typography><Typography variant="caption" color="text.secondary">{group.student.code} · {group.items.length} đợt đã thanh toán</Typography></TableCell>
                  </TableRow>
                  {group.items.map((batch) => <TableRow key={batch.id} hover>
                    <TableCell><Typography fontWeight={700}>{batch.batchNo}</Typography></TableCell>
                    <TableCell>{batch.student.fullName}<Typography variant="caption" display="block" color="text.secondary">{batch.student.code}</Typography></TableCell>
                    <TableCell>{batch.allocations.map((allocation) => `${allocation.tuitionFee.feeNo} — ${allocation.tuitionFee.class?.name || "-"}`).join(", ")}</TableCell>
                    <TableCell><Typography fontWeight={800}>{money(batch.totalAmount)}</Typography></TableCell>
                    <TableCell><Chip size="small" color="success" label="Đã thanh toán" /></TableCell>
                    <TableCell><Button component={Link} href={`/admin/tuition-fees/payment-history/${batch.id}`} size="small">Xem chi tiết</Button></TableCell>
                  </TableRow>)}
                </Fragment>)}
                {!loading && !visibleSuccessfulBatches.length && <TableRow><TableCell colSpan={6}><EmptyState message="Không có đợt đã thanh toán trong kỳ này" /></TableCell></TableRow>}
              </TableBody>
            </Table>
            </Box>
          </Paper>
        </Stack>
      )}

      <Paper sx={{ p: 2, bgcolor: "#f8fafc" }}>
        <Stack direction="row" spacing={1} alignItems="flex-start">
          <AccountBalanceWalletOutlinedIcon color="primary" />
          <Typography variant="body2" color="text.secondary">
            Tách/gộp chỉ thay đổi thông báo và đợt thanh toán. Hệ thống không xóa học phí, không sửa payment đã thành công và không tạo biên lai khi phát hành thông báo.
          </Typography>
        </Stack>
      </Paper>

      <ConfirmDialog
        open={Boolean(noticeMode)}
        title={noticeMode === "GROUPED" ? "Phát hành thông báo tổng" : "Phát hành thông báo riêng"}
        message={noticeMode === "GROUPED" ? `Hệ thống sẽ gom ${selectedFeeIds.length} khoản thành một đợt chuyển khoản tổng ${money(selectedFeeTotal)}.` : `Hệ thống sẽ tạo ${selectedFeeIds.length} đợt chuyển khoản riêng, tổng cộng ${money(selectedFeeTotal)}.`}
        content={<Stack spacing={1.5} sx={{ mt: 2 }}><FormControl fullWidth required error={Boolean(dialogError)}><InputLabel id="notice-bank-account-label">Tài khoản nhận tiền</InputLabel><Select labelId="notice-bank-account-label" label="Tài khoản nhận tiền" value={bankAccountId} onChange={(event) => { setBankAccountId(event.target.value); setDialogError(""); }}><MenuItem value="">Chọn tài khoản nhận tiền</MenuItem>{bankAccounts.map((account) => <MenuItem key={account.id} value={account.id}>{account.bankName} — {account.accountNo} — {account.accountName}</MenuItem>)}</Select><FormHelperText>{dialogError || (bankAccounts.length ? "Tài khoản này sẽ được gắn vào batch mới." : "Chưa cấu hình tài khoản nhận tiền")}</FormHelperText></FormControl></Stack>}
        confirmLabel="Phát hành"
        cancelLabel="Hủy"
        confirmColor="primary"
        onConfirm={() => void submitNotice()}
        onCancel={() => { if (!busy) setNoticeMode(null); }}
        isLoading={busy}
        confirmDisabled={!bankAccountId || !bankAccounts.length}
      />

      <ConfirmDialog
        open={Boolean(restructureMode)}
        title={restructureMode === "SPLIT" ? "Tách đợt thanh toán" : "Gộp đợt thanh toán"}
        message={restructureMode === "SPLIT" ? "Batch hiện tại sẽ được hủy và tạo lại thành các batch riêng theo từng khoản học phí." : `Các batch đã chọn sẽ được hủy và tạo lại thành một batch tổng ${money(selectedBatchTotal)}.`}
        content={<Stack spacing={1.5} sx={{ mt: 2 }}>{restructureMode === "SPLIT" && splitTarget && <Alert severity="warning"><Typography variant="body2" fontWeight={700}>Sau khi tách {splitTarget.batchNo}, hệ thống sẽ tạo:</Typography>{splitTarget.allocations.map((allocation) => <Typography key={allocation.tuitionFee.id} variant="body2">{allocation.tuitionFee.feeNo}: {money(allocation.amount)}</Typography>)}</Alert>}{restructureMode === "MERGE" && <Alert severity="info"><Typography variant="body2" fontWeight={700}>Sau khi gộp sẽ tạo 1 batch tổng:</Typography><Typography variant="body2">{selectedBatches.map((batch) => batch.batchNo).join(" + ")} → {money(selectedBatchTotal)}</Typography></Alert>}<AppTextField label="Lý do thao tác" value={reason} onChange={(event) => { setReason(event.target.value); setDialogError(""); }} multiline minRows={3} required error={Boolean(dialogError)} helperText={dialogError || "Bắt buộc nhập để lưu audit log."} /></Stack>}
        confirmLabel="Xác nhận"
        cancelLabel="Hủy"
        confirmColor="warning"
        onConfirm={() => void submitRestructure()}
        onCancel={() => { if (!busy) setRestructureMode(null); }}
        isLoading={busy}
        confirmDisabled={!reason.trim()}
      />
      <StudentSelectDialog
        open={studentDialog.open}
        onClose={studentDialog.onClose}
        onSelect={handleStudentFilterSelect}
        title="Chọn học viên để lọc"
      />
      <ClassSelectDialog
        open={classDialog.open}
        onClose={classDialog.onClose}
        onSelect={handleClassFilterSelect}
      />
      {Snackbar}
    </Stack>
  );
}

const metricTones = {
  primary: { color: "#176b87", background: "#edf8fa" },
  warning: { color: "#b45309", background: "#fff8eb" },
  success: { color: "#15803d", background: "#effbf3" },
  info: { color: "#5b4abf", background: "#f3f1ff" },
} as const;

function DashboardMetric({ icon, label, value, tone, detail }: { icon: ReactNode; label: string; value: number; tone: keyof typeof metricTones; detail?: string }) {
  const colors = metricTones[tone];
  return <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 2 }, borderRadius: 2.5 }}>
    <Stack direction="row" spacing={1.25} alignItems="center">
      <Box sx={{ display: "grid", placeItems: "center", flexShrink: 0, width: 38, height: 38, borderRadius: 1.75, color: colors.color, bgcolor: colors.background }}>{icon}</Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary" noWrap>{label}</Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={{ sm: 0.75 }} alignItems={{ sm: "baseline" }}>
          <Typography variant="h6" fontWeight={800} lineHeight={1.2}>{value}</Typography>
          {detail && <Typography variant="caption" color="text.secondary" noWrap>{detail}</Typography>}
        </Stack>
      </Box>
    </Stack>
  </Paper>;
}

function SectionHeader({ icon, title, subtitle }: { icon: ReactNode; title: string; subtitle: string }) {
  return <Stack direction="row" spacing={1} alignItems="flex-start">
    <Box sx={{ display: "grid", placeItems: "center", width: 34, height: 34, mt: 0.25, borderRadius: 1.5, color: "primary.main", bgcolor: "primary.50" }}>{icon}</Box>
    <Box>
      <Typography variant="subtitle1" fontWeight={800}>{title}</Typography>
      <Typography variant="body2" color="text.secondary">{subtitle}</Typography>
    </Box>
  </Stack>;
}

function SelectionSummary({ count, total, details, children }: { count: number; total: number; details: string[]; children: ReactNode }) {
  return <Paper sx={{ p: { xs: 1.75, md: 2 }, alignSelf: "start", position: { lg: "sticky" }, top: { lg: 24 }, border: "1px solid", borderColor: "primary.100", bgcolor: "#f7fbfc" }}>
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={1} alignItems="center">
        <InfoOutlinedIcon color="primary" fontSize="small" />
        <Box>
          <Typography variant="subtitle1" fontWeight={800}>Tóm tắt lựa chọn</Typography>
          <Typography variant="caption" color="text.secondary">Kiểm tra trước khi thực hiện thao tác</Typography>
        </Box>
      </Stack>
      <Stack direction="row" spacing={1}>
        <Box sx={{ flex: 1, p: 1.25, borderRadius: 1.5, bgcolor: "common.white" }}>
          <Typography variant="caption" color="text.secondary">Số khoản/đợt</Typography>
          <Typography variant="h6" fontWeight={800}>{count}</Typography>
        </Box>
        <Box sx={{ flex: 1, p: 1.25, borderRadius: 1.5, bgcolor: "common.white" }}>
          <Typography variant="caption" color="text.secondary">Tổng tiền</Typography>
          <Typography variant="body1" fontWeight={800} sx={{ mt: 0.5 }}>{money(total)}</Typography>
        </Box>
      </Stack>
      {details.length > 0 && <Stack spacing={0.25} sx={{ maxHeight: 130, overflowY: "auto" }}>{details.map((detail) => <Typography key={detail} variant="caption" color="text.secondary" noWrap>{detail}</Typography>)}{count > details.length && <Typography variant="caption" color="text.secondary">+ {count - details.length} khoản/đợt khác</Typography>}</Stack>}
      <Box sx={{ pt: 0.5 }}><Stack spacing={1}>{children}</Stack></Box>
    </Stack>
  </Paper>;
}

function EmptyState({ message }: { message: string }) {
  return <Stack alignItems="center" spacing={1} sx={{ py: 5 }}><CheckCircleOutlineOutlinedIcon color="disabled" /><Typography color="text.secondary">{message}</Typography></Stack>;
}

function LinearLoading() {
  return <Stack direction="row" spacing={1} alignItems="center"><CircularProgress size={18} /><Typography variant="body2" color="text.secondary">Đang tải dữ liệu...</Typography></Stack>;
}
