"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
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
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import Link from "next/link";
import { StudentSelectDialog, type StudentItem } from "@/components/shared/dialogs/StudentSelectDialog";
import { ConfirmDialog } from "@/components/shared/dialogs/ConfirmDialog";
import { MonthPickerField } from "@/components/shared/forms/MonthPickerField";
import { extractApiErrorMessage, unwrapApiResponse } from "@/lib/api-client";
import { useSnackbar } from "@/hooks/useSnackbar";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import FilterAltOutlinedIcon from "@mui/icons-material/FilterAltOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";

type ClassSubject = {
  id: string;
  tuitionFee: number;
  subject: { id: string; name: string; status?: "ACTIVE" | "INACTIVE" };
};

type ClassData = { id: string; code: string; name: string; status: string; classSubjects: ClassSubject[] };
type EnrollmentPause = { id: string; status: "ACTIVE" | "CANCELLED"; startMonth: string; endMonth: string; reason: string | null };
type Fee = {
  id: string;
  status: string;
  billingYear: number;
  billingMonth: number;
  billingType: string;
  items: Array<{ classSubjectId: string | null }>;
};
type StudentRow = {
  id: string;
  studentId: string;
  status: "ACTIVE" | "COMPLETED";
  student: { code: string; fullName: string; phone?: string | null };
  subjects: Array<{ classSubjectId: string }>;
  tuitionFees: Fee[];
  pauses: EnrollmentPause[];
};

const currentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};
const money = (value: number) => `${new Intl.NumberFormat("vi-VN").format(value)} VND`;
const monthValue = (value: string) => value.slice(0, 7);

