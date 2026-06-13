"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useMemo, useState } from "react";
import {
  Box,
  Card,
  Stack,
  TextField,
  Typography,
  Chip,
  Button,
} from "@mui/material";
import { GridColDef } from "@mui/x-data-grid";

import { BaseTable } from "@/components/BaseTable";
import { useList } from "@/hooks/useList";
import { useSnackbar } from "@/hooks/useSnackbar";

interface StudentDebt {
  id: string;
  studentId: string;
  className: string;
  totalAmount: number;
  totalPaid: number;
  outstanding: number;
  status: "unpaid" | "partial" | "paid";
  month: string;
  dueDate: string;
}

interface DebtSummary {
  totalDebt: number;
  unpaidCount: number;
  partialCount: number;
  overdueCount: number;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case "paid":
      return "success";
    case "partial":
      return "warning";
    case "unpaid":
      return "error";
    default:
      return "default";
  }
};

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    paid: "Đã thanh toán",
    partial: "Thanh toán một phần",
    unpaid: "Chưa thanh toán",
  };
  return labels[status] || status;
};

export function DebtTrackingList() {
  const snackbar = useSnackbar();
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterStudent, setFilterStudent] = useState<string>("");
  const [filterClass, setFilterClass] = useState<string>("");
  const [summary, setSummary] = useState<DebtSummary | null>(null);

  const queryParams = new URLSearchParams();
  if (filterStatus) queryParams.append("status", filterStatus);
  if (filterStudent) queryParams.append("studentId", filterStudent);
  if (filterClass) queryParams.append("classId", filterClass);

  const { data: debts, isLoading, error, refresh } = useList<StudentDebt>(
    `/api/student-fees/debt-tracking${queryParams.toString() ? "?" + queryParams.toString() : ""}`
  );

  // Load summary statistics
  React.useEffect(() => {
    const loadSummary = async () => {
      try {
        const response = await fetch("/api/student-fees/debt-summary");
        if (!response.ok) throw new Error("Failed to load summary");
        const result = await response.json();
        setSummary(result);
      } catch (err) {
        console.error("Failed to load debt summary:", err);
      }
    };
    loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const columns: GridColDef[] = useMemo(
    () => [
      { field: "id", headerName: "ID", width: 100 },
      {
        field: "studentId",
        headerName: "Học sinh",
        width: 120,
      },
      {
        field: "className",
        headerName: "Lớp",
        width: 150,
      },
      {
        field: "month",
        headerName: "Tháng",
        width: 120,
      },
      {
        field: "totalAmount",
        headerName: "Tổng tiền",
        width: 150,
        valueGetter: (params: any) => `${(params.row?.totalAmount || 0).toLocaleString()} VND`,
      },
      {
        field: "totalPaid",
        headerName: "Đã thanh toán",
        width: 150,
        valueGetter: (params: any) => `${(params.row?.totalPaid || 0).toLocaleString()} VND`,
      },
      {
        field: "outstanding",
        headerName: "Nợ còn lại",
        width: 150,
        valueGetter: (params: any) => `${(params.row?.outstanding || 0).toLocaleString()} VND`,
      },
      {
        field: "status",
        headerName: "Trạng thái",
        width: 150,
        renderCell: (params) => (
          <Chip
            label={getStatusLabel(params.value)}
            size="small"
            color={getStatusColor(params.value) as any}
            variant="outlined"
          />
        ),
      },
      {
        field: "dueDate",
        headerName: "Hạn thanh toán",
        width: 150,
        valueGetter: (params) => new Date(params).toLocaleDateString("vi-VN"),
      },
    ],
    []
  );

  return (
    <>
      {/* Summary Cards */}
      {summary && (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "1fr 1fr",
              md: "1fr 1fr 1fr 1fr",
            },
            gap: 2,
            mb: 3,
          }}
        >
          <Box>
            <Card sx={{ p: 2 }}>
              <Typography color="text.secondary" variant="caption">
                Tổng nợ
              </Typography>
              <Typography variant="h6">
                {summary.totalDebt.toLocaleString()} VND
              </Typography>
            </Card>
          </Box>
          <Box>
            <Card sx={{ p: 2 }}>
              <Typography color="text.secondary" variant="caption">
                Chưa thanh toán
              </Typography>
              <Typography variant="h6">{summary.unpaidCount}</Typography>
            </Card>
          </Box>
          <Box>
            <Card sx={{ p: 2 }}>
              <Typography color="text.secondary" variant="caption">
                Thanh toán một phần
              </Typography>
              <Typography variant="h6">{summary.partialCount}</Typography>
            </Card>
          </Box>
          <Box>
            <Card sx={{ p: 2 }}>
              <Typography color="text.secondary" variant="caption">
                Quá hạn
              </Typography>
              <Typography variant="h6" color="error">
                {summary.overdueCount}
              </Typography>
            </Card>
          </Box>
        </Box>
      )}

      {/* Table */}
      <Card>
        <Box p={2}>
          {/* Filters */}
          <Stack direction="row" spacing={2} mb={2} flexWrap="wrap">
            <TextField
              select
              label="Trạng thái"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              size="small"
              sx={{ width: 150 }}
              slotProps={{
                select: {
                  native: true,
                },
              }}
            >
              <option value="">-- Tất cả --</option>
              <option value="unpaid">Chưa thanh toán</option>
              <option value="partial">Thanh toán một phần</option>
              <option value="paid">Đã thanh toán</option>
            </TextField>

            <TextField
              label="Học sinh"
              value={filterStudent}
              onChange={(e) => setFilterStudent(e.target.value)}
              size="small"
              placeholder="Mã học sinh"
              sx={{ width: 150 }}
            />

            <TextField
              label="Lớp"
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
              size="small"
              placeholder="Mã lớp"
              sx={{ width: 150 }}
            />

            {(filterStatus || filterStudent || filterClass) && (
              <Button
                variant="outlined"
                onClick={() => {
                  setFilterStatus("");
                  setFilterStudent("");
                  setFilterClass("");
                }}
              >
                Xóa bộ lọc
              </Button>
            )}
          </Stack>

          {error && (
            <Typography color="error" mb={2}>
              {error}
            </Typography>
          )}

          <BaseTable
            rows={debts?.items || []}
            columns={columns}
            isLoading={isLoading}
            totalRows={debts?.total || 0}
            page={0}
            pageSize={10}
            onPageChange={() => {}}
            onPageSizeChange={() => {}}
          />
        </Box>
      </Card>
    </>
  );
}
