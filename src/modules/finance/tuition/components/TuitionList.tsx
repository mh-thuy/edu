"use client";

import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import {
  Alert,
  Box,
  Button,
  Chip,
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

type Status = "UNPAID" | "PAID" | "OVERDUE" | "EXEMPTED" | "CANCELLED";
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
          <Stack direction="row" spacing={1} alignItems="center">
            <SearchOutlinedIcon color="primary" fontSize="small" />
            <Typography fontWeight={700}>Tìm kiếm và lọc</Typography>
          </Stack>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.25} alignItems={{ xs: "stretch", md: "center" }}>
            <MasterSelectField label="Học viên" value={student} onOpen={studentDialog.onOpen} size="small" codeLabel="Mã học sinh" nameLabel="Họ tên" sx={{ flex: 1, minWidth: { md: 230 } }} />
            <MasterSelectField label="Lớp học" value={selectedClass} onOpen={classDialog.onOpen} size="small" codeLabel="Mã lớp" nameLabel="Tên lớp" sx={{ flex: 1, minWidth: { md: 230 } }} />
            <MonthPickerField label="Kỳ học phí" value={billingMonth} onChange={setBillingMonth} textFieldProps={{ size: "small" }} />
            <FormControl size="small" sx={{ minWidth: 185 }}>
              <InputLabel id="tuition-status-label">Trạng thái</InputLabel>
              <Select labelId="tuition-status-label" label="Trạng thái" value={status} onChange={(event) => setStatus(event.target.value)}>
                <MenuItem value="">Tất cả trạng thái</MenuItem>
                {(Object.keys(labels) as Status[]).map((key) => <MenuItem key={key} value={key}>{labels[key]}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 165 }}>
              <InputLabel id="tuition-type-label">Loại phí</InputLabel>
              <Select labelId="tuition-type-label" label="Loại phí" value={billingType} onChange={(event) => setBillingType(event.target.value)}>
                <MenuItem value="">Tất cả loại phí</MenuItem>
                {(Object.keys(billingTypeLabels) as BillingType[]).map((key) => <MenuItem key={key} value={key}>{billingTypeLabels[key]}</MenuItem>)}
              </Select>
            </FormControl>
            <Button variant="contained" onClick={applyFilters}>Tìm kiếm</Button>
            <Button variant="outlined" onClick={clearFilters} disabled={!studentCode && !classId && !status && !billingType && !billingMonth}>Xóa lọc</Button>
          </Stack>
        </Stack>
      </Paper>

      {error && <Alert severity="error" action={<Button variant="text" color="inherit" size="small" onClick={() => void load()}>Thử lại</Button>}>{error}</Alert>}

      <Paper sx={{ overflowX: "auto" }}>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} gap={1} sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
          <Box>
            <Typography variant="h6" fontWeight={800}>Danh sách học phí</Typography>
            <Typography variant="body2" color="text.secondary">{total} khoản phí trong kết quả hiện tại</Typography>
          </Box>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {appliedBillingMonth && <Chip size="small" color="info" label={`Kỳ ${appliedBillingMonth}`} />}
            {appliedBillingType && <Chip size="small" variant="outlined" label={billingTypeLabels[appliedBillingType as BillingType]} />}
          </Stack>
        </Stack>
        <Table sx={{ minWidth: 1160 }} size="small">
          <TableHead><TableRow><TableCell>Mã học phí</TableCell><TableCell>Học viên</TableCell><TableCell>Lớp</TableCell><TableCell>Loại phí</TableCell><TableCell>Kỳ</TableCell><TableCell>Học phí gốc</TableCell><TableCell>Giảm giá</TableCell><TableCell>Phụ phí</TableCell><TableCell align="right">Tổng phải thu</TableCell><TableCell>Hạn thanh toán</TableCell><TableCell>Trạng thái</TableCell><TableCell align="right">Thao tác</TableCell></TableRow></TableHead>
          <TableBody>
            {!loading && items.map((item) => <TableRow key={item.id} hover><TableCell><Button component={Link} href={`/admin/tuition-fees/${item.id}`} size="small" variant="outlined">{item.feeNo}</Button></TableCell><TableCell><Typography variant="body2" fontWeight={600}>{item.student?.fullName || "-"}</Typography><Typography variant="caption" color="text.secondary">{item.student?.code || "-"}</Typography></TableCell><TableCell>{item.class?.name || "-"}</TableCell><TableCell><Chip size="small" variant="outlined" label={billingTypeLabels[item.billingType] || item.billingType} /></TableCell><TableCell>{`${item.billingYear}-${String(item.billingMonth).padStart(2, "0")}`}</TableCell><TableCell>{money(item.originalAmount)}</TableCell><TableCell>{money(item.discountAmount)}</TableCell><TableCell>{money(item.additionalAmount)}</TableCell><TableCell align="right"><strong>{money(item.finalAmount)}</strong></TableCell><TableCell>{item.dueDate ? new Date(item.dueDate).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "-"}</TableCell><TableCell><Chip size="small" color={colors[item.status]} label={labels[item.status]} /></TableCell><TableCell align="right"><Stack direction="row" justifyContent="flex-end" spacing={0.5}><Button component={Link} href={`/admin/tuition-fees/${item.id}`} size="small">Xem chi tiết</Button>{(item.status === "UNPAID" || item.status === "OVERDUE") && <Button component={Link} href={`/admin/tuition-fees/payment?tuitionFeeId=${item.id}`} size="small" variant="contained">Thu tiền</Button>}</Stack></TableCell></TableRow>)}
            {!loading && !items.length && <TableRow><TableCell colSpan={12}><Typography sx={{ p: 4, textAlign: "center" }} color="text.secondary">Không có học phí phù hợp</Typography></TableCell></TableRow>}
            {loading && <TableRow><TableCell colSpan={12}><Typography sx={{ p: 4, textAlign: "center" }}>Đang tải dữ liệu...</Typography></TableCell></TableRow>}
          </TableBody>
        </Table>
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
