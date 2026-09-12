"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
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
  Select,
  Typography,
} from "@mui/material";
import Link from "next/link";
import { ClassSchedulePanel } from "./ClassSchedulePanel";
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
import { ConfirmDialog } from "@/components/shared/dialogs/ConfirmDialog";
import { getVietnamMonth } from "@/lib/vietnam-time";
import { AppNumberField } from "@/components/shared/forms/AppTextField";

type ClassSubject = {
  id: string;
  teacherId: string | null;
  tuitionFee: number;
  totalSessions: number;
  maxStudents: number | null;
  subject: { id: string; name: string; status?: "ACTIVE" | "INACTIVE" };
  teacher?: {
    id: string;
    code: string;
    fullName: string;
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
  tuitionFees: Array<{
    id: string;
    status: string;
    billingYear: number;
    billingMonth: number;
    billingType: string;
    items: Array<{ classSubjectId: string | null }>;
  }>;
};

type SubjectOption = { id: string; name: string; status?: "ACTIVE" | "INACTIVE" };

export function ClassDetailPanel({ id }: { id: string }) {
  const [classData, setClassData] = useState<ClassData | null>(null);
  const [subjectOptions, setSubjectOptions] = useState<SubjectOption[]>([]);
  const [classStudents, setClassStudents] = useState<ClassStudent[]>([]);
  const [feeTotal, setFeeTotal] = useState(0);
  const [outstandingFeeTotal, setOutstandingFeeTotal] = useState(0);
  const [tab, setTab] = useState(0);
  const billingMonth = getVietnamMonth();
  const [teacherDialogOpen, setTeacherDialogOpen] = useState(false);
  const [manageSubjectDialogOpen, setManageSubjectDialogOpen] = useState(false);
  const [removeSubjectTarget, setRemoveSubjectTarget] = useState<ClassSubject | null>(null);
  const [editingSubject, setEditingSubject] = useState<ClassSubject | null>(
    null,
  );
  const [selectedCatalogSubjectId, setSelectedCatalogSubjectId] = useState("");
  const [selectedTeacher, setSelectedTeacher] =
    useState<MasterSelectValue | null>(null);
  const [subjectFee, setSubjectFee] = useState(0);
  const [subjectSessions, setSubjectSessions] = useState(0);
  const [subjectMaxStudents, setSubjectMaxStudents] = useState<number | null>(null);
  const [savingSubject, setSavingSubject] = useState(false);
  const [error, setError] = useState("");
  const [loadingRelated, setLoadingRelated] = useState(true);
  const classLocked = classData?.status === "COMPLETED" || classData?.status === "CANCELLED";
  const load = useCallback(async () => {
    setLoadingRelated(true);
    try {
      const response = await fetch(`/api/classes/${id}`);
      if (!response.ok) {
        setError(await extractApiErrorMessage(response, "Không thể tải lớp học"));
        return;
      }
      const data = await unwrapApiResponse<ClassData>(response);
      setClassData(data);
    const [studentsResponse, subjectsResponse, feeResponse, unpaidResponse, overdueResponse] =
      await Promise.all([
        fetch(`/api/classes/${id}/students`),
        fetch("/api/subjects?includeInactive=true"),
        fetch(
          `/api/tuition-fees?classId=${id}&month=${encodeURIComponent(billingMonth)}&billingType=MONTHLY&page=1&pageSize=1`,
        ),
        fetch(
          `/api/tuition-fees?classId=${id}&month=${encodeURIComponent(billingMonth)}&billingType=MONTHLY&status=UNPAID&page=1&pageSize=1`,
        ),
        fetch(
          `/api/tuition-fees?classId=${id}&month=${encodeURIComponent(billingMonth)}&billingType=MONTHLY&status=OVERDUE&page=1&pageSize=1`,
        ),
      ]);

    const relatedErrors: string[] = [];
    if (studentsResponse.ok) {
      setClassStudents(await unwrapApiResponse<ClassStudent[]>(studentsResponse));
    } else {
      relatedErrors.push(
        await extractApiErrorMessage(studentsResponse, "Không thể tải danh sách học viên"),
      );
    }
    if (subjectsResponse.ok) {
      setSubjectOptions(await unwrapApiResponse<SubjectOption[]>(subjectsResponse));
    } else {
      relatedErrors.push(
        await extractApiErrorMessage(subjectsResponse, "Không thể tải danh mục môn học"),
      );
    }
    if (feeResponse.ok) {
      const feeResult = await unwrapApiResponse<{ items: unknown[]; total: number }>(feeResponse);
      setFeeTotal(feeResult.total);
    } else {
      relatedErrors.push(
        await extractApiErrorMessage(feeResponse, "Không thể tải tổng học phí"),
      );
    }

    let outstandingTotal = 0;
    if (unpaidResponse.ok) {
      outstandingTotal += (await unwrapApiResponse<{ total: number }>(unpaidResponse)).total;
    } else {
      relatedErrors.push(
        await extractApiErrorMessage(unpaidResponse, "Không thể tải học phí chưa thu"),
      );
    }
    if (overdueResponse.ok) {
      outstandingTotal += (await unwrapApiResponse<{ total: number }>(overdueResponse)).total;
    } else {
      relatedErrors.push(
        await extractApiErrorMessage(overdueResponse, "Không thể tải học phí quá hạn"),
      );
    }
      setOutstandingFeeTotal(outstandingTotal);
      setError(relatedErrors.join(" · "));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể tải dữ liệu lớp học");
    } finally {
      setLoadingRelated(false);
    }
  }, [billingMonth, id]);

  async function addSubjectToClass() {
    if (!selectedCatalogSubjectId) return;
    if (!Number.isFinite(subjectFee) || subjectFee <= 0) {
      setError("Học phí phải lớn hơn 0");
      return;
    }
    if (!Number.isInteger(subjectSessions) || subjectSessions < 0) {
      setError("Tổng số buổi phải là số nguyên không âm");
      return;
    }
    if (
      subjectMaxStudents !== null &&
      (!Number.isInteger(subjectMaxStudents) || subjectMaxStudents < 1)
    ) {
      setError("Số học viên tối đa phải là số nguyên lớn hơn 0");
      return;
    }
    setSavingSubject(true);
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
            maxStudents: subjectMaxStudents,
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
      setSubjectMaxStudents(null);
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không thể thêm môn học",
      );
    } finally {
      setSavingSubject(false);
    }
  }

  function openAddSubjectDialog() {
    setEditingSubject(null);
    setSelectedCatalogSubjectId("");
    setSelectedTeacher(null);
    setSubjectFee(0);
    setSubjectSessions(0);
    setSubjectMaxStudents(null);
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
            name: subject.teacher.fullName,
          }
        : null,
    );
    setSubjectFee(Number(subject.tuitionFee));
    setSubjectSessions(subject.totalSessions);
    setSubjectMaxStudents(subject.maxStudents);
    setManageSubjectDialogOpen(true);
  }

  async function removeSubject(subject: ClassSubject) {
    setSavingSubject(true);
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
      setRemoveSubjectTarget(null);
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không thể xóa môn học",
      );
    } finally {
      setSavingSubject(false);
    }
  }

  useEffect(() => {
    void load();
  }, [load]);
  if (error && !classData) return <Alert severity="error">{error}</Alert>;
  if (!classData) return <Typography>Đang tải lớp học...</Typography>;

  const statusLabel: Record<string, string> = {
    ACTIVE: "Đang hoạt động",
    DRAFT: "Bản nháp",
    COMPLETED: "Đã hoàn thành",
    CANCELLED: "Đã hủy",
  };
  const statusColor: Record<string, "success" | "default" | "info" | "error"> = {
    ACTIVE: "success",
    DRAFT: "default",
    COMPLETED: "info",
    CANCELLED: "error",
  };
  const formatDate = (value?: string | null) => value ? new Date(value).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "Chưa xác định";

  return (
    <Stack spacing={{ xs: 2, md: 3 }} width="100%">
      <Paper sx={{ p: { xs: 2, md: 3 } }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          justifyContent="space-between"
          alignItems={{ md: "center" }}
          gap={2}
        >
          <Stack spacing={0.75}>
          <Typography variant="h5" fontWeight={700}>
            {classData.code} — {classData.name}
          </Typography>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Typography color="text.secondary">
                Quản lý môn học, học viên và lịch học theo lớp
              </Typography>
              <Chip size="small" color={statusColor[classData.status] ?? "default"} label={statusLabel[classData.status] ?? classData.status} />
            </Stack>
            <Typography variant="body2" color="text.secondary">
              Thời gian: {formatDate(classData.startDate)} — {formatDate(classData.endDate)}
            </Typography>
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Button component={Link} href={`/admin/classes/${id}/students`} variant="contained">
              Quản lý học viên
            </Button>
            <Button component={Link} href={`/admin/classes/${id}/tuition`} variant="outlined">
              Học phí tháng
            </Button>
            <Button component={Link} href="/admin/classes" variant="outlined">
              Quay lại
            </Button>
          </Stack>
        </Stack>
      </Paper>
      {error && <Alert severity="error">{error}</Alert>}
      <Paper sx={{ overflowX: "auto" }}>
        <Tabs
          value={tab}
          onChange={(_, value) => setTab(value)}
          variant="scrollable"
        >
          <Tab label="Tổng quan" />
          <Tab label="Môn học" />
          <Tab label="Lịch học" />
        </Tabs>
      </Paper>
      {tab === 0 && (
        <Stack spacing={1.5}>
          <Typography variant="body2" color="text.secondary">
            Số liệu học phí kỳ {billingMonth}
          </Typography>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" },
              gap: 2,
            }}
          >
          {[
            ["Môn học", classData.classSubjects.length],
            ["Học viên", classStudents.length],
            ["Số khoản học phí", feeTotal],
            ["Số khoản chưa thu", outstandingFeeTotal],
          ].map(([label, value]) => (
            <Paper key={String(label)} sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary">
                {label}
              </Typography>
              <Typography variant="h5" fontWeight={700}>
                {loadingRelated ? <CircularProgress size={22} /> : value}
              </Typography>
            </Paper>
          ))}
          </Box>
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
            <Button variant="contained" onClick={openAddSubjectDialog} disabled={classLocked || savingSubject || loadingRelated}>
              Thêm môn học
            </Button>
          </Stack>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Môn học</TableCell>
                <TableCell>Giáo viên</TableCell>
                <TableCell align="right">Học phí</TableCell>
                <TableCell align="center">Số buổi</TableCell>
                <TableCell align="center">Số học viên tối đa</TableCell>
                <TableCell align="right">Thao tác</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loadingRelated ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <CircularProgress size={24} sx={{ my: 2 }} />
                  </TableCell>
                </TableRow>
              ) : classData.classSubjects.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.subject.name}</TableCell>
                  <TableCell>
                    {item.teacher?.fullName || "Chưa phân công"}
                  </TableCell>
                  <TableCell align="right">
                    {Number(item.tuitionFee).toLocaleString("vi-VN")} VND
                  </TableCell>
                  <TableCell align="center">{item.totalSessions}</TableCell>
                  <TableCell align="center">{item.maxStudents ?? "Không giới hạn"}</TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => openEditSubjectDialog(item)}
                      disabled={classLocked || savingSubject}
                    >
                      Sửa
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      variant="outlined"
                      onClick={() => setRemoveSubjectTarget(item)}
                      disabled={classLocked || savingSubject}
                    >
                      Xóa
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!loadingRelated && !classData.classSubjects.length && (
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
        <ClassSchedulePanel
          classId={classData.id}
          classSubjects={classData.classSubjects}
          readOnly={classLocked}
        />
      )}
      <Dialog
        open={manageSubjectDialogOpen}
        onClose={() => !savingSubject && setManageSubjectDialogOpen(false)}
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
                      (option.status !== "INACTIVE" &&
                        !classData.classSubjects.some(
                          (item) => item.subject.id === option.id,
                        )),
                  )
                  .map((option) => (
                    <MenuItem key={option.id} value={option.id}>
                      {option.name}{option.status === "INACTIVE" ? " · Ngừng hoạt động" : ""}
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>
            <MasterSelectField
              label="Giáo viên"
              value={selectedTeacher}
              onOpen={() => setTeacherDialogOpen(true)}
              codeLabel="Mã GV"
              nameLabel="Họ tên"
            />
            <Typography variant="caption" color="text.secondary" sx={{ mt: -1 }}>
              Có thể phân công giáo viên sau; cần phân công trước khi tạo lịch học.
            </Typography>
            <CurrencyInput
              label="Học phí"
              value={subjectFee}
              onChange={setSubjectFee}
            />
            <AppNumberField
              label="Tổng số buổi"
              inputProps={{ min: 0, step: 1 }}
              value={subjectSessions}
              onChange={(event) =>
                setSubjectSessions(Number(event.target.value || 0))
              }
              fullWidth
            />
            <AppNumberField
              label="Số học viên tối đa"
              inputProps={{ min: 1, step: 1 }}
              value={subjectMaxStudents ?? ""}
              onChange={(event) => {
                const value = event.target.value;
                setSubjectMaxStudents(value ? Number(value) : null);
              }}
              helperText="Để trống nếu không giới hạn"
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            variant="outlined"
            onClick={() => {
              setManageSubjectDialogOpen(false);
              setEditingSubject(null);
            }}
            disabled={savingSubject}
          >
            Hủy
          </Button>
          <Button
            variant="contained"
            onClick={() => void addSubjectToClass()}
            disabled={
              savingSubject ||
              !selectedCatalogSubjectId ||
              subjectFee <= 0 ||
              subjectSessions < 0 ||
              (subjectMaxStudents !== null && subjectMaxStudents < 1)
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
      <ConfirmDialog
        open={Boolean(removeSubjectTarget)}
        title="Xóa môn khỏi lớp"
        message={`Xóa môn ${removeSubjectTarget?.subject.name ?? "này"} khỏi lớp? Chỉ thực hiện được khi môn chưa có học viên đăng ký, lịch học hoặc học phí.`}
        onConfirm={() => {
          if (removeSubjectTarget) void removeSubject(removeSubjectTarget);
        }}
        onCancel={() => setRemoveSubjectTarget(null)}
        isLoading={savingSubject}
        confirmLabel="Xóa môn"
      />
    </Stack>
  );
}
