"use client";

import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Divider,
  FormControlLabel,
  Paper,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Typography,
} from "@mui/material";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ClassSelectDialog, type ClassItem } from "@/components/shared/dialogs/ClassSelectDialog";
import { StudentSelectDialog, type StudentItem } from "@/components/shared/dialogs/StudentSelectDialog";
import { FormDialog } from "@/components/shared/dialogs/FormDialog";
import { StudentForm } from "@/modules/student/components/StudentForm";
import { studentCreateSchema } from "@/modules/student/schemas/student.schema";
import { MonthPickerField } from "@/components/shared/forms/MonthPickerField";
import { PageHeader } from "@/components/shared/PageHeader";
import { useSnackbar } from "@/hooks/useSnackbar";
import { extractApiErrorMessage, unwrapApiResponse } from "@/lib/api-client";
import { getVietnamMonth } from "@/lib/vietnam-time";
import { clampMonth } from "@/utils/date";
import type { z } from "zod";

type StudentFormData = z.infer<typeof studentCreateSchema>;
type ClassSubject = {
  id: string;
  status: "ACTIVE" | "INACTIVE" | "COMPLETED";
  tuitionFee: number | string;
  maxStudents: number | null;
  subject: { id: string; name: string; status: "ACTIVE" | "INACTIVE" };
};
type ClassDetail = ClassItem & {
  status: "ACTIVE" | "DRAFT" | "COMPLETED" | "CANCELLED";
  startDate?: string | null;
  endDate?: string | null;
  classSubjects: ClassSubject[];
};
type CreatedTuitionFee = { id: string; feeNo?: string; finalAmount?: number | string };

const steps = ["Chọn lớp", "Chọn học viên", "Đăng ký môn", "Tạo học phí"];
const money = (value: number) => `${new Intl.NumberFormat("vi-VN").format(value)} VND`;

