"use client";

import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
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
      <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ md: "center" }}>
          <Box sx={{ width: 44, height: 44, borderRadius: 2, display: "grid", placeItems: "center", bgcolor: "primary.main", color: "primary.contrastText" }}>
            <AssessmentOutlinedIcon />
          </Box>
          <Box>
            <Typography variant="h6" fontWeight={700}>Báo cáo thu học phí</Typography>
            <Typography variant="body2" color="text.secondary">Xuất báo cáo tiền đã thu theo lớp và môn học</Typography>
          </Box>
        </Stack>
      </Paper>

      <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}
          <Typography variant="subtitle1" fontWeight={700}>Thiết lập tham số báo cáo</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: -1 }}>Chọn đúng lớp, môn học và kỳ thu trước khi xuất file.</Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }, gap: 2 }}>
            <MasterSelectField
              label="Lớp học"
              value={selectedClass ? { id: selectedClass.id, code: selectedClass.code, name: selectedClass.name } : null}
              onOpen={() => setClassDialogOpen(true)}
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
                <MenuItem value=""><em>Chọn môn học</em></MenuItem>
                {subjects.map((subject) => (
                  <MenuItem key={subject.id} value={subject.id}>
                    {subject.subject.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <MasterSelectField label="Giáo viên phụ trách" value={teacher} onOpen={() => undefined} disabled />
            <MonthPickerField
              label="Kỳ báo cáo"
              value={month}
              onChange={setMonth}
              textFieldProps={{ required: true }}
            />
          </Box>
          <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
            <Button variant="contained" onClick={() => void handleExport()} disabled={exporting || !selectedClass || !selectedSubjectId || !month}>
              {exporting ? "Đang xuất..." : "Xuất Excel"}
            </Button>
          </Box>
        </Stack>
      </Paper>

      <ClassSelectDialog open={classDialogOpen} onClose={() => setClassDialogOpen(false)} onSelect={(classItem) => void handleClassSelect(classItem)} />
    </Stack>
  );
}
