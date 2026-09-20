"use client";

import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import ExpandMoreOutlinedIcon from "@mui/icons-material/ExpandMoreOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import {
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  Typography,
} from "@mui/material";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ClassSelectDialog, type ClassItem } from "@/components/shared/dialogs/ClassSelectDialog";
import { StudentSelectDialog, type StudentItem } from "@/components/shared/dialogs/StudentSelectDialog";
import { MasterSelectField, type MasterSelectValue } from "@/components/shared/forms/MasterSelectField";
import { MonthPickerField } from "@/components/shared/forms/MonthPickerField";
import { useDisclosure } from "@/hooks/useDisclosure";
import { extractApiErrorMessage, unwrapApiResponse } from "@/lib/api-client";

type Status = "UNPAID" | "PARTIAL" | "PAID" | "OVERDUE" | "EXEMPTED" | "CANCELLED";
type BillingType = "MONTHLY" | "LEGACY_ONE_TIME" | "OTHER_FEE";
type Fee = {
  id: string;
  feeNo: string;
  billingYear: number;
  billingMonth: number;
  originalAmount: number;
  discountAmount: number;
  additionalAmount: number;
  finalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  dueDate?: string | null;
  status: Status;
  billingType: BillingType;
  createdAt: string;
  student?: { code: string; fullName: string } | null;
  class?: { name: string } | null;
  payments?: Array<{ paymentDate: string; paymentMethod: string }>;
};

const labels: Record<Status, string> = {
  UNPAID: "Chưa thanh toán",
  PARTIAL: "Đã thu một phần",
  PAID: "Đã thanh toán",
  OVERDUE: "Quá hạn",
  EXEMPTED: "Miễn học phí",
  CANCELLED: "Đã hủy",
};
const billingTypeLabels: Record<BillingType, string> = {
  MONTHLY: "Học phí tháng",
  LEGACY_ONE_TIME: "Khoản phí cũ",
  OTHER_FEE: "Khoản phí khác",
};
const colors: Record<Status, "default" | "success" | "warning" | "info" | "error"> = {
  UNPAID: "warning",
  PARTIAL: "info",
  PAID: "success",
  OVERDUE: "error",
  EXEMPTED: "info",
  CANCELLED: "default",
};
const money = (value: number) => `${new Intl.NumberFormat("vi-VN").format(Number(value))} ₫`;

