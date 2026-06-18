"use client";

import { useMemo, useState, type ReactElement } from "react";
import {
  Box,
  Chip,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import type { GridColDef } from "@mui/x-data-grid";
import { BaseTable } from "@/components/shared/tables/BaseTable";
import { useList } from "@/hooks/useList";

type TeacherClass = {
  id: string;
  code: string;
  name: string;
  tuitionFee: number;
  totalSessions: number;
  maxStudents: number;
  status: "ACTIVE" | "DRAFT" | "COMPLETED" | "CANCELLED";
  room?: {
    code?: string;
    name?: string | null;
  } | null;
};

const formatCurrency = (value: number): string =>
  `${new Intl.NumberFormat("vi-VN").format(value)} đ`;

const statusLabel: Record<TeacherClass["status"], string> = {
  ACTIVE: "Hoạt động",
  DRAFT: "Nháp",
  COMPLETED: "Hoàn thành",
  CANCELLED: "Đã hủy",
};

const statusColor: Record<
  TeacherClass["status"],
  "success" | "default" | "info" | "error"
> = {
  ACTIVE: "success",
  DRAFT: "default",
  COMPLETED: "info",
  CANCELLED: "error",
};

export function TeacherClassList(): ReactElement {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const {
    data,
    isLoading,
    error,
    page,
    pageSize,
    setPageNumber,
    setPageSize,
  } = useList<TeacherClass>("/api/teacher/classes", {
    pageSize: 10,
    search: search || undefined,
    status: status || undefined,
  });

  const columns = useMemo<GridColDef<TeacherClass>[]>(
    () => [
      { field: "code", headerName: "Mã lớp", minWidth: 120, flex: 0.7 },
      { field: "name", headerName: "Tên lớp", minWidth: 220, flex: 1 },
      {
        field: "room",
        headerName: "Phòng",
        minWidth: 180,
        flex: 0.9,
        valueGetter: (_value, row) =>
          row.room ? `${row.room.code} - ${row.room.name ?? ""}` : "-",
      },
      {
        field: "tuitionFee",
        headerName: "Học phí",
        minWidth: 140,
        align: "right",
        headerAlign: "right",
        valueFormatter: (value) => formatCurrency(Number(value)),
      },
      {
        field: "totalSessions",
        headerName: "Số buổi",
        minWidth: 110,
        align: "center",
        headerAlign: "center",
      },
      {
        field: "maxStudents",
        headerName: "Sĩ số tối đa",
        minWidth: 120,
        align: "center",
        headerAlign: "center",
      },
      {
        field: "status",
        headerName: "Trạng thái",
        minWidth: 140,
        align: "center",
        headerAlign: "center",
        renderCell: ({ row }) => (
          <Chip
            label={statusLabel[row.status]}
            color={statusColor[row.status]}
            size="small"
            variant="outlined"
          />
        ),
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
          <Box>
            <Typography variant="h6" fontWeight={700}>
              Lớp học của tôi
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Danh sách lớp đang được phân công cho tài khoản giáo viên hiện tại.
            </Typography>
          </Box>

          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <TextField
              placeholder="Tìm theo mã lớp hoặc tên lớp..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPageNumber(1);
              }}
              fullWidth
              size="small"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" color="action" />
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              select
              label="Trạng thái"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPageNumber(1);
              }}
              size="small"
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="">Tất cả</MenuItem>
              <MenuItem value="ACTIVE">Hoạt động</MenuItem>
              <MenuItem value="DRAFT">Nháp</MenuItem>
              <MenuItem value="COMPLETED">Hoàn thành</MenuItem>
              <MenuItem value="CANCELLED">Đã hủy</MenuItem>
            </TextField>
          </Stack>
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
