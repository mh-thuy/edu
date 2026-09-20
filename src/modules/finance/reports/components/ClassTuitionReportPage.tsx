"use client";

import { useState, type ReactNode } from "react";
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
  Typography,
} from "@mui/material";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import MenuBookOutlinedIcon from "@mui/icons-material/MenuBookOutlined";
import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";
import { ClassSelectDialog, type ClassItem } from "@/components/shared/dialogs/ClassSelectDialog";
import { MasterSelectField, type MasterSelectValue } from "@/components/shared/forms/MasterSelectField";
import { MonthPickerField } from "@/components/shared/forms/MonthPickerField";
import { extractApiErrorMessage, unwrapApiResponse } from "@/lib/api-client";
import { getVietnamMonth } from "@/lib/vietnam-time";

type ClassSubject = {
  id: string;
  subject: { id: string; name: string };
  teacher: { id: string; code: string; fullName: string } | null;
};

type ClassDetail = {
  classSubjects: ClassSubject[];
};

function currentMonth() {
  return getVietnamMonth();
}

export function ClassTuitionReportPage() {
  const [classDialogOpen, setClassDialogOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);
  const [subjects, setSubjects] = useState<ClassSubject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [month, setMonth] = useState(currentMonth);
  const [loadingClass, setLoadingClass] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  const selectedSubject = subjects.find((subject) => subject.id === selectedSubjectId) ?? null;
  const teacher: MasterSelectValue | null = selectedSubject?.teacher
    ? {
        id: selectedSubject.teacher.id,
        code: selectedSubject.teacher.code,
        name: selectedSubject.teacher.fullName,
      }
    : null;

  async function handleClassSelect(classItem: ClassItem) {
    setClassDialogOpen(false);
    setSelectedClass(classItem);
    setSelectedSubjectId("");
    setSubjects([]);
    setError("");
    setLoadingClass(true);
    try {
      const response = await fetch(`/api/classes/${classItem.id}`);
      if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không thể tải môn học của lớp"));
      const detail = await unwrapApiResponse<ClassDetail>(response);
      setSubjects(detail.classSubjects);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể tải môn học của lớp");
    } finally {
      setLoadingClass(false);
    }
  }

  async function handleExport() {
    if (!selectedClass || !selectedSubjectId || !month) return;
    setExporting(true);
    setError("");
    try {
      const params = new URLSearchParams({
        classId: selectedClass.id,
        classSubjectId: selectedSubjectId,
        month,
      });
      const response = await fetch(`/api/reports/class-tuition/export?${params.toString()}`);
      if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không thể xuất báo cáo Excel"));
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `bao-cao-thu-hoc-phi-${selectedClass.code}-${month}.xlsx`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể xuất báo cáo Excel");
    } finally {
      setExporting(false);
    }
  }

  return (
    <Stack spacing={{ xs: 2, md: 3 }}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ md: "flex-end" }} gap={2}>
        <Stack direction="row" spacing={1.5} alignItems="flex-start">
          <Box sx={{ width: 48, height: 48, flexShrink: 0, borderRadius: 2.5, display: "grid", placeItems: "center", bgcolor: "primary.light", color: "primary.dark" }}>
            <AssessmentOutlinedIcon />
          </Box>
          <Box>
            <Typography variant="h4" fontWeight={800} letterSpacing="-0.02em">Báo cáo thu học phí</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Theo dõi tiền đã thu theo lớp, môn học và kỳ báo cáo.</Typography>
          </Box>
        </Stack>
        <Chip label="Báo cáo tài chính" color="primary" variant="outlined" />
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}

      <Paper sx={{ p: { xs: 2, md: 2.5 }, overflow: "hidden" }}>
        <Stack spacing={2.5}>
          <Stack direction="row" spacing={1.25} alignItems="flex-start">
            <Box sx={{ width: 36, height: 36, borderRadius: 1.5, display: "grid", placeItems: "center", bgcolor: "#eff6ff", color: "primary.main", flexShrink: 0 }}>
              <AssessmentOutlinedIcon fontSize="small" />
            </Box>
            <Box>
              <Typography variant="h6" fontWeight={800}>Thiết lập phạm vi báo cáo</Typography>
              <Typography variant="body2" color="text.secondary">Chọn lớp, môn học và kỳ thu để tạo file Excel.</Typography>
            </Box>
          </Stack>

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }, gap: 2 }}>
            <MasterSelectField
              label="Lớp học"
              value={selectedClass ? { id: selectedClass.id, code: selectedClass.code, name: selectedClass.name } : null}
              onOpen={() => setClassDialogOpen(true)}
              size="small"
              required
            />
            <FormControl fullWidth disabled={!selectedClass || loadingClass}>
              <InputLabel id="report-subject-label">Môn học</InputLabel>
              <Select
                labelId="report-subject-label"
                label="Môn học"
                value={selectedSubjectId}
                onChange={(event) => setSelectedSubjectId(event.target.value)}
              >
                <MenuItem value=""><em>{loadingClass ? "Đang tải môn học..." : "Chọn môn học"}</em></MenuItem>
                {subjects.map((subject) => (
                  <MenuItem key={subject.id} value={subject.id} disabled={!subject.teacher}>
                    {subject.subject.name}{subject.teacher ? "" : " · Chưa phân công giáo viên"}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <MasterSelectField label="Giáo viên phụ trách" value={teacher} onOpen={() => undefined} size="small" disabled />
            <MonthPickerField
              label="Kỳ báo cáo"
              value={month}
              onChange={setMonth}
              textFieldProps={{ required: true, size: "small" }}
            />
          </Box>

          <Alert severity="info" icon={<CalendarMonthOutlinedIcon />} sx={{ alignItems: "flex-start" }}>
            Báo cáo chỉ ghi nhận các khoản thanh toán thành công trong kỳ đã chọn và được phân bổ cho môn học tương ứng.
          </Alert>

          <Box sx={{ p: 2, borderRadius: 2.5, bgcolor: "#f8fafc", border: "1px solid", borderColor: "divider" }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: "uppercase", letterSpacing: "0.06em" }}>Phạm vi đang chọn</Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" }, gap: 1.5, mt: 1.25 }}>
              <ReportScopeItem icon={<MenuBookOutlinedIcon fontSize="small" />} label="Lớp học" value={selectedClass?.name || "Chưa chọn lớp"} />
              <ReportScopeItem icon={<AssessmentOutlinedIcon fontSize="small" />} label="Môn học" value={selectedSubject?.subject.name || "Chưa chọn môn"} />
              <ReportScopeItem icon={<PersonOutlineOutlinedIcon fontSize="small" />} label="Giáo viên" value={teacher?.name || "Chưa phân công"} />
              <ReportScopeItem icon={<CalendarMonthOutlinedIcon fontSize="small" />} label="Kỳ báo cáo" value={month || "Chưa chọn kỳ"} />
            </Box>
          </Box>

          <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} gap={1.5}>
            <Typography variant="body2" color="text.secondary">File Excel gồm danh sách học viên và số tiền đã thu theo môn.</Typography>
            <Button variant="contained" startIcon={<DownloadOutlinedIcon />} onClick={() => void handleExport()} disabled={exporting || !selectedClass || !selectedSubjectId || !selectedSubject?.teacher || !month}>
              {exporting ? "Đang xuất..." : "Xuất báo cáo Excel"}
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <ClassSelectDialog open={classDialogOpen} onClose={() => setClassDialogOpen(false)} onSelect={(classItem) => void handleClassSelect(classItem)} />
    </Stack>
  );
}

function ReportScopeItem({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <Stack direction="row" spacing={1} alignItems="flex-start" minWidth={0}>
      <Box sx={{ width: 30, height: 30, flexShrink: 0, borderRadius: 1.25, display: "grid", placeItems: "center", bgcolor: "#ffffff", color: "primary.main", border: "1px solid", borderColor: "divider" }}>{icon}</Box>
      <Box minWidth={0}>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>{label}</Typography>
        <Typography variant="body2" fontWeight={700} noWrap title={value}>{value}</Typography>
      </Box>
    </Stack>
  );
}