export function TuitionList() {
  const [items, setItems] = useState<Fee[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [studentCode, setStudentCode] = useState("");
  const [appliedStudentCode, setAppliedStudentCode] = useState("");
  const [student, setStudent] = useState<MasterSelectValue | null>(null);
  const [selectedClass, setSelectedClass] = useState<MasterSelectValue | null>(null);
  const [classId, setClassId] = useState("");
  const [appliedClassId, setAppliedClassId] = useState("");
  const studentDialog = useDisclosure();
  const classDialog = useDisclosure();
  const [status, setStatus] = useState("");
  const [appliedStatus, setAppliedStatus] = useState("");
  const [billingType, setBillingType] = useState("");
  const [appliedBillingType, setAppliedBillingType] = useState("");
  const [billingMonth, setBillingMonth] = useState("");
  const [appliedBillingMonth, setAppliedBillingMonth] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const query = new URLSearchParams({ page: String(page + 1), pageSize: String(pageSize) });
    if (appliedStudentCode.trim()) query.set("studentCode", appliedStudentCode.trim());
    if (appliedClassId) query.set("classId", appliedClassId);
    if (appliedStatus) query.set("status", appliedStatus);
    if (appliedBillingType) query.set("billingType", appliedBillingType);
    if (appliedBillingMonth) query.set("month", appliedBillingMonth);

    try {
      const response = await fetch(`/api/tuition-fees?${query}`);
      if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không thể tải danh sách học phí"));
      const result = await unwrapApiResponse<{ items: Fee[]; total: number }>(response);
      setItems(result.items);
      setTotal(result.total);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể tải danh sách học phí");
    } finally {
      setLoading(false);
    }
  }, [appliedStudentCode, appliedClassId, appliedStatus, appliedBillingType, appliedBillingMonth, page, pageSize]);

  useEffect(() => { void load(); }, [load]);

  async function exportCsv() {
    setExporting(true);
    const query = new URLSearchParams({ export: "csv" });
    if (appliedStudentCode.trim()) query.set("studentCode", appliedStudentCode.trim());
    if (appliedClassId) query.set("classId", appliedClassId);
    if (appliedStatus) query.set("status", appliedStatus);
    if (appliedBillingType) query.set("billingType", appliedBillingType);
    if (appliedBillingMonth) query.set("month", appliedBillingMonth);

    try {
      const response = await fetch(`/api/tuition-fees?${query}`);
      if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không thể xuất danh sách học phí"));
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "tuition-fees.csv";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể xuất danh sách học phí");
    } finally {
      setExporting(false);
    }
  }

  function clearFilters() {
    setStudent(null);
    setStudentCode("");
    setAppliedStudentCode("");
    setSelectedClass(null);
    setClassId("");
    setAppliedClassId("");
    setStatus("");
    setAppliedStatus("");
    setBillingType("");
    setAppliedBillingType("");
    setBillingMonth("");
    setAppliedBillingMonth("");
    setPage(0);
  }

  function applyFilters() {
    setAppliedStudentCode(studentCode);
    setAppliedClassId(classId);
    setAppliedStatus(status);
    setAppliedBillingType(billingType);
    setAppliedBillingMonth(billingMonth);
    setPage(0);
  }

  return (
    <Stack spacing={{ xs: 2, md: 3 }}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={2}>
        <BoxTitle />
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <Button variant="outlined" startIcon={<DownloadOutlinedIcon />} onClick={() => void exportCsv()} disabled={exporting}>
            {exporting ? "Đang xuất..." : "Xuất CSV"}
          </Button>
          <Button variant="outlined" startIcon={<RefreshOutlinedIcon />} onClick={() => void load()}>
            Làm mới
          </Button>
        </Stack>
      </Stack>

      <Paper sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack spacing={1.5}>
          <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} gap={1.25}>
            <Stack direction="row" spacing={1} alignItems="center">
              <SearchOutlinedIcon color="primary" fontSize="small" />
              <Box>
                <Typography fontWeight={800}>Tra cứu học phí</Typography>
                <Typography variant="caption" color="text.secondary">Lọc nhanh theo kỳ và trạng thái thanh toán</Typography>
              </Box>
            </Stack>
            <Button
              size="small"
              variant="text"
              color="inherit"
              startIcon={<TuneOutlinedIcon />}
              endIcon={<ExpandMoreOutlinedIcon sx={{ transform: showAdvancedFilters ? "rotate(180deg)" : "none", transition: "transform 180ms ease" }} />}
              onClick={() => setShowAdvancedFilters((current) => !current)}
              sx={{ color: "text.secondary", alignSelf: { xs: "flex-start", sm: "center" } }}
            >
              Bộ lọc nâng cao
            </Button>
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} alignItems={{ sm: "center" }}>
            <MonthPickerField label="Kỳ học phí" value={billingMonth} onChange={setBillingMonth} textFieldProps={{ size: "small" }} />
            <FormControl size="small" sx={{ minWidth: { sm: 210 }, flex: { sm: 1 } }}>
              <InputLabel id="tuition-status-label">Trạng thái</InputLabel>
              <Select labelId="tuition-status-label" label="Trạng thái" value={status} onChange={(event) => setStatus(event.target.value)}>
                <MenuItem value="">Tất cả trạng thái</MenuItem>
                {(Object.keys(labels) as Status[]).map((key) => <MenuItem key={key} value={key}>{labels[key]}</MenuItem>)}
              </Select>
            </FormControl>
            <Button variant="contained" onClick={applyFilters}>Tìm kiếm</Button>
            <Button variant="outlined" onClick={clearFilters} disabled={!studentCode && !classId && !status && !billingType && !billingMonth}>Xóa lọc</Button>
          </Stack>
          <Collapse in={showAdvancedFilters}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.25} alignItems={{ md: "center" }} sx={{ pt: 0.5 }}>
              <MasterSelectField label="Học viên" value={student} onOpen={studentDialog.onOpen} size="small" codeLabel="Mã học sinh" nameLabel="Họ tên" sx={{ flex: 1, minWidth: { md: 260 } }} />
              <MasterSelectField label="Lớp học" value={selectedClass} onOpen={classDialog.onOpen} size="small" codeLabel="Mã lớp" nameLabel="Tên lớp" sx={{ flex: 1, minWidth: { md: 260 } }} />
              <FormControl size="small" sx={{ minWidth: { md: 210 } }}>
                <InputLabel id="tuition-type-label">Loại phí</InputLabel>
                <Select labelId="tuition-type-label" label="Loại phí" value={billingType} onChange={(event) => setBillingType(event.target.value)}>
                  <MenuItem value="">Tất cả loại phí</MenuItem>
                  {(Object.keys(billingTypeLabels) as BillingType[]).map((key) => <MenuItem key={key} value={key}>{billingTypeLabels[key]}</MenuItem>)}
                </Select>
              </FormControl>
            </Stack>
          </Collapse>
        </Stack>
      </Paper>

      {error && <Alert severity="error" action={<Button variant="text" color="inherit" size="small" onClick={() => void load()}>Thử lại</Button>}>{error}</Alert>}

      <Paper sx={{ overflow: "hidden" }}>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} gap={1} sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
          <Box>
            <Typography variant="h6" fontWeight={800}>Danh sách học phí</Typography>
            <Typography variant="body2" color="text.secondary">{total} khoản phí trong kết quả hiện tại</Typography>
          </Box>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {appliedStudentCode && <Chip size="small" variant="outlined" label={`HV: ${appliedStudentCode}`} />}
            {appliedClassId && <Chip size="small" variant="outlined" label="Đã lọc theo lớp" />}
            {appliedBillingMonth && <Chip size="small" color="info" label={`Kỳ ${appliedBillingMonth}`} />}
            {appliedStatus && <Chip size="small" color={colors[appliedStatus as Status]} label={labels[appliedStatus as Status]} />}
            {appliedBillingType && <Chip size="small" variant="outlined" label={billingTypeLabels[appliedBillingType as BillingType]} />}
          </Stack>
        </Stack>
        <Box sx={{ overflowX: "auto" }}>
        <Table sx={{ minWidth: 980 }} size="small">
          <TableHead><TableRow><TableCell>Khoản học phí</TableCell><TableCell>Học viên</TableCell><TableCell>Kỳ / lớp</TableCell><TableCell>Phải thu / đã thu</TableCell><TableCell>Còn nợ</TableCell><TableCell>Hạn thanh toán</TableCell><TableCell align="right">Thao tác</TableCell></TableRow></TableHead>
          <TableBody>
            {!loading && items.map((item) => <TableRow key={item.id} hover>
              <TableCell sx={{ minWidth: 170 }}>
                <Button component={Link} href={`/admin/tuition-fees/${item.id}`} size="small" variant="text" sx={{ p: 0, minWidth: 0, justifyContent: "flex-start", fontWeight: 800 }}>{item.feeNo}</Button>
                <Chip size="small" variant="outlined" label={billingTypeLabels[item.billingType] || item.billingType} sx={{ mt: 0.75, display: "flex", width: "fit-content" }} />
              </TableCell>
              <TableCell sx={{ minWidth: 180 }}><Typography variant="body2" fontWeight={700}>{item.student?.fullName || "-"}</Typography><Typography variant="caption" color="text.secondary">{item.student?.code || "-"}</Typography></TableCell>
              <TableCell sx={{ minWidth: 150 }}><Typography variant="body2" fontWeight={600}>{`${String(item.billingMonth).padStart(2, "0")}/${item.billingYear}`}</Typography><Typography variant="caption" color="text.secondary">{item.class?.name || "-"}</Typography></TableCell>
              <TableCell sx={{ minWidth: 155 }}><Typography variant="body2" fontWeight={800}>{money(item.finalAmount)}</Typography><Typography variant="caption" color="text.secondary">Đã thu {money(item.paidAmount)}</Typography></TableCell>
              <TableCell sx={{ minWidth: 130 }}><Typography fontWeight={800} color={Number(item.remainingAmount) > 0 ? "error.main" : "success.main"}>{money(item.remainingAmount)}</Typography></TableCell>
              <TableCell sx={{ minWidth: 150 }}><Typography variant="body2">{item.dueDate ? new Date(item.dueDate).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "-"}</Typography><Chip size="small" color={colors[item.status]} label={labels[item.status]} sx={{ mt: 0.75 }} /></TableCell>
              <TableCell align="right" sx={{ minWidth: 185 }}><Stack direction="row" justifyContent="flex-end" spacing={0.5}><Button component={Link} href={`/admin/tuition-fees/${item.id}`} size="small">Chi tiết</Button>{(item.status === "UNPAID" || item.status === "PARTIAL" || item.status === "OVERDUE") && <Button component={Link} href={`/admin/tuition-fees/payment?tuitionFeeId=${item.id}`} size="small" variant="contained">{item.status === "PARTIAL" ? "Thu phần còn lại" : "Thu tiền"}</Button>}</Stack></TableCell>
            </TableRow>)}
            {!loading && !items.length && <TableRow><TableCell colSpan={7}><Typography sx={{ p: 4, textAlign: "center" }} color="text.secondary">Không có học phí phù hợp</Typography></TableCell></TableRow>}
            {loading && <TableRow><TableCell colSpan={7}><Typography sx={{ p: 4, textAlign: "center" }}>Đang tải dữ liệu...</Typography></TableCell></TableRow>}
          </TableBody>
        </Table>
        </Box>
        <TablePagination component="div" count={total} page={page} rowsPerPage={pageSize} onPageChange={(_, nextPage) => setPage(nextPage)} onRowsPerPageChange={(event) => { setPageSize(Number(event.target.value)); setPage(0); }} rowsPerPageOptions={[10, 20, 50, 100]} labelRowsPerPage="Số dòng/trang" labelDisplayedRows={({ from, to, count }) => `${from}–${to} trên ${count !== -1 ? count : `hơn ${to}`}`} />
      </Paper>

      <StudentSelectDialog open={studentDialog.open} onClose={studentDialog.onClose} onSelect={(item: StudentItem) => { setStudent({ id: item.id, code: item.code, name: item.fullName }); setStudentCode(item.code); studentDialog.onClose(); }} />
      <ClassSelectDialog open={classDialog.open} onClose={classDialog.onClose} onSelect={(item: ClassItem) => { setSelectedClass({ id: item.id, code: item.code, name: item.name }); setClassId(item.id); classDialog.onClose(); }} />
    </Stack>
  );
}

function BoxTitle() {
  return (
    <Box>
      <Typography variant="h5" fontWeight={800}>Các khoản học phí</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Theo dõi khoản phải thu theo học viên, lớp và kỳ học.</Typography>
    </Box>
  );
}
