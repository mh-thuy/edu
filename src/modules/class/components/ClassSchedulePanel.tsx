"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
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
  TextField,
  Typography,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { extractApiErrorMessage, unwrapApiResponse } from "@/lib/api-client";

type SubjectOption = {
  id: string;
  subject: { name: string };
  teacherId: string | null;
  teacher?: { user?: { fullName?: string | null } | null } | null;
};
type Schedule = {
  id: string;
  classSubjectId?: string | null;
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
  teacher?: { user?: { fullName?: string | null } | null } | null;
  classSubject?: { subject: { name: string } } | null;
};
const days = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
const toMinutes = (value: string) => {
  const [hour = 0, minute = 0] = value.split(":").map(Number);
  return hour * 60 + minute;
};
const toTime = (value: number) =>
  `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;

export function ClassSchedulePanel({
  classId,
  classSubjects,
}: {
  classId: string;
  classSubjects: SubjectOption[];
}) {
  const [items, setItems] = useState<Schedule[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [classSubjectId, setClassSubjectId] = useState(
    classSubjects[0]?.id || "",
  );
  const [day, setDay] = useState(1);
  const [start, setStart] = useState("08:00");
  const [end, setEnd] = useState("10:00");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const selectedSubject = classSubjects.find(
    (subject) => subject.id === classSubjectId,
  );

  const load = useCallback(async () => {
    const response = await fetch(
      `/api/schedules?classId=${classId}&page=${page + 1}&pageSize=${pageSize}`,
    );
    if (response.ok) {
      const result = await unwrapApiResponse<{
        items: Schedule[];
        total: number;
      }>(response);
      setItems(result.items);
      setTotal(result.total);
    } else
      setError(
        await extractApiErrorMessage(response, "Không thể tải lịch học"),
      );
  }, [classId, page, pageSize]);
  useEffect(() => {
    void load();
  }, [load]);

  async function addSchedule() {
    if (!selectedSubject) {
      setError("Lớp chưa có môn học");
      return;
    }
    if (!selectedSubject.teacherId) {
      setError("Môn học chưa được phân công giáo viên");
      return;
    }
    if (toMinutes(start) >= toMinutes(end)) {
      setError("Giờ kết thúc phải sau giờ bắt đầu");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId,
          classSubjectId,
          teacherId: selectedSubject.teacherId,
          dayOfWeek: day,
          startMinute: toMinutes(start),
          endMinute: toMinutes(end),
        }),
      });
      if (!response.ok)
        setError(
          await extractApiErrorMessage(response, "Không thể tạo lịch học"),
        );
      else await load();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không thể tạo lịch học",
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeSchedule(id: string) {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/schedules/${id}`, {
        method: "DELETE",
      });
      if (!response.ok)
        setError(
          await extractApiErrorMessage(response, "Không thể xóa lịch học"),
        );
      else await load();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không thể xóa lịch học",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Stack spacing={2}>
      <Paper sx={{ p: 2 }}>
        <Stack spacing={2}>
          <Typography>Giáo viên được lấy theo môn học đã phân công.</Typography>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
            <Select
              size="small"
              value={classSubjectId}
              displayEmpty
              onChange={(event) => setClassSubjectId(event.target.value)}
              sx={{ minWidth: 220 }}
            >
              <MenuItem value="" disabled>
                Chọn môn học
              </MenuItem>
              {classSubjects.map((subject) => (
                <MenuItem key={subject.id} value={subject.id}>
                  {subject.subject.name} —{" "}
                  {subject.teacher?.user?.fullName || "Chưa phân công"}
                </MenuItem>
              ))}
            </Select>
            <Select
              size="small"
              value={day}
              onChange={(event) => setDay(Number(event.target.value))}
            >
              {days.map((label, index) => (
                <MenuItem key={label} value={index}>
                  {label}
                </MenuItem>
              ))}
            </Select>
            <TextField
              size="small"
              type="time"
              label="Bắt đầu"
              value={start}
              onChange={(event) => setStart(event.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              size="small"
              type="time"
              label="Kết thúc"
              value={end}
              onChange={(event) => setEnd(event.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <Button
              variant="contained"
              onClick={() => void addSchedule()}
              disabled={saving}
            >
              Thêm lịch học
            </Button>
          </Stack>
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </Paper>
      <Paper sx={{ overflow: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Môn học</TableCell>
              <TableCell>Ngày</TableCell>
              <TableCell>Thời gian</TableCell>
              <TableCell>Giáo viên</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.classSubject?.subject.name || "-"}</TableCell>
                <TableCell>{days[item.dayOfWeek]}</TableCell>
                <TableCell>
                  {toTime(item.startMinute)} - {toTime(item.endMinute)}
                </TableCell>
                <TableCell>{item.teacher?.user?.fullName || "-"}</TableCell>
                <TableCell align="right">
                  <Button
                    color="error"
                    size="small"
                    variant="outlined"
                    startIcon={<DeleteOutlineIcon />}
                    onClick={() => void removeSchedule(item.id)}
                    disabled={saving}
                  >
                    Xóa
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!items.length && (
              <TableRow>
                <TableCell colSpan={5}>
                  <Typography
                    sx={{ p: 3, textAlign: "center" }}
                    color="text.secondary"
                  >
                    Lớp chưa có lịch học
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={total}
          page={page}
          rowsPerPage={pageSize}
          onPageChange={(_, nextPage) => setPage(nextPage)}
          onRowsPerPageChange={(event) => {
            setPageSize(Number(event.target.value));
            setPage(0);
          }}
          rowsPerPageOptions={[10, 20, 50, 100]}
          labelRowsPerPage="Số dòng/trang"
          labelDisplayedRows={({ from, to, count }) =>
            `${from}–${to} trên ${count !== -1 ? count : `hơn ${to}`}`
          }
        />
      </Paper>
    </Stack>
  );
}
