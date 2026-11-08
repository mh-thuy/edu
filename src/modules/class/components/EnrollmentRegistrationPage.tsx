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
import {
  ClassSelectDialog,
  type ClassItem,
} from "@/components/shared/dialogs/ClassSelectDialog";
import {
  StudentSelectDialog,
  type StudentItem,
} from "@/components/shared/dialogs/StudentSelectDialog";
import { FormDialog } from "@/components/shared/dialogs/FormDialog";
import { StudentForm } from "@/modules/student/components/StudentForm";
import { studentCreateSchema } from "@/modules/student/schemas/student.schema";
import { MonthPickerField } from "@/components/shared/forms/MonthPickerField";
import { PageHeader } from "@/components/shared/PageHeader";
import { useSnackbar } from "@/hooks/useSnackbar";
import { extractApiErrorMessage, unwrapApiResponse } from "@/lib/api-client";
import { getVietnamMonth } from "@/lib/vietnam-time";
import type { z } from "zod";

type StudentFormData = z.infer<typeof studentCreateSchema>;
type ClassSubject = {
  id: string;
  status: "ACTIVE" | "INACTIVE" | "COMPLETED";
  tuitionFee: number | string;
  subject: { id: string; name: string; status: "ACTIVE" | "INACTIVE" };
};
type ClassDetail = ClassItem & {
  status: "ACTIVE" | "DRAFT" | "COMPLETED" | "CANCELLED";
  startDate?: string | null;
  endDate?: string | null;
  classSubjects: ClassSubject[];
};
type EnrollmentPreview = {
  classId: string;
  enrollmentId: string | null;
  enrollmentStatus: "ACTIVE" | "COMPLETED" | "LEFT" | "SUSPENDED" | null;
  activeClassSubjectIds: string[];
};
type EnrollmentResult = {
  classId: string;
  status: "SUCCESS" | "FAILED";
  enrollmentId?: string;
  alreadyEnrolled?: boolean;
  message?: string;
};
type TuitionResult = {
  classId: string;
  status: "SUCCESS" | "FAILED";
  tuitionFeeId?: string;
  feeNo?: string;
  finalAmount?: number;
  message?: string;
};
type ClassWorkflow = {
  item: ClassItem;
  detail: ClassDetail | null;
  classLoadError?: string;
  enrollmentId: string | null;
  enrollmentStatus: "PENDING" | "SUCCESS" | "FAILED" | "REMOVED";
  enrollmentMessage?: string;
  existingEnrollmentStatus: EnrollmentPreview["enrollmentStatus"];
  existingSubjectIds: string[];
  selectedSubjectIds: string[];
  tuitionStatus: "PENDING" | "SUCCESS" | "FAILED";
  tuitionFeeId?: string;
  feeNo?: string;
  finalAmount?: number;
  tuitionMessage?: string;
};

const steps = ["Chọn lớp", "Chọn học viên", "Đăng ký môn", "Tạo học phí"];
const money = (value: number) =>
  new Intl.NumberFormat("vi-VN").format(value) + " VND";

function activeSubjects(item: ClassWorkflow) {
  return (item.detail?.classSubjects ?? []).filter(
    (subject) =>
      subject.status === "ACTIVE" && subject.subject.status === "ACTIVE",
  );
}

function newSubjectIds(item: ClassWorkflow) {
  return item.selectedSubjectIds.filter(
    (id) => !item.existingSubjectIds.includes(id),
  );
}

function monthIsValidForClass(item: ClassWorkflow, month: string) {
  if (!item.detail) return false;
  const start = item.detail.startDate?.slice(0, 7);
  const end = item.detail.endDate?.slice(0, 7);
  return (!start || month >= start) && (!end || month <= end);
}

