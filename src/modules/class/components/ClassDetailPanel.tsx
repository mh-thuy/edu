"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormControl,
  FormGroup,
  InputLabel,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Select,
  Typography,
} from "@mui/material";
import PersonAddAlt1Icon from "@mui/icons-material/PersonAddAlt1";
import Link from "next/link";
import { ClassSchedulePanel } from "./ClassSchedulePanel";
import {
  StudentSelectDialog,
  type StudentItem,
} from "@/components/shared/dialogs/StudentSelectDialog";
import {
  TeacherSelectDialog,
  type TeacherSelectValue,
} from "@/components/shared/dialogs/TeacherSelectDialog";
import {
  MasterSelectField,
  type MasterSelectValue,
} from "@/components/shared/forms/MasterSelectField";
import { CurrencyInput } from "@/components/shared/forms/CurrencyInput";
import { extractApiErrorMessage, unwrapApiResponse } from "@/lib/api-client";

type ClassSubject = {
  id: string;
  teacherId: string | null;
  tuitionFee: number;
  totalSessions: number;
  subject: { id: string; code: string; name: string };
  teacher?: {
    id: string;
    code: string;
    user?: { fullName?: string | null } | null;
  } | null;
};

type ClassData = {
  id: string;
  code: string;
  name: string;
  status: string;
  startDate?: string | null;
  endDate?: string | null;
  classSubjects: ClassSubject[];
};

type ClassStudent = {
  id: string;
  studentId: string;
  student: { code: string; fullName: string; phone?: string | null };
  subjects: Array<{ classSubjectId: string }>;
};

type SubjectOption = { id: string; code: string; name: string };