export function ClassStudentManagement({ id }: { id: string }) {
  const [classData, setClassData] = useState<ClassData | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [month, setMonth] = useState(currentMonth);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [subjectFilter, setSubjectFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<StudentRow | null>(null);
  const [studentPickerOpen, setStudentPickerOpen] = useState(false);
  const [subjectDialogOpen, setSubjectDialogOpen] = useState(false);
  const [pendingStudent, setPendingStudent] = useState<StudentItem | null>(null);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [registeredSubjectIds, setRegisteredSubjectIds] = useState<string[]>([]);
  const [dropTarget, setDropTarget] = useState<{ student: StudentRow; subjectId: string; hasFee: boolean } | null>(null);
  const [dropReason, setDropReason] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<StudentRow | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [pauseTarget, setPauseTarget] = useState<StudentRow | null>(null);
  const [pauseStart, setPauseStart] = useState(currentMonth);
  const [pauseEnd, setPauseEnd] = useState(currentMonth);
  const [pauseReason, setPauseReason] = useState("");
  const [editingPauseId, setEditingPauseId] = useState<string | null>(null);
  const [pauseCancelTarget, setPauseCancelTarget] = useState<{
    student: StudentRow;
    pauseId: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const { showSuccess, showError, Snackbar } = useSnackbar();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [classResponse, studentsResponse] = await Promise.all([
        fetch(`/api/classes/${id}`),
        fetch(`/api/classes/${id}/students`),
      ]);
      if (!classResponse.ok) throw new Error(await extractApiErrorMessage(classResponse, "Không thể tải lớp học"));
      if (!studentsResponse.ok) throw new Error(await extractApiErrorMessage(studentsResponse, "Không thể tải danh sách học viên"));
      const [classResult, studentResult] = await Promise.all([
        unwrapApiResponse<ClassData>(classResponse),
        unwrapApiResponse<StudentRow[]>(studentsResponse),
      ]);
      setClassData(classResult);
      setStudents(studentResult);
      setSelectedStudent((current) => current ? studentResult.find((item) => item.id === current.id) ?? null : null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể tải dữ liệu");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const subjectName = useMemo(() => new Map((classData?.classSubjects ?? []).map((item) => [item.id, item.subject.name])), [classData]);
  const getPause = (student: StudentRow) => student.pauses.find((pause) => pause.status === "ACTIVE" && monthValue(pause.startMonth) <= month && monthValue(pause.endMonth) >= month);
  const getFee = (student: StudentRow) => {
    const [year, selectedMonth] = month.split("-").map(Number);
    return student.tuitionFees.find((fee) => fee.billingType === "MONTHLY" && fee.billingYear === year && fee.billingMonth === selectedMonth);
  };
  const visibleStudents = students.filter((student) => {
    const text = `${student.student.code} ${student.student.fullName} ${student.student.phone ?? ""}`.toLowerCase();
    const subjectMatch = subjectFilter === "ALL" || student.subjects.some((item) => item.classSubjectId === subjectFilter);
    const pause = getPause(student);
    const status = student.status === "COMPLETED" ? "COMPLETED" : pause ? "PAUSED" : "ACTIVE";
    return text.includes(search.trim().toLowerCase()) && subjectMatch && (statusFilter === "ALL" || status === statusFilter);
  });
  const activeCount = students.filter((student) => student.status === "ACTIVE" && !getPause(student)).length;
  const pausedCount = students.filter((student) => student.status === "ACTIVE" && Boolean(getPause(student))).length;
  const completedCount = students.filter((student) => student.status === "COMPLETED").length;
  const uncreatedCount = activeCount - students.filter((student) => student.status === "ACTIVE" && !getPause(student) && Boolean(getFee(student))).length;

  function openSubjectDialog(student: StudentItem, existing?: StudentRow) {
    const registered = existing?.subjects.map((item) => item.classSubjectId) ?? [];
    setPendingStudent(student);
    setRegisteredSubjectIds(registered);
    setSelectedSubjectIds(registered);
    setSubjectDialogOpen(true);
  }

  async function submitSubjects() {
    if (!pendingStudent || !selectedSubjectIds.length) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/classes/${id}/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: pendingStudent.id, classSubjectIds: selectedSubjectIds }),
      });
      if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không thể cập nhật môn học"));
      setSubjectDialogOpen(false);
      await load();
      showSuccess("Đã cập nhật môn đăng ký");
    } catch (reason) {
      showError(reason instanceof Error ? reason.message : "Không thể cập nhật môn học");
    } finally {
      setBusy(false);
    }
  }

  async function dropSubject() {
    if (!dropTarget) return;
    if (dropTarget.hasFee && !dropReason.trim()) {
      showError("Vui lòng nhập lý do force cancel môn đã phát sinh học phí");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/classes/${id}/students/${dropTarget.student.studentId}/subjects/${dropTarget.subjectId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: dropTarget.hasFee, reason: dropTarget.hasFee ? dropReason.trim() : undefined }),
      });
      if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không thể bỏ môn"));
      setDropTarget(null);
      setDropReason("");
      await load();
      showSuccess("Đã bỏ môn học");
    } catch (reason) {
      showError(reason instanceof Error ? reason.message : "Không thể bỏ môn");
    } finally {
      setBusy(false);
    }
  }

  async function deleteStudent() {
    if (!deleteTarget) return;
    const hasFee = deleteTarget.tuitionFees.length > 0;
    if (hasFee && !deleteReason.trim()) {
      showError("Vui lòng nhập lý do force rời lớp đã phát sinh học phí");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/classes/${id}/students`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: deleteTarget.studentId, force: hasFee, reason: hasFee ? deleteReason.trim() : undefined }),
      });
      if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không thể xóa học viên"));
      setDeleteTarget(null);
      setDeleteReason("");
      await load();
      showSuccess("Đã xóa học viên khỏi lớp");
    } catch (reason) {
      showError(reason instanceof Error ? reason.message : "Không thể xóa học viên");
    } finally {
      setBusy(false);
    }
  }

  async function pauseStudent() {
    if (!pauseTarget) return;
    if (!pauseStart || !pauseEnd) {
      showError("Vui lòng chọn đủ tháng bắt đầu và tháng kết thúc");
      return;
    }
    if (pauseStart > pauseEnd) {
      showError("Tháng bắt đầu phải trước hoặc bằng tháng kết thúc");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/classes/${id}/students/${pauseTarget.studentId}/pause`, {
        method: editingPauseId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editingPauseId && { pauseId: editingPauseId }),
          startMonth: pauseStart,
          endMonth: pauseEnd,
          reason: pauseReason,
        }),
      });
      if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không thể lưu thời gian tạm nghỉ"));
      setPauseTarget(null);
      setEditingPauseId(null);
      setPauseReason("");
      await load();
      showSuccess(editingPauseId ? "Đã cập nhật thời gian tạm nghỉ" : "Đã ghi nhận thời gian tạm nghỉ");
    } catch (reason) {
      showError(reason instanceof Error ? reason.message : "Không thể tạo thời gian tạm nghỉ");
    } finally {
      setBusy(false);
    }
  }

  async function cancelPause(student: StudentRow, pauseId: string) {
    setBusy(true);
    try {
      const response = await fetch(`/api/classes/${id}/students/${student.studentId}/pause`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pauseId }),
      });
      if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không thể hủy thời gian tạm nghỉ"));
      setPauseCancelTarget(null);
      await load();
      showSuccess("Đã hủy thời gian tạm nghỉ");
    } catch (reason) {
      showError(reason instanceof Error ? reason.message : "Không thể hủy thời gian tạm nghỉ");
    } finally {
      setBusy(false);
    }
  }

  if (!classData && loading) return <Typography>Đang tải quản lý học viên...</Typography>;
  if (!classData) return <Alert severity="error">{error || "Không tìm thấy lớp học"}</Alert>;
  const classClosed = classData.status === "COMPLETED" || classData.status === "CANCELLED";

  return <Stack spacing={{ xs: 2, md: 3 }}>
    <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ md: "center" }} gap={2}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box sx={{ width: 44, height: 44, borderRadius: 2, display: "grid", placeItems: "center", bgcolor: "primary.main", color: "primary.contrastText" }}>
            <PeopleAltOutlinedIcon />
          </Box>
          <Stack spacing={0.25}>
            <Button component={Link} href={`/admin/classes/${id}`} variant="text" size="small" sx={{ alignSelf: "flex-start", px: 0 }}>← {classData.code}</Button>
            <Typography variant="h5" fontWeight={700}>Quản lý học viên</Typography>
            <Typography color="text.secondary">{classData.name}</Typography>
          </Stack>
        </Stack>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <Button variant="outlined" startIcon={<RefreshOutlinedIcon />} onClick={() => void load()} disabled={loading}>Làm mới</Button>
          <Button variant="contained" onClick={() => setStudentPickerOpen(true)} disabled={classClosed || !classData.classSubjects.length}>Đăng ký học viên</Button>
        </Stack>
      </Stack>
    </Paper>
    {error && <Alert severity="error">{error}</Alert>}
    {classClosed && <Alert severity="info">Lớp đã kết thúc hoặc đã hủy; thông tin đăng ký chỉ được xem.</Alert>}
    <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
      {[["Tổng số", students.length], ["Đang học", activeCount], ["Tạm nghỉ", pausedCount], ["Đã hoàn thành", completedCount], ["Chưa tạo phí", Math.max(0, uncreatedCount)]].map(([label, value]) => <Paper key={String(label)} sx={{ p: 2, flex: 1 }}><Typography variant="body2" color="text.secondary">{label}</Typography><Typography variant="h5" fontWeight={700}>{value}</Typography></Paper>)}
    </Stack>
    <Paper sx={{ p: 2 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}><FilterAltOutlinedIcon color="action" fontSize="small" /><Typography fontWeight={700}>Bộ lọc học viên</Typography></Stack>
      <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ md: "center" }}>
        <TextField size="small" label="Tìm mã, tên, số điện thoại" value={search} onChange={(event) => setSearch(event.target.value)} sx={{ minWidth: 280, flex: 1 }} />
        <FormControl size="small" sx={{ minWidth: 150 }}><InputLabel>Trạng thái</InputLabel><Select label="Trạng thái" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><MenuItem value="ALL">Tất cả</MenuItem><MenuItem value="ACTIVE">Đang học</MenuItem><MenuItem value="PAUSED">Tạm nghỉ</MenuItem><MenuItem value="COMPLETED">Đã hoàn thành</MenuItem></Select></FormControl>
        <FormControl size="small" sx={{ minWidth: 170 }}><InputLabel>Môn học</InputLabel><Select label="Môn học" value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value)}><MenuItem value="ALL">Tất cả môn</MenuItem>{classData.classSubjects.map((subject) => <MenuItem key={subject.id} value={subject.id}>{subject.subject.name}</MenuItem>)}</Select></FormControl>
        <MonthPickerField label="Kỳ học phí" value={month} onChange={setMonth} textFieldProps={{ size: "small" }} />
      </Stack>
    </Paper>
    <Paper sx={{ overflowX: "auto" }}>
      <Table sx={{ minWidth: 1050 }}>
        <TableHead><TableRow><TableCell>Mã HV</TableCell><TableCell>Học viên</TableCell><TableCell>Môn đăng ký</TableCell><TableCell>Trạng thái</TableCell><TableCell>Học phí {month}</TableCell><TableCell align="right">Thao tác</TableCell></TableRow></TableHead>
        <TableBody>{visibleStudents.map((student) => {
          const pause = getPause(student);
          const fee = getFee(student);
          return <TableRow key={student.id} hover>
            <TableCell>{student.student.code}</TableCell>
            <TableCell><Typography fontWeight={600}>{student.student.fullName}</Typography><Typography variant="caption" color="text.secondary">{student.student.phone || "Chưa có số điện thoại"}</Typography></TableCell>
            <TableCell>{student.subjects.map((item) => subjectName.get(item.classSubjectId)).filter(Boolean).join(", ") || "-"}</TableCell>
            <TableCell>{student.status === "COMPLETED" ? <Chip size="small" color="default" label="Đã hoàn thành" /> : pause ? <Chip size="small" color="info" label={`Tạm nghỉ đến ${monthValue(pause.endMonth)}`} /> : <Chip size="small" color="success" label="Đang học" />}</TableCell>
            <TableCell>{pause ? <Chip size="small" label="Không phát sinh" /> : fee ? <Chip size="small" color={fee.status === "PAID" ? "success" : fee.status === "OVERDUE" ? "error" : "warning"} label={fee.status === "PAID" ? "Đã thanh toán" : fee.status === "OVERDUE" ? "Quá hạn" : "Đã tạo"} /> : <Chip size="small" color="warning" label="Chưa tạo" />}</TableCell>
            <TableCell align="right"><Stack direction="row" spacing={1} justifyContent="flex-end"><Button size="small" variant="outlined" onClick={() => setSelectedStudent(student)}>Xem</Button><Button size="small" variant="outlined" disabled={classClosed || student.status === "COMPLETED"} onClick={() => openSubjectDialog({ id: student.studentId, code: student.student.code, fullName: student.student.fullName }, student)}>Quản lý môn</Button></Stack></TableCell>
          </TableRow>;
        })}{!visibleStudents.length && <TableRow><TableCell colSpan={6}><Typography sx={{ p: 4, textAlign: "center" }} color="text.secondary">Không có học viên phù hợp</Typography></TableCell></TableRow>}</TableBody>
      </Table>
    </Paper>
    <StudentSelectDialog open={studentPickerOpen} onClose={() => setStudentPickerOpen(false)} onSelect={(student) => { setStudentPickerOpen(false); openSubjectDialog(student); }} excludeClassId={id} />
    <Dialog open={subjectDialogOpen} onClose={() => !busy && setSubjectDialogOpen(false)} fullWidth maxWidth="sm">
      <DialogTitle>{registeredSubjectIds.length ? "Quản lý môn học" : "Đăng ký học viên"}</DialogTitle>
      <DialogContent><Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{pendingStudent?.fullName} — Chọn các môn đang học</Typography><Stack spacing={1}>{classData.classSubjects.filter((subject) => subject.subject.status !== "INACTIVE" || registeredSubjectIds.includes(subject.id)).map((subject) => { const checked = selectedSubjectIds.includes(subject.id); const registered = registeredSubjectIds.includes(subject.id); return <Button key={subject.id} variant={checked ? "contained" : "outlined"} color={registered ? "inherit" : "primary"} onClick={() => !registered && setSelectedSubjectIds((current) => checked ? current.filter((item) => item !== subject.id) : [...current, subject.id])} sx={{ justifyContent: "space-between" }}><span>{subject.subject.name}</span><span>{money(Number(subject.tuitionFee))}{registered ? " · Đang học" : ""}</span></Button>; })}</Stack></DialogContent>
      <DialogActions><Button variant="outlined" onClick={() => setSubjectDialogOpen(false)} disabled={busy}>Hủy</Button><Button variant="contained" onClick={() => void submitSubjects()} disabled={busy || !selectedSubjectIds.length}>{busy ? "Đang lưu..." : "Lưu môn học"}</Button></DialogActions>
    </Dialog>
    <Drawer anchor="right" open={Boolean(selectedStudent)} onClose={() => setSelectedStudent(null)}>
      {selectedStudent && <Stack spacing={2} sx={{ width: { xs: "100vw", sm: 480 }, p: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start"><Stack><Typography variant="h6" fontWeight={700}>{selectedStudent.student.fullName}</Typography><Typography color="text.secondary">{selectedStudent.student.code}</Typography></Stack><Button variant="text" size="small" onClick={() => setSelectedStudent(null)}>Đóng</Button></Stack>
        <Divider />
        <Stack direction="row" spacing={1}><Button variant="outlined" disabled={classClosed || selectedStudent.status === "COMPLETED"} onClick={() => { setEditingPauseId(null); setPauseStart(month); setPauseEnd(month); setPauseReason(""); setPauseTarget(selectedStudent); }}>Tạm nghỉ</Button><Button color="error" variant="outlined" disabled={classClosed || selectedStudent.status === "COMPLETED"} onClick={() => { setDeleteReason(""); setDeleteTarget(selectedStudent); }}>Xóa khỏi lớp</Button></Stack>
        <Typography variant="subtitle1" fontWeight={700}>Môn đăng ký</Typography>
        {selectedStudent.subjects.map((item) => <Paper key={item.classSubjectId} variant="outlined" sx={{ p: 1.5 }}><Stack direction="row" justifyContent="space-between" alignItems="center"><Stack><Typography fontWeight={600}>{subjectName.get(item.classSubjectId)}</Typography><Typography variant="caption" color="text.secondary">{money(Number(classData.classSubjects.find((subject) => subject.id === item.classSubjectId)?.tuitionFee ?? 0))}/tháng</Typography></Stack><Button size="small" variant="outlined" color="error" disabled={classClosed || selectedStudent.status === "COMPLETED"} onClick={() => selectedStudent.subjects.length === 1 ? (setDeleteReason(""), setDeleteTarget(selectedStudent)) : setDropTarget({ student: selectedStudent, subjectId: item.classSubjectId, hasFee: selectedStudent.tuitionFees.some((fee) => fee.items.some((feeItem) => feeItem.classSubjectId === item.classSubjectId)) })}>{selectedStudent.subjects.length === 1 ? "Rời lớp" : "Bỏ môn"}</Button></Stack></Paper>)}
        <Button variant="contained" disabled={classClosed || selectedStudent.status === "COMPLETED"} onClick={() => openSubjectDialog({ id: selectedStudent.studentId, code: selectedStudent.student.code, fullName: selectedStudent.student.fullName }, selectedStudent)}>Thêm môn</Button>
        <Typography variant="subtitle1" fontWeight={700}>Lịch sử tạm nghỉ</Typography>
        {selectedStudent.pauses.length ? selectedStudent.pauses.map((pause) => <Paper key={pause.id} variant="outlined" sx={{ p: 1.5, opacity: pause.status === "CANCELLED" ? 0.65 : 1 }}><Stack direction="row" justifyContent="space-between" gap={1}><Stack><Typography fontWeight={600}>{monthValue(pause.startMonth)} → {monthValue(pause.endMonth)} {pause.status === "CANCELLED" ? "· Đã hủy" : ""}</Typography><Typography variant="caption" color="text.secondary">{pause.reason || "Không có lý do"}</Typography></Stack>{pause.status === "ACTIVE" && <Stack direction="row"><Button size="small" disabled={classClosed} onClick={() => { setEditingPauseId(pause.id); setPauseStart(monthValue(pause.startMonth)); setPauseEnd(monthValue(pause.endMonth)); setPauseReason(pause.reason || ""); setPauseTarget(selectedStudent); }}>Sửa</Button><Button size="small" color="error" disabled={busy || classClosed} onClick={() => setPauseCancelTarget({ student: selectedStudent, pauseId: pause.id })}>Hủy</Button></Stack>}</Stack></Paper>) : <Typography variant="body2" color="text.secondary">Chưa có thời gian tạm nghỉ.</Typography>}
        <Divider />
        <Typography variant="subtitle1" fontWeight={700}>Học phí {month}</Typography>
        <Typography variant="h5">{money(selectedStudent.subjects.reduce((total, item) => total + Number(classData.classSubjects.find((subject) => subject.id === item.classSubjectId)?.tuitionFee ?? 0), 0))}</Typography>
        <Typography variant="body2" color="text.secondary">Đăng ký học viên và tạo học phí là hai thao tác độc lập.</Typography>
      </Stack>}
    </Drawer>
    <Dialog open={Boolean(pauseTarget)} onClose={() => !busy && (setPauseTarget(null), setEditingPauseId(null))} fullWidth maxWidth="sm"><DialogTitle>{editingPauseId ? "Sửa thời gian tạm nghỉ" : "Tạm nghỉ học"}</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}><Typography>{pauseTarget?.student.fullName}</Typography><Stack direction={{ xs: "column", sm: "row" }} spacing={1}><MonthPickerField label="Từ tháng" value={pauseStart} onChange={setPauseStart} /><MonthPickerField label="Đến tháng" value={pauseEnd} onChange={setPauseEnd} /></Stack><TextField fullWidth label="Lý do" multiline minRows={2} value={pauseReason} onChange={(event) => setPauseReason(event.target.value)} /></Stack></DialogContent><DialogActions><Button variant="outlined" onClick={() => { setPauseTarget(null); setEditingPauseId(null); }} disabled={busy}>Hủy</Button><Button variant="contained" onClick={() => void pauseStudent()} disabled={busy}>{editingPauseId ? "Lưu thay đổi" : "Xác nhận tạm nghỉ"}</Button></DialogActions></Dialog>
    <Dialog open={Boolean(dropTarget)} onClose={() => !busy && setDropTarget(null)} fullWidth maxWidth="sm">
      <DialogTitle>{dropTarget?.hasFee ? "Force cancel môn học" : "Bỏ môn học"}</DialogTitle>
      <DialogContent>
        <Typography sx={{ mb: 1 }}>
          Bỏ môn {subjectName.get(dropTarget?.subjectId ?? "") ?? "này"} của {dropTarget?.student.student.fullName ?? "học viên"}?
        </Typography>
        {dropTarget?.hasFee && <>
          <Typography variant="body2" color="warning.main" sx={{ mb: 1 }}>
            Học phí đã phát sinh sẽ được giữ nguyên cho kỳ hiện tại; các kỳ sau không tạo thêm phí môn này.
          </Typography>
          <TextField fullWidth required label="Lý do force cancel" value={dropReason} onChange={(event) => setDropReason(event.target.value)} multiline minRows={2} inputProps={{ maxLength: 500 }} />
        </>}
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={() => setDropTarget(null)} disabled={busy}>Hủy</Button>
        <Button variant="contained" color="error" onClick={() => void dropSubject()} disabled={busy || Boolean(dropTarget?.hasFee && !dropReason.trim())}>{busy ? "Đang xử lý..." : dropTarget?.hasFee ? "Force cancel" : "Bỏ môn"}</Button>
      </DialogActions>
    </Dialog>
    <Dialog open={Boolean(deleteTarget)} onClose={() => !busy && setDeleteTarget(null)} fullWidth maxWidth="sm">
      <DialogTitle>{deleteTarget?.tuitionFees.length ? "Force rời lớp" : "Rời lớp"}</DialogTitle>
      <DialogContent>
        <Typography sx={{ mb: 1 }}>
          {deleteTarget?.student.fullName ?? "Học viên này"} sẽ rời khỏi lớp và các môn đang đăng ký sẽ được đánh dấu đã bỏ.
        </Typography>
        {deleteTarget?.tuitionFees.length ? <>
          <Typography variant="body2" color="warning.main" sx={{ mb: 1 }}>
            Học phí đã phát sinh sẽ được giữ nguyên để bảo toàn lịch sử. Thao tác force cần lý do.
          </Typography>
          <TextField fullWidth required label="Lý do force rời lớp" value={deleteReason} onChange={(event) => setDeleteReason(event.target.value)} multiline minRows={2} inputProps={{ maxLength: 500 }} />
        </> : null}
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={() => setDeleteTarget(null)} disabled={busy}>Hủy</Button>
        <Button variant="contained" color="error" onClick={() => void deleteStudent()} disabled={busy || Boolean(deleteTarget?.tuitionFees.length && !deleteReason.trim())}>{busy ? "Đang xử lý..." : deleteTarget?.tuitionFees.length ? "Force rời lớp" : "Rời lớp"}</Button>
      </DialogActions>
    </Dialog>
    <ConfirmDialog
      open={Boolean(pauseCancelTarget)}
      title="Hủy thời gian tạm nghỉ"
      message="Sau khi hủy, học viên có thể phát sinh học phí trong khoảng tháng này. Bạn có chắc chắn muốn tiếp tục?"
      confirmLabel="Hủy thời gian nghỉ"
      isLoading={busy}
      onCancel={() => setPauseCancelTarget(null)}
      onConfirm={() => {
        if (pauseCancelTarget) {
          void cancelPause(pauseCancelTarget.student, pauseCancelTarget.pauseId);
        }
      }}
    />
    {Snackbar}
  </Stack>;
}