export function EnrollmentRegistrationPage() {
  const [step, setStep] = useState(0);
  const [classes, setClasses] = useState<ClassWorkflow[]>([]);
  const [student, setStudent] = useState<StudentItem | null>(null);
  const [month, setMonth] = useState(getVietnamMonth());
  const [classDialogOpen, setClassDialogOpen] = useState(false);
  const [studentDialogOpen, setStudentDialogOpen] = useState(false);
  const [studentFormOpen, setStudentFormOpen] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [feesSkipped, setFeesSkipped] = useState(false);
  const [busy, setBusy] = useState(false);
  const { showSuccess, showError, Snackbar } = useSnackbar();

  const activeClasses = classes.filter(
    (item) => item.enrollmentStatus !== "REMOVED",
  );
  const enrollmentFailures = activeClasses.filter(
    (item) => item.enrollmentStatus === "FAILED" || Boolean(item.classLoadError),
  );
  const successfulClasses = activeClasses.filter(
    (item) => item.enrollmentStatus === "SUCCESS",
  );
  const feeEligible = successfulClasses.filter((item) =>
    monthIsValidForClass(item, month),
  );
  const feeIneligible = successfulClasses.filter(
    (item) => !monthIsValidForClass(item, month),
  );
  const monthLocked = classes.some(
    (item) => item.tuitionStatus === "SUCCESS",
  );
  const hasTuitionSuccess = classes.some(
    (item) => item.tuitionStatus === "SUCCESS",
  );
  const allEligibleFeesCreated = feeEligible.every(
    (item) => item.tuitionStatus === "SUCCESS",
  );
  const selectedClassIds = useMemo(
    () => activeClasses.map((item) => item.item.id),
    [activeClasses],
  );

  async function fetchClassDetail(item: ClassItem): Promise<ClassWorkflow> {
    try {
      const response = await fetch("/api/classes/" + item.id);
      if (!response.ok) {
        throw new Error(
          await extractApiErrorMessage(response, "Không thể tải lớp"),
        );
      }
      const detail = await unwrapApiResponse<ClassDetail>(response);
      if (detail.status !== "ACTIVE") {
        throw new Error("Chỉ có thể chọn lớp đang hoạt động");
      }
      return {
        item,
        detail,
        enrollmentId: null,
        enrollmentStatus: "PENDING",
        existingEnrollmentStatus: null,
        existingSubjectIds: [],
        selectedSubjectIds: [],
        tuitionStatus: "PENDING",
      };
    } catch (error) {
      return {
        item,
        detail: null,
        classLoadError:
          error instanceof Error ? error.message : "Không thể tải lớp",
        enrollmentId: null,
        enrollmentStatus: "FAILED",
        existingEnrollmentStatus: null,
        existingSubjectIds: [],
        selectedSubjectIds: [],
        tuitionStatus: "PENDING",
      };
    }
  }

  async function addClasses(items: ClassItem[]) {
    const newItems = items.filter(
      (item) => !selectedClassIds.includes(item.id),
    );
    if (newItems.length === 0) return;
    setBusy(true);
    try {
      const loaded = await Promise.all(newItems.map(fetchClassDetail));
      setClasses((current) => [...current, ...loaded]);
      setMonth(getVietnamMonth());
    } finally {
      setBusy(false);
    }
  }

  async function retryClassLoad(classId: string) {
    const current = classes.find((item) => item.item.id === classId);
    if (!current) return;
    setBusy(true);
    try {
      const loaded = await fetchClassDetail(current.item);
      setClasses((items) =>
        items.map((item) => item.item.id === classId ? loaded : item),
      );
    } finally {
      setBusy(false);
    }
  }

  function removeClass(classId: string) {
    setClasses((items) => items.filter((item) => item.item.id !== classId));
  }

  async function loadStudentPreview(selectedStudent: StudentItem) {
    setStudent(selectedStudent);
    setPreviewError("");
    setBusy(true);
    try {
      const params = new URLSearchParams({
        studentId: selectedStudent.id,
        classIds: selectedClassIds.join(","),
      });
      const response = await fetch("/api/enrollments/bulk?" + params);
      if (!response.ok) {
        throw new Error(
          await extractApiErrorMessage(
            response,
            "Không thể tải đăng ký hiện tại",
          ),
        );
      }
      const data = await unwrapApiResponse<{ results: EnrollmentPreview[] }>(
        response,
      );
      const previewByClass = new Map(
        data.results.map((result) => [result.classId, result]),
      );
      setClasses((current) =>
        current.map((item) => {
          const preview = previewByClass.get(item.item.id);
          if (!preview) return item;
          const existingSubjectIds =
            preview.enrollmentStatus === "ACTIVE"
              ? preview.activeClassSubjectIds
              : [];
          return {
            ...item,
            enrollmentId: preview.enrollmentId,
            existingEnrollmentStatus: preview.enrollmentStatus,
            existingSubjectIds,
            selectedSubjectIds: existingSubjectIds,
            enrollmentStatus: "PENDING",
            enrollmentMessage: undefined,
          };
        }),
      );
      setStep(2);
    } catch (error) {
      setPreviewError(
        error instanceof Error
          ? error.message
          : "Không thể tải đăng ký hiện tại",
      );
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
      if (!response.ok) {
        throw new Error(
          await extractApiErrorMessage(
            response,
            "Không thể tạo hồ sơ học viên",
          ),
        );
      }
      const createdStudent = await unwrapApiResponse<StudentItem>(response);
      setStudentFormOpen(false);
      showSuccess("Đã lưu hồ sơ học viên.");
      await loadStudentPreview(createdStudent);
    } catch (error) {
      showError(
        error instanceof Error
          ? error.message
          : "Không thể tạo hồ sơ học viên",
      );
    } finally {
      setBusy(false);
    }
  }

  function updateSubjects(
    classId: string,
    subjectId: string,
    checked: boolean,
  ) {
    setClasses((current) =>
      current.map((item) => {
        if (
          item.item.id !== classId ||
          item.existingSubjectIds.includes(subjectId)
        ) {
          return item;
        }
        const selectedSubjectIds = checked
          ? [...new Set([...item.selectedSubjectIds, subjectId])]
          : item.selectedSubjectIds.filter((id) => id !== subjectId);
        return {
          ...item,
          selectedSubjectIds,
          enrollmentStatus:
            item.enrollmentStatus === "FAILED"
              ? "PENDING"
              : item.enrollmentStatus,
          enrollmentMessage: undefined,
        };
      }),
    );
  }

  async function registerClasses() {
    if (!student) return;
    let nextClasses = activeClasses.map((item) => {
      const additions = newSubjectIds(item);
      if (
        item.existingEnrollmentStatus === "ACTIVE" &&
        additions.length === 0 &&
        item.detail
      ) {
        return {
          ...item,
          enrollmentStatus: "SUCCESS" as const,
          enrollmentMessage: "Các môn đang hoạt động đã được đăng ký",
        };
      }
      if (additions.length === 0 && item.enrollmentStatus !== "SUCCESS") {
        return {
          ...item,
          enrollmentStatus: "FAILED" as const,
          enrollmentMessage: "Hãy chọn ít nhất một môn",
        };
      }
      return item;
    });
    const send = nextClasses.filter(
      (item) =>
        item.detail &&
        (item.enrollmentStatus === "PENDING" ||
          item.enrollmentStatus === "FAILED") &&
        newSubjectIds(item).length > 0,
    );
    if (send.length === 0) {
      setClasses((current) =>
        current.map(
          (item) => nextClasses.find((next) => next.item.id === item.item.id) ?? item,
        ),
      );
      if (nextClasses.some((item) => item.enrollmentStatus === "FAILED")) return;
      if (nextClasses.some((item) => item.enrollmentStatus === "SUCCESS")) {
        setStep(3);
      }
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/enrollments/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: student.id,
          classes: send.map((item) => ({
            classId: item.item.id,
            classSubjectIds: newSubjectIds(item),
          })),
        }),
      });
      if (!response.ok) {
        throw new Error(
          await extractApiErrorMessage(response, "Không thể đăng ký các lớp"),
        );
      }
      const data = await unwrapApiResponse<{ results: EnrollmentResult[] }>(
        response,
      );
      const resultByClass = new Map(
        data.results.map((result) => [result.classId, result]),
      );
      nextClasses = nextClasses.map((item) => {
        const result = resultByClass.get(item.item.id);
        return result
          ? {
              ...item,
              enrollmentId: result.enrollmentId ?? item.enrollmentId,
              enrollmentStatus: result.status,
              enrollmentMessage: result.message,
            }
          : item;
      });
      setClasses((current) =>
        current.map(
          (item) => nextClasses.find((next) => next.item.id === item.item.id) ?? item,
        ),
      );
      if (nextClasses.some((item) => item.enrollmentStatus === "FAILED")) return;
      setStep(3);
      showSuccess("Đã xử lý đăng ký cho các lớp đã chọn.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Không thể đăng ký các lớp";
      nextClasses = nextClasses.map((item) =>
        send.some((sent) => sent.item.id === item.item.id)
          ? {
              ...item,
              enrollmentStatus: "FAILED",
              enrollmentMessage: message,
            }
          : item,
      );
      setClasses((current) =>
        current.map(
          (item) => nextClasses.find((next) => next.item.id === item.item.id) ?? item,
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  function changeMonth(value: string) {
    if (monthLocked) return;
    setMonth(value);
    setFeesSkipped(false);
    setClasses((current) =>
      current.map((item) => ({
        ...item,
        tuitionStatus: "PENDING",
        tuitionFeeId: undefined,
        feeNo: undefined,
        finalAmount: undefined,
        tuitionMessage: undefined,
      })),
    );
  }

  async function createTuitionFees() {
    if (!student || feeEligible.length === 0) return;
    const pending = feeEligible.filter(
      (item) => item.tuitionStatus !== "SUCCESS",
    );
    if (pending.length === 0) return;
    setBusy(true);
    try {
      const response = await fetch("/api/enrollments/bulk/tuition-fees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: student.id,
          month,
          classIds: pending.map((item) => item.item.id),
        }),
      });
      if (!response.ok) {
        throw new Error(
          await extractApiErrorMessage(
            response,
            "Không thể tạo học phí cho các lớp",
          ),
        );
      }
      const data = await unwrapApiResponse<{ results: TuitionResult[] }>(
        response,
      );
      const resultByClass = new Map(
        data.results.map((result) => [result.classId, result]),
      );
      setClasses((current) =>
        current.map((item) => {
          const result = resultByClass.get(item.item.id);
          return result
            ? {
                ...item,
                tuitionStatus: result.status,
                tuitionFeeId: result.tuitionFeeId,
                feeNo: result.feeNo,
                finalAmount: result.finalAmount,
                tuitionMessage: result.message,
              }
            : item;
        }),
      );
      if (data.results.some((result) => result.status === "SUCCESS")) {
        showSuccess("Đã tạo học phí cho các lớp xử lý thành công.");
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Không thể tạo học phí cho các lớp";
      setClasses((current) =>
        current.map((item) =>
          pending.some((sent) => sent.item.id === item.item.id)
            ? {
                ...item,
                tuitionStatus: "FAILED",
                tuitionMessage: message,
              }
            : item,
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  function startNewRegistration() {
    setStep(0);
    setClasses([]);
    setStudent(null);
    setPreviewError("");
    setMonth(getVietnamMonth());
    setFeesSkipped(false);
  }

  const classListReady =
    activeClasses.length > 0 &&
    activeClasses.every((item) => Boolean(item.detail) && !item.classLoadError);
  const hasEnrollmentWork = activeClasses.some(
    (item) =>
      item.enrollmentStatus === "PENDING" ||
      item.enrollmentStatus === "FAILED",
  );
  const canSubmitEnrollment =
    hasEnrollmentWork &&
    activeClasses.some(
      (item) =>
        item.detail &&
        (newSubjectIds(item).length > 0 ||
          item.existingEnrollmentStatus === "ACTIVE"),
    );

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Đăng ký học"
        description="Đăng ký một học viên vào nhiều lớp, chọn môn riêng cho từng lớp và tạo học phí theo kỳ."
      />
      <Paper sx={{ p: { xs: 2, md: 3 } }}>
        <Stepper activeStep={step} alternativeLabel sx={{ mb: 3 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {step === 0 && (
          <Stack spacing={2}>
            <Typography variant="h6">Chọn lớp đang hoạt động</Typography>
            <Alert severity="info">
              Chọn tối đa 50 lớp. Lựa chọn được giữ khi tìm kiếm hoặc chuyển trang.
            </Alert>
            <Button
              variant="contained"
              onClick={() => setClassDialogOpen(true)}
              disabled={busy || activeClasses.length >= 50}
            >
              {classes.length ? "Thêm lớp" : "Chọn nhiều lớp"}
            </Button>
            {classes.map((item) => (
              <Paper key={item.item.id} variant="outlined" sx={{ p: 1.5 }}>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  alignItems={{ sm: "center" }}
                  justifyContent="space-between"
                  gap={1}
                >
                  <Typography>
                    {item.item.code} · {item.item.name}
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    {item.classLoadError && (
                      <Button
                        size="small"
                        onClick={() => void retryClassLoad(item.item.id)}
                        disabled={busy}
                      >
                        Tải lại
                      </Button>
                    )}
                    <Button
                      size="small"
                      color="error"
                      onClick={() => removeClass(item.item.id)}
                      disabled={busy}
                    >
                      Bỏ lớp
                    </Button>
                  </Stack>
                </Stack>
                {item.classLoadError && (
                  <Alert severity="error" sx={{ mt: 1 }}>
                    {item.classLoadError}
                  </Alert>
                )}
              </Paper>
            ))}
            <Button
              variant="contained"
              onClick={() => setStep(1)}
              disabled={!classListReady || busy}
              sx={{ alignSelf: "flex-start" }}
            >
              Tiếp tục chọn học viên
            </Button>
          </Stack>
        )}

        {step === 1 && (
          <Stack spacing={2} alignItems="flex-start">
            <Typography variant="h6">Chọn học viên</Typography>
            <Alert severity="info">
              Một học viên được xử lý cho cả {activeClasses.length} lớp. Enrollment
              hiện có được giữ nguyên; có thể bổ sung môn mới.
            </Alert>
            {student && (
              <Chip
                color="primary"
                label={student.code + " · " + student.fullName}
              />
            )}
            {previewError && (
              <Alert
                severity="error"
                action={
                  <Button
                    color="inherit"
                    size="small"
                    onClick={() => student && void loadStudentPreview(student)}
                  >
                    Tải lại
                  </Button>
                }
              >
                {previewError}
              </Alert>
            )}
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <Button
                variant="outlined"
                onClick={() => setStep(0)}
                disabled={busy}
              >
                Quay lại nhóm lớp
              </Button>
              <Button
                variant="contained"
                onClick={() => setStudentDialogOpen(true)}
                disabled={busy}
              >
                Chọn học viên có sẵn
              </Button>
              <Button
                variant="outlined"
                onClick={() => setStudentFormOpen(true)}
                disabled={busy}
              >
                Tạo hồ sơ học viên
              </Button>
            </Stack>
          </Stack>
        )}

        {step === 2 && student && (
          <Stack spacing={2}>
            <Typography variant="h6">Chọn môn đăng ký cho từng lớp</Typography>
            <Alert severity="info">
              {student.code} · {student.fullName}. Môn đang ACTIVE trong enrollment
              được đánh dấu và khóa.
            </Alert>
            {activeClasses.map((item) => {
              const subjects = activeSubjects(item);
              const additions = newSubjectIds(item);
              const expected = subjects
                .filter((subject) =>
                  item.selectedSubjectIds.includes(subject.id),
                )
                .reduce((sum, subject) => sum + Number(subject.tuitionFee), 0);
              return (
                <Paper key={item.item.id} variant="outlined" sx={{ p: 2 }}>
                  <Stack spacing={1.25}>
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      justifyContent="space-between"
                      gap={1}
                    >
                      <Typography fontWeight={700}>
                        {item.item.code} · {item.item.name}
                      </Typography>
                      {item.enrollmentStatus === "SUCCESS" && (
                        <Chip size="small" color="success" label="Đã đăng ký" />
                      )}
                    </Stack>
                    {item.classLoadError ? (
                      <Alert severity="error">{item.classLoadError}</Alert>
                    ) : subjects.length === 0 ? (
                      <Alert severity="warning">
                        Lớp chưa có môn đang hoạt động.
                      </Alert>
                    ) : (
                      <Stack divider={<Divider flexItem />}>
                        {subjects.map((subject) => {
                          const existing = item.existingSubjectIds.includes(
                            subject.id,
                          );
                          return (
                            <FormControlLabel
                              key={subject.id}
                              sx={{ py: 0.5 }}
                              control={
                                <Checkbox
                                  checked={item.selectedSubjectIds.includes(
                                    subject.id,
                                  )}
                                  disabled={
                                    existing ||
                                    busy ||
                                    item.enrollmentStatus === "SUCCESS"
                                  }
                                  onChange={(event) =>
                                    updateSubjects(
                                      item.item.id,
                                      subject.id,
                                      event.target.checked,
                                    )
                                  }
                                />
                              }
                              label={
                                <Stack
                                  direction={{ xs: "column", sm: "row" }}
                                  spacing={{ xs: 0, sm: 1 }}
                                >
                                  <span>
                                    {subject.subject.name}
                                    {existing ? " · Đã đăng ký" : ""}
                                  </span>
                                  <Typography
                                    variant="body2"
                                    color="text.secondary"
                                  >
                                    {money(Number(subject.tuitionFee))}/tháng
                                  </Typography>
                                </Stack>
                              }
                            />
                          );
                        })}
                      </Stack>
                    )}
                    {additions.length > 0 && (
                      <Typography variant="body2" color="text.secondary">
                        Môn mới: {additions.length} · Dự kiến {money(expected)}/tháng
                      </Typography>
                    )}
                    {item.enrollmentMessage && (
                      <Alert
                        severity={
                          item.enrollmentStatus === "FAILED" ? "error" : "info"
                        }
                      >
                        {item.enrollmentMessage}
                      </Alert>
                    )}
                    {item.enrollmentStatus === "FAILED" && (
                      <Button
                        color="error"
                        size="small"
                        onClick={() => removeClass(item.item.id)}
                        sx={{ alignSelf: "flex-start" }}
                      >
                        Bỏ lớp lỗi khỏi lượt này
                      </Button>
                    )}
                  </Stack>
                </Paper>
              );
            })}
            {enrollmentFailures.length > 0 && (
              <Alert severity="warning">
                Thử lại hoặc bỏ các lớp lỗi trước khi sang bước tạo học phí.
              </Alert>
            )}
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <Button
                variant="outlined"
                onClick={() => setStep(1)}
                disabled={busy || successfulClasses.length > 0}
              >
                Quay lại
              </Button>
              <Button
                variant="contained"
                onClick={() => void registerClasses()}
                disabled={busy || !canSubmitEnrollment}
              >
                {busy
                  ? "Đang xử lý lớp…"
                  : enrollmentFailures.length
                    ? "Thử lại lớp lỗi"
                    : "Xác nhận đăng ký các lớp"}
              </Button>
            </Stack>
          </Stack>
        )}

        {step === 3 && student && (
          <Stack spacing={2}>
            <Alert severity="success" icon={<CheckCircleOutlineOutlinedIcon />}>
              Đã xử lý enrollment cho {successfulClasses.length} lớp.
            </Alert>
            <Typography variant="h6">
              Tạo học phí cho các lớp thành công
            </Typography>
            <Typography color="text.secondary">
              Chọn một kỳ chung. Chỉ lớp có kỳ nằm trong thời gian lớp được đưa
              vào lượt tạo phí.
            </Typography>
            <Box sx={{ maxWidth: 320 }}>
              <MonthPickerField
                label="Kỳ học phí chung"
                value={month}
                onChange={changeMonth}
                textFieldProps={{ disabled: monthLocked }}
              />
            </Box>
            {feeEligible.map((item) => {
              const subjects = activeSubjects(item).filter((subject) =>
                item.selectedSubjectIds.includes(subject.id),
              );
              const expected = subjects.reduce(
                (sum, subject) => sum + Number(subject.tuitionFee),
                0,
              );
              return (
                <Paper key={item.item.id} variant="outlined" sx={{ p: 2 }}>
                  <Stack spacing={0.5}>
                    <Typography fontWeight={700}>
                      {item.item.code} · {item.item.name}
                    </Typography>
                    <Typography variant="body2">
                      {subjects.map((subject) => subject.subject.name).join(", ")}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Dự kiến {money(expected)} · kỳ {month}
                    </Typography>
                    {item.tuitionStatus === "SUCCESS" && (
                      <Alert severity="success">
                        Đã tạo {item.feeNo ?? "học phí"}
                        {item.finalAmount !== undefined
                          ? " · " + money(item.finalAmount)
                          : ""}
                      </Alert>
                    )}
                    {item.tuitionStatus === "FAILED" && (
                      <Alert severity="error">{item.tuitionMessage}</Alert>
                    )}
                  </Stack>
                </Paper>
              );
            })}
            {feeIneligible.length > 0 && (
              <Alert severity="info">
                Ngoài kỳ {month}:{" "}
                {feeIneligible.map((item) => item.item.code).join(", ")}. Không
                tạo phí cho các lớp này.
              </Alert>
            )}
            {feeEligible.length === 0 && (
              <Alert severity="warning">
                Không có lớp phù hợp kỳ này. Đổi kỳ hoặc hoàn tất mà chưa tạo
                học phí.
              </Alert>
            )}
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              {feeEligible.some((item) => item.tuitionStatus !== "SUCCESS") && (
                <Button
                  variant="contained"
                  onClick={() => void createTuitionFees()}
                  disabled={busy || feeEligible.length === 0}
                >
                  {busy
                    ? "Đang tạo học phí…"
                    : hasTuitionSuccess
                      ? "Thử lại lớp lỗi"
                      : "Xác nhận tạo phí cho " + feeEligible.length + " lớp"}
                </Button>
              )}
              {!allEligibleFeesCreated && (
                <Button
                  variant="outlined"
                  onClick={() => setFeesSkipped(true)}
                  disabled={busy}
                >
                  Hoàn tất, chưa tạo hết học phí
                </Button>
              )}
              {(allEligibleFeesCreated || feesSkipped) && (
                <Button variant="contained" onClick={startNewRegistration}>
                  Đăng ký học viên khác
                </Button>
              )}
              {feeEligible
                .filter((item) => item.tuitionFeeId)
                .map((item) => (
                  <Button
                    key={item.item.id}
                    component={Link}
                    variant="outlined"
                    href={"/admin/tuition-fees/" + item.tuitionFeeId}
                  >
                    Xem phí {item.item.code}
                  </Button>
                ))}
            </Stack>
            {feesSkipped && (
              <Alert severity="info">
                Enrollment đã lưu. Khoản chưa tạo có thể xử lý tại trang quản lý
                học viên của lớp.
              </Alert>
            )}
          </Stack>
        )}
      </Paper>

      <ClassSelectDialog
        open={classDialogOpen}
        onClose={() => setClassDialogOpen(false)}
        onSelectMany={(items) => void addClasses(items)}
        multiple
        activeOnly
        maxSelected={Math.max(0, 50 - activeClasses.length)}
      />
      <StudentSelectDialog
        open={studentDialogOpen}
        onClose={() => setStudentDialogOpen(false)}
        onSelect={(item) => void loadStudentPreview(item)}
        title="Chọn học viên để đăng ký"
      />
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