export function ClassDetailPanel({ id }: { id: string }) {
  const [classData, setClassData] = useState<ClassData | null>(null);
  const [subjectOptions, setSubjectOptions] = useState<SubjectOption[]>([]);
  const [classStudents, setClassStudents] = useState<ClassStudent[]>([]);
  const [feeTotal, setFeeTotal] = useState(0);
  const [outstandingFeeTotal, setOutstandingFeeTotal] = useState(0);
  const [tab, setTab] = useState(0);
  const [studentDialogOpen, setStudentDialogOpen] = useState(false);
  const [subjectDialogOpen, setSubjectDialogOpen] = useState(false);
  const [teacherDialogOpen, setTeacherDialogOpen] = useState(false);
  const [manageSubjectDialogOpen, setManageSubjectDialogOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<ClassSubject | null>(
    null,
  );
  const [selectedCatalogSubjectId, setSelectedCatalogSubjectId] = useState("");
  const [selectedTeacher, setSelectedTeacher] =
    useState<MasterSelectValue | null>(null);
  const [subjectFee, setSubjectFee] = useState(0);
  const [subjectSessions, setSubjectSessions] = useState(0);
  const [pendingStudent, setPendingStudent] = useState<StudentItem | null>(
    null,
  );
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [registeredSubjectIds, setRegisteredSubjectIds] = useState<string[]>([]);
  const [addingStudent, setAddingStudent] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const response = await fetch(`/api/classes/${id}`);
    if (!response.ok) {
      setError(await extractApiErrorMessage(response, "Không thể tải lớp học"));
      return;
    }
    const data = await unwrapApiResponse<ClassData>(response);
    setClassData(data);
    const studentsResponse = await fetch(`/api/classes/${id}/students`);
    if (studentsResponse.ok) {
      setClassStudents(await unwrapApiResponse<ClassStudent[]>(studentsResponse));
    }
    const subjectsResponse = await fetch("/api/subjects");
    if (subjectsResponse.ok) {
      setSubjectOptions(
        await unwrapApiResponse<SubjectOption[]>(subjectsResponse),
      );
    }
    const feeResponse = await fetch(
      `/api/tuition-fees?classId=${id}&page=1&pageSize=1`,
    );
    if (feeResponse.ok) {
      const feeResult = await unwrapApiResponse<{
        items: unknown[];
        total: number;
      }>(feeResponse);
      setFeeTotal(feeResult.total);
    }
    const [unpaidResponse, overdueResponse] = await Promise.all([
      fetch(`/api/tuition-fees?classId=${id}&status=UNPAID&page=1&pageSize=1`),
      fetch(`/api/tuition-fees?classId=${id}&status=OVERDUE&page=1&pageSize=1`),
    ]);
    const unpaid = unpaidResponse.ok ? await unwrapApiResponse<{ total: number }>(unpaidResponse) : { total: 0 };
    const overdue = overdueResponse.ok ? await unwrapApiResponse<{ total: number }>(overdueResponse) : { total: 0 };
    setOutstandingFeeTotal(unpaid.total + overdue.total);
  }, [id]);

  async function chooseStudent(student: StudentItem) {
    setStudentDialogOpen(false);
    setPendingStudent(student);
    try {
      const response = await fetch(`/api/classes/${id}/students`);
      if (response.ok) {
        const enrolled = await unwrapApiResponse<Array<{ studentId: string; subjects: Array<{ classSubjectId: string }> }>>(response);
        const registered = enrolled.find((entry) => entry.studentId === student.id)?.subjects.map((subject) => subject.classSubjectId) || [];
        setRegisteredSubjectIds(registered);
        setSelectedSubjectIds(registered);
      } else {
        setRegisteredSubjectIds([]);
        setSelectedSubjectIds([]);
      }
    } catch {
      setRegisteredSubjectIds([]);
      setSelectedSubjectIds([]);
    }
    setSubjectDialogOpen(true);
  }

  async function addStudent() {
    if (!pendingStudent || selectedSubjectIds.length === 0) return;
    setAddingStudent(true);
    setError("");
    try {
      const response = await fetch(`/api/classes/${id}/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: pendingStudent.id,
          classSubjectIds: selectedSubjectIds,
        }),
      });
      if (!response.ok)
        throw new Error(
          await extractApiErrorMessage(response, "Không thể đăng ký học sinh"),
        );
      setSubjectDialogOpen(false);
      setPendingStudent(null);
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không thể đăng ký học sinh",
      );
    } finally {
      setAddingStudent(false);
    }
  }

  async function addSubjectToClass() {
    if (!selectedCatalogSubjectId) return;
    setAddingStudent(true);
    setError("");
    try {
      const response = await fetch(
        editingSubject
          ? `/api/classes/${id}/subjects/${editingSubject.id}`
          : `/api/classes/${id}/subjects`,
        {
          method: editingSubject ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subjectId: selectedCatalogSubjectId,
            teacherId: selectedTeacher?.id,
            tuitionFee: subjectFee,
            totalSessions: subjectSessions,
          }),
        },
      );
      if (!response.ok)
        throw new Error(
          await extractApiErrorMessage(response, "Không thể thêm môn học"),
        );
      setManageSubjectDialogOpen(false);
      setEditingSubject(null);
      setSelectedCatalogSubjectId("");
      setSelectedTeacher(null);
      setSubjectFee(0);
      setSubjectSessions(0);
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không thể thêm môn học",
      );
    } finally {
      setAddingStudent(false);
    }
  }

  function openAddSubjectDialog() {
    setEditingSubject(null);
    setSelectedCatalogSubjectId("");
    setSelectedTeacher(null);
    setSubjectFee(0);
    setSubjectSessions(0);
    setManageSubjectDialogOpen(true);
  }

  function openEditSubjectDialog(subject: ClassSubject) {
    setEditingSubject(subject);
    setSelectedCatalogSubjectId(subject.subject.id);
    setSelectedTeacher(
      subject.teacher
        ? {
            id: subject.teacher.id,
            code: subject.teacher.code,
            name: subject.teacher.user?.fullName || subject.teacher.code,
          }
        : null,
    );
    setSubjectFee(Number(subject.tuitionFee));
    setSubjectSessions(subject.totalSessions);
    setManageSubjectDialogOpen(true);
  }

  async function removeSubject(subject: ClassSubject) {
    if (!window.confirm(`Xóa môn ${subject.subject.name} khỏi lớp?`)) return;
    setAddingStudent(true);
    setError("");
    try {
      const response = await fetch(
        `/api/classes/${id}/subjects/${subject.id}`,
        { method: "DELETE" },
      );
      if (!response.ok)
        throw new Error(
          await extractApiErrorMessage(response, "Không thể xóa môn học"),
        );
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không thể xóa môn học",
      );
    } finally {
      setAddingStudent(false);
    }
  }

  useEffect(() => {
    void load();
  }, [load]);
  if (error && !classData) return <Alert severity="error">{error}</Alert>;
  if (!classData) return <Typography>Đang tải lớp học...</Typography>;

  return (
    <Stack spacing={2} width="100%">
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
      >
        <Stack>
          <Typography variant="h5" fontWeight={700}>
            {classData.code} — {classData.name}
          </Typography>
          <Typography color="text.secondary">
            Quản lý môn học, đăng ký và học phí theo từng môn
          </Typography>
        </Stack>
        <Button component={Link} href="/admin/classes" variant="outlined">
          Quay lại
        </Button>
      </Stack>
      {error && <Alert severity="error">{error}</Alert>}
      <Paper>
        <Tabs
          value={tab}
          onChange={(_, value) => setTab(value)}
          variant="scrollable"
        >
          <Tab label="Tổng quan" />
          <Tab label="Môn học" />
          <Tab label="Học viên" />
          <Tab label="Lịch học" />
        </Tabs>
      </Paper>
      {tab === 0 && (
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          {[
            ["Môn học", classData.classSubjects.length],
            ["Học viên", classStudents.length],
            ["Khoản học phí", feeTotal],
            ["Khoản chưa thu", outstandingFeeTotal],
          ].map(([label, value]) => (
            <Paper key={String(label)} sx={{ p: 2, flex: 1 }}>
              <Typography variant="body2" color="text.secondary">{label}</Typography>
              <Typography variant="h5" fontWeight={700}>{value}</Typography>
            </Paper>
          ))}
        </Stack>
      )}
      {tab === 1 && (
        <Paper sx={{ overflow: "auto" }}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}
          >
            <Typography variant="h6">Các môn trong lớp</Typography>
            <Button variant="contained" onClick={openAddSubjectDialog}>
              Thêm môn học
            </Button>
          </Stack>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Mã môn</TableCell>
                <TableCell>Môn học</TableCell>
                <TableCell>Giáo viên</TableCell>
                <TableCell align="right">Học phí</TableCell>
                <TableCell align="center">Số buổi</TableCell>
                <TableCell align="right">Thao tác</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {classData.classSubjects.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.subject.code}</TableCell>
                  <TableCell>{item.subject.name}</TableCell>
                  <TableCell>
                    {item.teacher?.user?.fullName || "Chưa phân công"}
                  </TableCell>
                  <TableCell align="right">
                    {Number(item.tuitionFee).toLocaleString("vi-VN")} VND
                  </TableCell>
                  <TableCell align="center">{item.totalSessions}</TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      onClick={() => openEditSubjectDialog(item)}
                      disabled={addingStudent}
                    >
                      Sửa
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      onClick={() => void removeSubject(item)}
                      disabled={addingStudent}
                    >
                      Xóa
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!classData.classSubjects.length && (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Typography sx={{ p: 3 }} color="text.secondary">
                      Lớp chưa có môn học
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Paper>
      )}
      {tab === 2 && (
        <Paper sx={{ overflow: "auto" }}>
          <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "center" }} spacing={1} sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
            <Stack>
              <Typography variant="h6">Học viên trong lớp</Typography>
              <Typography variant="body2" color="text.secondary">Mỗi học viên có thể đăng ký một hoặc nhiều môn trong lớp</Typography>
            </Stack>
            <Button variant="contained" startIcon={<PersonAddAlt1Icon />} onClick={() => setStudentDialogOpen(true)} disabled={addingStudent || !classData.classSubjects.length}>Đăng ký học viên</Button>
          </Stack>
          <Table>
            <TableHead><TableRow><TableCell>Mã học viên</TableCell><TableCell>Họ tên</TableCell><TableCell>Môn đang học</TableCell><TableCell align="right">Thao tác</TableCell></TableRow></TableHead>
            <TableBody>
              {classStudents.map((item) => <TableRow key={item.id}><TableCell>{item.student.code}</TableCell><TableCell>{item.student.fullName}</TableCell><TableCell>{item.subjects.map((entry) => classData.classSubjects.find((subject) => subject.id === entry.classSubjectId)?.subject.name).filter(Boolean).join(", ") || "-"}</TableCell><TableCell align="right"><Button size="small" onClick={() => void chooseStudent({ id: item.studentId, code: item.student.code, fullName: item.student.fullName })}>Thêm môn</Button></TableCell></TableRow>)}
              {!classStudents.length && <TableRow><TableCell colSpan={4}><Typography sx={{ p: 3 }} textAlign="center" color="text.secondary">Chưa có học viên</Typography></TableCell></TableRow>}
            </TableBody>
          </Table>
        </Paper>
      )}
      {tab === 3 && (
        <ClassSchedulePanel
          classId={classData.id}
          classSubjects={classData.classSubjects}
        />
      )}
      {studentDialogOpen && (
        <StudentSelectDialog
          open
          onClose={() => setStudentDialogOpen(false)}
          onSelect={chooseStudent}
        />
      )}
      <Dialog
        open={manageSubjectDialogOpen}
        onClose={() => !addingStudent && setManageSubjectDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {editingSubject ? "Sửa môn trong lớp" : "Thêm môn vào lớp"}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Môn học</InputLabel>
              <Select
                value={selectedCatalogSubjectId}
                label="Môn học"
                onChange={(event) =>
                  setSelectedCatalogSubjectId(event.target.value)
                }
                disabled={Boolean(editingSubject)}
              >
                {subjectOptions
                  .filter(
                    (option) =>
                      editingSubject?.subject.id === option.id ||
                      !classData.classSubjects.some(
                        (item) => item.subject.code === option.code,
                      ),
                  )
                  .map((option) => (
                    <MenuItem key={option.id} value={option.id}>
                      {option.code} — {option.name}
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>
            <MasterSelectField
              label="Giáo viên"
              value={selectedTeacher}
              onOpen={() => setTeacherDialogOpen(true)}
              required
              codeLabel="Mã GV"
              nameLabel="Họ tên"
            />
            <CurrencyInput
              label="Học phí"
              value={subjectFee}
              onChange={setSubjectFee}
            />
            <TextField
              label="Tổng số buổi"
              type="number"
              value={subjectSessions}
              onChange={(event) =>
                setSubjectSessions(Number(event.target.value || 0))
              }
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setManageSubjectDialogOpen(false);
              setEditingSubject(null);
            }}
            disabled={addingStudent}
          >
            Hủy
          </Button>
          <Button
            variant="contained"
            onClick={() => void addSubjectToClass()}
            disabled={
              addingStudent || !selectedCatalogSubjectId || !selectedTeacher
            }
          >
            {editingSubject ? "Lưu thay đổi" : "Thêm môn"}
          </Button>
        </DialogActions>
      </Dialog>
      {teacherDialogOpen && (
        <TeacherSelectDialog
          open
          onClose={() => setTeacherDialogOpen(false)}
          onSelect={(teacher: TeacherSelectValue) => {
            setSelectedTeacher(teacher);
            setTeacherDialogOpen(false);
          }}
        />
      )}
      <Dialog
        open={subjectDialogOpen}
        onClose={() => !addingStudent && setSubjectDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Chọn môn cho {pendingStudent?.fullName}</DialogTitle>
        <DialogContent>
          <FormGroup>
            {classData.classSubjects.map((item) => (
              <FormControlLabel
                key={item.id}
                control={
                  <Checkbox
                    checked={selectedSubjectIds.includes(item.id)}
                    disabled={registeredSubjectIds.includes(item.id)}
                    onChange={(event) =>
                      setSelectedSubjectIds((current) =>
                        event.target.checked
                          ? [...current, item.id]
                          : current.filter((value) => value !== item.id),
                      )
                    }
                  />
                }
                label={`${item.subject.name} — ${Number(item.tuitionFee).toLocaleString("vi-VN")} VND${registeredSubjectIds.includes(item.id) ? " (đã đăng ký)" : ""}`}
              />
            ))}
          </FormGroup>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setSubjectDialogOpen(false)}
            disabled={addingStudent}
          >
            Hủy
          </Button>
          <Button
            variant="contained"
            onClick={() => void addStudent()}
            disabled={addingStudent || selectedSubjectIds.length === 0}
          >
            {addingStudent ? "Đang đăng ký..." : "Đăng ký và tạo học phí"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
