"use client";

import React, { useMemo, useState } from "react";
import type { RoleCode } from "@/constants/roles";
import {
  Alert,
  Box,
  Button,
  Chip,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { GridColDef, GridRenderCellParams } from "@mui/x-data-grid";
import VisibilityIcon from "@mui/icons-material/Visibility";
import SearchIcon from "@mui/icons-material/Search";
import { DatePicker } from "@mui/x-date-pickers";
import dayjs from "dayjs";
import { BaseTable } from "@/components/shared/tables/BaseTable";
import { EmptyState } from "@/components/shared/tables/EmptyState";
import { useList } from "@/hooks/useList";
import { useRouter } from "next/navigation";

type PaymentMethod = "cash" | "transfer" | "wallet";
type PaymentStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "FAILED" | "REFUNDED";

interface Payment {
  id: string;
  studentFeeId: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  paymentDate: string;
  notes?: string | null;
  studentFee?: {
    month: string;
    student?: {
      code: string;
      fullName: string;
    } | null;
    class?: {
      code: string;
      name: string;
    } | null;
  } | null;
}

type PaymentListProps = {
  role: RoleCode;
};

const formatCurrency = (value: number): string =>
  `${new Intl.NumberFormat("vi-VN").format(value)} ₫`;

const formatDate = (value: string): string =>
  new Date(value).toLocaleDateString("vi-VN");

const getMethodLabel = (method: PaymentMethod): string => {
  if (method === "cash") return "Tiền mặt";
  if (method === "transfer") return "Chuyển khoản";
  return "Ví điện tử";
};

const getStatusLabel = (status: PaymentStatus): string => {
  if (status === "CONFIRMED") return "Đã xác nhận";
  if (status === "PENDING") return "Chờ xác nhận";
  if (status === "CANCELLED") return "Đã hủy";
  if (status === "FAILED") return "Thất bại";
  return "Hoàn tiền";
};

export function PaymentList({ role }: PaymentListProps) {
  const router = useRouter();
  void role;

  const [search, setSearch] = useState("");
  const [method, setMethod] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const {
    data: payments,
    isLoading,
    error,
    page,
    pageSize,
    setPageNumber,
    setPageSize,
  } = useList<Payment>("/api/payments", {
    pageSize: 10,
    search: search || undefined,
    method: method || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  });

  const columns = useMemo<GridColDef<Payment>[]>(
    () => [
      { field: "id", headerName: "Payment No", minWidth: 220, flex: 1 },
      {
        field: "student",
        headerName: "Student",
        minWidth: 220,
        flex: 1,
        renderCell: ({ row }: GridRenderCellParams<Payment>) =>
          row.studentFee?.student
            ? `${row.studentFee.student.code} - ${row.studentFee.student.fullName}`
            : "-",
      },
      {
        field: "feeRef",
        headerName: "Fee Reference",
        minWidth: 220,
        flex: 1,
        renderCell: ({ row }: GridRenderCellParams<Payment>) => row.studentFeeId,
      },
      {
        field: "paymentDate",
        headerName: "Payment Date",
        width: 140,
        renderCell: ({ row }: GridRenderCellParams<Payment>) =>
          formatDate(row.paymentDate),
      },
      {
        field: "amount",
        headerName: "Amount",
        width: 140,
        align: "right",
        headerAlign: "right",
        renderCell: ({ row }: GridRenderCellParams<Payment>) =>
          formatCurrency(row.amount),
      },
      {
        field: "method",
        headerName: "Method",
        width: 140,
        align: "center",
        headerAlign: "center",
        renderCell: ({ row }: GridRenderCellParams<Payment>) => (
          <Chip label={getMethodLabel(row.method)} size="small" variant="outlined" />
        ),
      },
      {
        field: "status",
        headerName: "Status",
        width: 160,
        align: "center",
        headerAlign: "center",
        renderCell: ({ row }: GridRenderCellParams<Payment>) => (
          <Chip label={getStatusLabel(row.status)} size="small" />
        ),
      },
      {
        field: "actions",
        headerName: "Actions",
        width: 160,
        sortable: false,
        filterable: false,
        align: "center",
        headerAlign: "center",
        renderCell: ({ row }: GridRenderCellParams<Payment>) => (
          <Button
            size="small"
            startIcon={<VisibilityIcon />}
            onClick={() => router.push(`/admin/payments/${row.id}`)}
          >
            View Detail
          </Button>
        ),
      },
    ],
    [router],
  );

  const rows = payments?.items || [];

  return (
    <Stack spacing={2.5}>
      <Paper
        elevation={0}
        sx={{ p: 2.5, borderRadius: 3, border: "1px solid", borderColor: "divider" }}
      >
        <Stack spacing={2}>
          <Typography variant="h6" fontWeight={700}>
            Quản lý thanh toán
          </Typography>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <TextField
              label="Tìm kiếm"
              placeholder="Mã thanh toán, học viên, lớp, ghi chú..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPageNumber(1);
              }}
              fullWidth
              InputProps={{ startAdornment: <SearchIcon fontSize="small" /> }}
            />
            <TextField
              select
              label="Phương thức"
              value={method}
              onChange={(event) => {
                setMethod(event.target.value);
                setPageNumber(1);
              }}
              sx={{ width: 220 }}
            >
              <MenuItem value="">Tất cả</MenuItem>
              <MenuItem value="cash">Tiền mặt</MenuItem>
              <MenuItem value="transfer">Chuyển khoản</MenuItem>
              <MenuItem value="wallet">Ví điện tử</MenuItem>
            </TextField>
            <DatePicker
              label="Từ ngày"
              format="DD/MM/YYYY"
              value={startDate ? dayjs(startDate) : null}
              onChange={(value) => {
                setStartDate(value ? value.format("YYYY-MM-DD") : "");
                setPageNumber(1);
              }}
            />
            <DatePicker
              label="Đến ngày"
              format="DD/MM/YYYY"
              value={endDate ? dayjs(endDate) : null}
              onChange={(value) => {
                setEndDate(value ? value.format("YYYY-MM-DD") : "");
                setPageNumber(1);
              }}
              minDate={startDate ? dayjs(startDate) : undefined}
            />
          </Stack>
        </Stack>
      </Paper>

      <Paper
        elevation={0}
        sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", overflow: "hidden" }}
      >
        {error ? (
          <Box p={3}>
            <Alert severity="error">{error}</Alert>
          </Box>
        ) : !isLoading && rows.length === 0 ? (
          <EmptyState
            title="Chưa có thanh toán"
            description="Không tìm thấy dữ liệu phù hợp với bộ lọc hiện tại."
          />
        ) : (
          <BaseTable
            rows={rows}
            columns={columns}
            isLoading={isLoading}
            totalRows={payments?.total || 0}
            page={page}
            pageSize={pageSize}
            onPageChange={setPageNumber}
            onPageSizeChange={setPageSize}
          />
        )}
      </Paper>
    </Stack>
  );
}