export function EnrollmentRegistrationPage() {
  const [step, setStep] = useState(0);
  const [selectedClass, setSelectedClass] = useState<ClassDetail | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<StudentItem | null>(null);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [month, setMonth] = useState(getVietnamMonth());
  const [classDialogOpen, setClassDialogOpen] = useState(false);
  const [studentDialogOpen, setStudentDialogOpen] = useState(false);
  const [studentFormOpen, setStudentFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [enrollmentCreated, setEnrollmentCreated] = useState(false);
  const [tuitionFee, setTuitionFee] = useState<CreatedTuitionFee | null>(null);
  const [tuitionSkipped, setTuitionSkipped] = useState(false);
  const { showSuccess, showError, Snackbar } = useSnackbar();

  const activeSubjects = useMemo(
    () => (selectedClass?.classSubjects ?? []).filter(
      (item) => item.status === "ACTIVE" && item.subject.status === "ACTIVE",
    ),
    [selectedClass],
  );
  const selectedSubjects = activeSubjects.filter((item) => selectedSubjectIds.includes(item.id));
  const monthlyAmount = selectedSubjects.reduce((sum, item) => sum + Number(item.tuitionFee), 0);
  const monthMin = selectedClass?.startDate?.slice(0, 7);
  const monthMax = selectedClass?.endDate?.slice(0, 7);

  async function handleSelectClass(classItem: ClassItem) {
    setBusy(true);
    try {
      const response = await fetch(`/api/classes/${classItem.id}`);
      if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không thể tải thông tin lớp"));
      const classDetail = await unwrapApiResponse<ClassDetail>(response);
      if (classDetail.status !== "ACTIVE") {
        throw new Error("Chỉ có thể đăng ký vào lớp đang hoạt động");
      }
      setSelectedClass(classDetail);
      setSelectedStudent(null);
      setSelectedSubjectIds([]);
      setEnrollmentCreated(false);
      setTuitionFee(null);
      setTuitionSkipped(false);
      setMonth(clampMonth(getVietnamMonth(), classDetail.startDate?.slice(0, 7), classDetail.endDate?.slice(0, 7)));
      setStep(1);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể chọn lớp");
    } finally {
      setBusy(false);
    }
  }

  async function createStudent(formData: StudentFormData) {
    setBusy(true);
    try {
      const response = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, status: "ACTIVE" }),
      });
      if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không thể tạo hồ sơ học viên"));
      const student = await unwrapApiResponse<StudentItem>(response);
      setSelectedStudent(student);
      setStudentFormOpen(false);
      setStep(2);
      showSuccess("Đã lưu hồ sơ học viên. Tiếp tục chọn môn đăng ký.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể tạo hồ sơ học viên");
    } finally {
      setBusy(false);
    }
  }

  function handleSelectStudent(student: StudentItem) {
    setSelectedStudent(student);
    setSelectedSubjectIds([]);
    setStep(2);
  }

  async function registerStudent() {
    if (!selectedClass || !selectedStudent || selectedSubjectIds.length === 0) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/classes/${selectedClass.id}/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: selectedStudent.id, classSubjectIds: selectedSubjectIds }),
      });
      if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không thể đăng ký học viên vào lớp"));
      setEnrollmentCreated(true);
      setStep(3);
      showSuccess("Đã đăng ký học viên vào lớp. Bạn có thể tạo học phí riêng cho kỳ đã chọn.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể đăng ký học viên vào lớp");
    } finally {
      setBusy(false);
    }
  }

  async function createTuitionFee() {
    if (!selectedClass || !selectedStudent || !enrollmentCreated || !month) return;
    setBusy(true);
    try {
      const response = await fetch(
        `/api/classes/${selectedClass.id}/students/${selectedStudent.id}/tuition-fee?month=${encodeURIComponent(month)}`,
        { method: "POST" },
      );
      if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không thể tạo học phí"));
      setTuitionFee(await unwrapApiResponse<CreatedTuitionFee>(response));
      setTuitionSkipped(false);
      showSuccess(`Đã tạo học phí kỳ ${month}.`);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể tạo học phí");
    } finally {
      setBusy(false);
    }
  }

  function startNewRegistration() {
    setStep(0);
    setSelectedClass(null);
    setSelectedStudent(null);
    setSelectedSubjectIds([]);
    setEnrollmentCreated(false);
    setTuitionFee(null);
    setTuitionSkipped(false);
    setMonth(getVietnamMonth());
  }

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Đăng ký học"
        description="Chọn lớp, đăng ký môn cho học viên và tạo học phí tháng khi cần."
      />
      <Paper sx={{ p: { xs: 2, md: 3 } }}>
        <Stepper activeStep={step} alternativeLabel sx={{ mb: 3 }}>
          {steps.map((label) => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
        </Stepper>

        {step === 0 && (
          <Stack spacing={2} alignItems="flex-start">
            <Typography variant="h6">Chọn lớp đang hoạt động</Typography>
            <Typography color="text.secondary">Chỉ lớp đang hoạt động nhận đăng ký mới.</Typography>
            {selectedClass && <Chip label={`${selectedClass.code} · ${selectedClass.name}`} color="primary" />}
            <Button variant="contained" onClick={() => setClassDialogOpen(true)} disabled={busy}>
              {busy ? "Đang tải lớp…" : selectedClass ? "Đổi lớp" : "Chọn lớp"}
            </Button>
          </Stack>
        )}

        {step === 1 && selectedClass && (
          <Stack spacing={2} alignItems="flex-start">
            <Typography variant="h6">Chọn học viên</Typography>
            <Alert severity="info">Lớp {selectedClass.code} · {selectedClass.name}. Học viên đã đăng ký lớp này sẽ không xuất hiện trong danh sách chọn.</Alert>
            {selectedStudent && <Chip label={`${selectedStudent.code} · ${selectedStudent.fullName}`} color="primary" />}
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <Button variant="outlined" onClick={() => setStep(0)} disabled={busy}>Đổi lớp</Button>
              <Button variant="contained" onClick={() => setStudentDialogOpen(true)}>Chọn học viên có sẵn</Button>
              <Button variant="outlined" onClick={() => setStudentFormOpen(true)}>Tạo hồ sơ học viên</Button>
            </Stack>
          </Stack>
        )}

        {step === 2 && selectedClass && selectedStudent && (
          <Stack spacing={2}>
            <Typography variant="h6">Chọn môn đăng ký</Typography>
            <Alert severity="info">{selectedStudent.code} · {selectedStudent.fullName} — {selectedClass.code} · {selectedClass.name}</Alert>
            {activeSubjects.length === 0 ? (
              <Alert severity="warning">Lớp chưa có môn đang hoạt động để đăng ký.</Alert>
            ) : (
              <Stack divider={<Divider flexItem />}>
                {activeSubjects.map((item) => (
                  <Box key={item.id} sx={{ py: 1 }}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={selectedSubjectIds.includes(item.id)}
                          disabled={enrollmentCreated || busy}
                          onChange={(event) => setSelectedSubjectIds((current) => event.target.checked
                            ? [...current, item.id]
                            : current.filter((id) => id !== item.id))}
                        />
                      }
                      label={<Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 0, sm: 1 }}><span>{item.subject.name}</span><Typography variant="body2" color="text.secondary">{money(Number(item.tuitionFee))}/tháng</Typography></Stack>}
                    />
                  </Box>
                ))}
              </Stack>
            )}
            {selectedSubjects.length > 0 && (
              <Alert severity="info">Học phí dự kiến mỗi tháng: <strong>{money(monthlyAmount)}</strong>. Học phí chỉ được tạo ở bước tiếp theo sau khi xác nhận riêng.</Alert>
            )}
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <Button variant="outlined" onClick={() => setStep(1)} disabled={busy}>Quay lại</Button>
              <Button variant="contained" onClick={() => void registerStudent()} disabled={busy || selectedSubjectIds.length === 0 || enrollmentCreated || activeSubjects.length === 0}>
                {busy ? "Đang đăng ký…" : "Xác nhận đăng ký môn"}
              </Button>
            </Stack>
          </Stack>
        )}

        {step === 3 && selectedClass && selectedStudent && enrollmentCreated && (
          <Stack spacing={2}>
            <Alert severity="success" icon={<CheckCircleOutlineOutlinedIcon />}>Đã đăng ký {selectedStudent.fullName} vào {selectedClass.name}.</Alert>
            <Typography variant="h6">Tạo học phí tháng (bước riêng)</Typography>
            <Typography color="text.secondary">Mức phí được tính theo các môn đang đăng ký; thao tác này không thu tiền và không tạo đợt chuyển khoản.</Typography>
            <Box sx={{ maxWidth: 320 }}>
              <MonthPickerField label="Kỳ học phí" value={month} onChange={setMonth} minMonth={monthMin} maxMonth={monthMax} textFieldProps={{ disabled: Boolean(tuitionFee) }} />
            </Box>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Stack spacing={1}>
                {selectedSubjects.map((item) => (
                  <Stack key={item.id} direction="row" justifyContent="space-between" gap={2}>
                    <Typography>{item.subject.name}</Typography>
                    <Typography>{money(Number(item.tuitionFee))}</Typography>
                  </Stack>
                ))}
                <Divider />
                <Stack direction="row" justifyContent="space-between" gap={2}>
                  <Typography fontWeight={700}>Tổng học phí tháng</Typography>
                  <Typography fontWeight={700}>{money(monthlyAmount)}</Typography>
                </Stack>
              </Stack>
            </Paper>
            {tuitionFee && <Alert severity="success">Đã tạo học phí{tuitionFee.feeNo ? ` ${tuitionFee.feeNo}` : ""} cho kỳ {month}.</Alert>}
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              {!tuitionFee && <Button variant="contained" onClick={() => void createTuitionFee()} disabled={busy || !month || selectedSubjects.length === 0}>
                {busy ? "Đang tạo học phí…" : "Xác nhận tạo học phí"}
              </Button>}
              {!tuitionFee && <Button variant="outlined" onClick={() => setTuitionSkipped(true)} disabled={busy}>Hoàn tất, chưa tạo học phí</Button>}
              {(tuitionFee || tuitionSkipped) && <Button variant="contained" onClick={startNewRegistration}>Đăng ký học viên khác</Button>}
              {tuitionFee?.id && <Button component={Link} variant="outlined" href={`/admin/tuition-fees/${tuitionFee.id}`}>Xem học phí</Button>}
              {(tuitionFee || tuitionSkipped) && <Button component={Link} variant="outlined" href={`/admin/classes/${selectedClass.id}/students`}>Quản lý học viên lớp</Button>}
            </Stack>
            {tuitionSkipped && <Alert severity="info">Enrollment đã được lưu, chưa tạo học phí. Có thể tạo phí sau từ màn hình quản lý học viên của lớp.</Alert>}
          </Stack>
        )}
      </Paper>

      <ClassSelectDialog open={classDialogOpen} onClose={() => setClassDialogOpen(false)} onSelect={(item) => void handleSelectClass(item)} activeOnly />
      {selectedClass && <StudentSelectDialog open={studentDialogOpen} onClose={() => setStudentDialogOpen(false)} onSelect={handleSelectStudent} excludeClassId={selectedClass.id} title="Chọn học viên để đăng ký" />}
      <FormDialog
        open={studentFormOpen}
        title="Tạo hồ sơ học viên"
        formId="enrollment-student-form"
        onClose={() => setStudentFormOpen(false)}
        isLoading={busy}
        submitText="Lưu và tiếp tục"
      >
        <StudentForm
          key={studentFormOpen ? "new-student" : "closed"}
          formId="enrollment-student-form"
          onSubmit={createStudent}
          defaultValues={{ status: "ACTIVE" }}
        />
      </FormDialog>
      {Snackbar}
    </Stack>
  );
}
