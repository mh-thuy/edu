"use client";

import { useMemo, useState, type ReactElement } from "react";
import {
  Chip,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { GridColDef } from "@mui/x-data-grid";
import { BaseTable } from "@/components/BaseTable";
import { useList } from "@/hooks/useList";

type TeacherSchedule = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  class?: {
    code: string;
    name: string;
  } | null;
  room?: {
    code: string;
    name?: string | null;
  } | null;
};

const weekdayLabel: Record<number, string> = {
  0: "Chủ nhật",
  1: "Thứ 2",
  2: "Thứ 3",
  3: "Thứ 4",
  4: "Thứ 5",
  5: "Thứ 6",
  6: "Thứ 7",
};

export function TeacherScheduleList(): ReactElement {
  const [dayOfWeek, setDayOfWeek] = useState("");
  const {
    data,
    isLoading,
    error,
    page,
    pageSize,
    setPageNumber,
    setPageSize,
  } = useList<TeacherSchedule>("/api/teacher/schedules", {
    pageSize: 10,
    dayOfWeek: dayOfWeek || undefined,
  });

  const columns = useMemo<GridColDef<TeacherSchedule>[]>(
    () => [
      {
        field: "dayOfWeek",
        headerName: "Thứ",
        minWidth: 120,
        valueGetter: (value) => weekdayLabel[Number(value)] ?? `Thứ ${value}`,
      },
      {
        field: "time",
        headerName: "Khung giờ",
        minWidth: 160,
        valueGetter: (_value, row) => `${row.startTime} - ${row.endTime}`,
      },
      {
        field: "class",
        headerName: "Lớp học",
        minWidth: 220,
        flex: 1,
        valueGetter: (_value, row) =>
          row.class ? `${row.class.code} - ${row.class.name}` : "-",
      },
      {
        field: "room",
        headerName: "Phòng",
        minWidth: 180,
        flex: 0.8,
        valueGetter: (_value, row) =>
          row.room ? `${row.room.code} - ${row.room.name ?? ""}` : "-",
      },
      {
        field: "status",
        headerName: "Loại",
        minWidth: 120,
        align: "center",
        headerAlign: "center",
        renderCell: () => <Chip label="Cố định" size="small" variant="outlined" />,
      },
    ],
    [],
  );

  return (
    <Stack spacing={2.5}>
      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          borderRadius: 3,
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <Stack spacing={2}>
          <div>
            <Typography variant="h6" fontWeight={700}>
              Lịch dạy của tôi
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Chỉ hiển thị các lịch học được gán trực tiếp cho giáo viên hiện tại.
            </Typography>
          </div>

          <TextField
            select
            label="Lọc theo thứ"
            value={dayOfWeek}
            onChange={(event) => {
              setDayOfWeek(event.target.value);
              setPageNumber(1);
            }}
            size="small"
            sx={{ maxWidth: 220 }}
          >
            <MenuItem value="">Tất cả</MenuItem>
            <MenuItem value="0">Chủ nhật</MenuItem>
            <MenuItem value="1">Thứ 2</MenuItem>
            <MenuItem value="2">Thứ 3</MenuItem>
            <MenuItem value="3">Thứ 4</MenuItem>
            <MenuItem value="4">Thứ 5</MenuItem>
            <MenuItem value="5">Thứ 6</MenuItem>
            <MenuItem value="6">Thứ 7</MenuItem>
          </TextField>
        </Stack>
      </Paper>

      <BaseTable
        columns={columns}
        rows={data?.items || []}
        totalRows={data?.total || 0}
        page={page}
        pageSize={pageSize}
        isLoading={isLoading}
        onPageChange={setPageNumber}
        onPageSizeChange={setPageSize}
        error={error}
      />
    </Stack>
  );
}
