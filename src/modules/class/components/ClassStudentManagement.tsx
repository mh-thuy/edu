"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
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
import { extractApiErrorMessage, unwrapApiResponse } from "@/lib/api-client";
import { useSnackbar } from "@/hooks/useSnackbar";

type ClassSubject = {
  id: string;
  tuitionFee: number;
  subject: { id: string; name: string };
};

type ClassData = { id: string; code: string; name: string; classSubjects: ClassSubject[] };
type EnrollmentPause = { id: string; startMonth: string; endMonth: string; reason: string | null };
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
  const [dropTarget, setDropTarget] = useState<{ student: StudentRow; subjectId: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StudentRow | null>(null);
  const [pauseTarget, setPauseTarget] = useState<StudentRow | null>(null);
  const [pauseStart, setPauseStart] = useState(currentMonth);
  const [pauseEnd, setPauseEnd] = useState(currentMonth);
  const [pauseReason, setPauseReason] = useState("");
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
  const getPause = (student: StudentRow) => student.pauses.find((pause) => monthValue(pause.startMonth) <= month && monthValue(pause.endMonth) >= month);
  const getFee = (student: StudentRow) => {
    const [year, selectedMonth] = month.split("-").map(Number);
    return student.tuitionFees.find((fee) => fee.billingType === "MONTHLY" && fee.billingYear === year && fee.billingMonth === selectedMonth);
  };
  const visibleStudents = students.filter((student) => {
    const text = `${student.student.code} ${student.student.fullName} ${student.student.phone ?? ""}`.toLowerCase();
    const subjectMatch = subjectFilter === "ALL" || student.subjects.some((item) => item.classSubjectId === subjectFilter);
    const pause = getPause(student);
    const status = pause ? "PAUSED" : "ACTIVE";
    return text.includes(search.trim().toLowerCase()) && subjectMatch && (statusFilter === "ALL" || status === statusFilter);
  });
  const activeCount = students.filter((student) => !getPause(student)).length;
  const pausedCount = students.filter((student) => Boolean(getPause(student))).length;
  const createdCount = students.filter((student) => Boolean(getFee(student))).length;
  const uncreatedCount = students.length - createdCount - pausedCount;

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
    setBusy(true);
    try {
      const response = await fetch(`/api/classes/${id}/students/${dropTarget.student.studentId}/subjects/${dropTarget.subjectId}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không thể bỏ môn"));
      setDropTarget(null);
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
    setBusy(true);
    try {
      const response = await fetch(`/api/classes/${id}/students`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: deleteTarget.studentId }),
      });
      if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không thể xóa học viên"));
      setDeleteTarget(null);
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
    setBusy(true);
    try {
      const response = await fetch(`/api/classes/${id}/students/${pauseTarget.studentId}/pause`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startMonth: pauseStart, endMonth: pauseEnd, reason: pauseReason }),
      });
      if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không thể tạo thời gian tạm nghỉ"));
      setPauseTarget(null);
      setPauseReason("");
      await load();
      showSuccess("Đã ghi nhận thời gian tạm nghỉ");
    } catch (reason) {
      showError(reason instanceof Error ? reason.message : "Không thể tạo thời gian tạm nghỉ");
    } finally {
      setBusy(false);
    }
  }

  if (!classData && loading) return <Typography>Đang tải quản lý học viên...</Typography>;
  if (!classData) return <Alert severity="error">{error || "Không tìm thấy lớp học"}</Alert>;

  return <Stack spacing={2}>
    <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={1}>
      <Stack>
        <Button component={Link} href={`/admin/classes/${id}`} sx={{ alignSelf: "flex-start", px: 0 }}>← Chi tiết lớp</Button>
        <Typography variant="h5" fontWeight={700}>Quản lý học viên</Typography>
        <Typography color="text.secondary">{classData.code} — {classData.name}</Typography>
      </Stack>
      <Button variant="contained" onClick={() => setStudentPickerOpen(true)} disabled={!classData.classSubjects.length}>Đăng ký học viên</Button>
    </Stack>
    {error && <Alert severity="error">{error}</Alert>}
    <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
      {[["Tổng số", students.length], ["Đang học", activeCount], ["Tạm nghỉ", pausedCount], ["Chưa tạo phí", Math.max(0, uncreatedCount)]].map(([label, value]) => <Paper key={String(label)} sx={{ p: 2, flex: 1 }}><Typography variant="body2" color="text.secondary">{label}</Typography><Typography variant="h5" fontWeight={700}>{value}</Typography></Paper>)}
    </Stack>
    <Paper sx={{ p: 2 }}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ md: "center" }}>
        <TextField size="small" label="Tìm mã, tên, số điện thoại" value={search} onChange={(event) => setSearch(event.target.value)} sx={{ minWidth: 280, flex: 1 }} />
        <FormControl size="small" sx={{ minWidth: 150 }}><InputLabel>Trạng thái</InputLabel><Select label="Trạng thái" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><MenuItem value="ALL">Tất cả</MenuItem><MenuItem value="ACTIVE">Đang học</MenuItem><MenuItem value="PAUSED">Tạm nghỉ</MenuItem></Select></FormControl>
        <FormControl size="small" sx={{ minWidth: 170 }}><InputLabel>Môn học</InputLabel><Select label="Môn học" value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value)}><MenuItem value="ALL">Tất cả môn</MenuItem>{classData.classSubjects.map((subject) => <MenuItem key={subject.id} value={subject.id}>{subject.subject.name}</MenuItem>)}</Select></FormControl>
        <TextField size="small" label="Kỳ học phí" type="month" value={month} onChange={(event) => setMonth(event.target.value)} InputLabelProps={{ shrink: true }} />
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
            <TableCell>{pause ? <Chip size="small" color="info" label={`Tạm nghỉ đến ${monthValue(pause.endMonth)}`} /> : <Chip size="small" color="success" label="Đang học" />}</TableCell>
            <TableCell>{pause ? <Chip size="small" label="Không phát sinh" /> : fee ? <Chip size="small" color="success" label={fee.status === "PAID" ? "Đã thanh toán" : "Đã tạo"} /> : <Chip size="small" color="warning" label="Chưa tạo" />}</TableCell>
            <TableCell align="right"><Stack direction="row" spacing={1} justifyContent="flex-end"><Button size="small" onClick={() => setSelectedStudent(student)}>Xem</Button><Button size="small" onClick={() => openSubjectDialog({ id: student.studentId, code: student.student.code, fullName: student.student.fullName }, student)}>Quản lý môn</Button></Stack></TableCell>
          </TableRow>;
        })}{!visibleStudents.length && <TableRow><TableCell colSpan={6}><Typography sx={{ p: 4, textAlign: "center" }} color="text.secondary">Không có học viên phù hợp</Typography></TableCell></TableRow>}</TableBody>
      </Table>
    </Paper>
    <StudentSelectDialog open={studentPickerOpen} onClose={() => setStudentPickerOpen(false)} onSelect={(student) => { setStudentPickerOpen(false); openSubjectDialog(student); }} />
    <Dialog open={subjectDialogOpen} onClose={() => !busy && setSubjectDialogOpen(false)} fullWidth maxWidth="sm">
      <DialogTitle>{registeredSubjectIds.length ? "Quản lý môn học" : "Đăng ký học viên"}</DialogTitle>
      <DialogContent><Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{pendingStudent?.fullName} — Chọn các môn đang học</Typography><Stack spacing={1}>{classData.classSubjects.map((subject) => { const checked = selectedSubjectIds.includes(subject.id); const registered = registeredSubjectIds.includes(subject.id); return <Button key={subject.id} variant={checked ? "contained" : "outlined"} color={registered ? "inherit" : "primary"} onClick={() => !registered && setSelectedSubjectIds((current) => checked ? current.filter((item) => item !== subject.id) : [...current, subject.id])} sx={{ justifyContent: "space-between" }}><span>{subject.subject.name}</span><span>{money(Number(subject.tuitionFee))}{registered ? " · Đang học" : ""}</span></Button>; })}</Stack></DialogContent>
      <DialogActions><Button onClick={() => setSubjectDialogOpen(false)} disabled={busy}>Hủy</Button><Button variant="contained" onClick={() => void submitSubjects()} disabled={busy || !selectedSubjectIds.length}>{busy ? "Đang lưu..." : "Lưu môn học"}</Button></DialogActions>
    </Dialog>
    <Drawer anchor="right" open={Boolean(selectedStudent)} onClose={() => setSelectedStudent(null)}>
      {selectedStudent && <Stack spacing={2} sx={{ width: { xs: "100vw", sm: 480 }, p: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start"><Stack><Typography variant="h6" fontWeight={700}>{selectedStudent.student.fullName}</Typography><Typography color="text.secondary">{selectedStudent.student.code}</Typography></Stack><Button onClick={() => setSelectedStudent(null)}>Đóng</Button></Stack>
        <Divider />
        <Stack direction="row" spacing={1}><Button variant="outlined" onClick={() => { setPauseStart(month); setPauseEnd(month); setPauseReason(""); setPauseTarget(selectedStudent); }}>Tạm nghỉ</Button><Button color="error" variant="outlined" onClick={() => setDeleteTarget(selectedStudent)} disabled={selectedStudent.tuitionFees.length > 0}>Xóa khỏi lớp</Button></Stack>
        <Typography variant="subtitle1" fontWeight={700}>Môn đăng ký</Typography>
        {selectedStudent.subjects.map((item) => <Paper key={item.classSubjectId} variant="outlined" sx={{ p: 1.5 }}><Stack direction="row" justifyContent="space-between" alignItems="center"><Stack><Typography fontWeight={600}>{subjectName.get(item.classSubjectId)}</Typography><Typography variant="caption" color="text.secondary">{money(Number(classData.classSubjects.find((subject) => subject.id === item.classSubjectId)?.tuitionFee ?? 0))}/tháng</Typography></Stack><Button size="small" color="error" onClick={() => setDropTarget({ student: selectedStudent, subjectId: item.classSubjectId })}>Bỏ môn</Button></Stack></Paper>)}
        <Button variant="contained" onClick={() => openSubjectDialog({ id: selectedStudent.studentId, code: selectedStudent.student.code, fullName: selectedStudent.student.fullName }, selectedStudent)}>Thêm môn</Button>
        <Divider />
        <Typography variant="subtitle1" fontWeight={700}>Học phí {month}</Typography>
        <Typography variant="h5">{money(selectedStudent.subjects.reduce((total, item) => total + Number(classData.classSubjects.find((subject) => subject.id === item.classSubjectId)?.tuitionFee ?? 0), 0))}</Typography>
        <Typography variant="body2" color="text.secondary">Đăng ký học viên và tạo học phí là hai thao tác độc lập.</Typography>
      </Stack>}
    </Drawer>
    <Dialog open={Boolean(pauseTarget)} onClose={() => !busy && setPauseTarget(null)} fullWidth maxWidth="sm"><DialogTitle>Tạm nghỉ học</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}><Typography>{pauseTarget?.student.fullName}</Typography><Stack direction="row" spacing={1}><TextField fullWidth label="Từ tháng" type="month" value={pauseStart} onChange={(event) => setPauseStart(event.target.value)} InputLabelProps={{ shrink: true }} /><TextField fullWidth label="Đến tháng" type="month" value={pauseEnd} onChange={(event) => setPauseEnd(event.target.value)} InputLabelProps={{ shrink: true }} /></Stack><TextField fullWidth label="Lý do" multiline minRows={2} value={pauseReason} onChange={(event) => setPauseReason(event.target.value)} /></Stack></DialogContent><DialogActions><Button onClick={() => setPauseTarget(null)} disabled={busy}>Hủy</Button><Button variant="contained" onClick={() => void pauseStudent()} disabled={busy}>Xác nhận tạm nghỉ</Button></DialogActions></Dialog>
    <ConfirmDialog open={Boolean(dropTarget)} title="Bỏ môn học" message={`Bỏ môn ${subjectName.get(dropTarget?.subjectId ?? "") ?? "này"} của ${dropTarget?.student.student.fullName ?? "học viên"}? Nếu học phí kỳ ${month} đã phát sinh, khoản phí hiện tại sẽ được giữ nguyên.`} onConfirm={() => void dropSubject()} onCancel={() => setDropTarget(null)} isLoading={busy} confirmLabel="Bỏ môn" />
    <ConfirmDialog open={Boolean(deleteTarget)} title="Xóa học viên khỏi lớp" message={`Xóa ${deleteTarget?.student.fullName ?? "học viên này"} khỏi lớp? Thao tác này chỉ thực hiện được khi chưa phát sinh học phí.`} onConfirm={() => void deleteStudent()} onCancel={() => setDeleteTarget(null)} isLoading={busy} confirmLabel="Xóa" />
    {Snackbar}
  </Stack>;
}
