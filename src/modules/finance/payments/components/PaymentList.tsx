"use client";

import React, { useCallback, useMemo, useState } from "react";
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
import {
  GridActionsCellItem,
  type GridColDef,
  type GridRenderCellParams,
} from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import ReceiptIcon from "@mui/icons-material/Receipt";
import SearchIcon from "@mui/icons-material/Search";

import { BaseTable } from "@/components/shared/tables/BaseTable";
import { EmptyState } from "@/components/shared/tables/EmptyState";
import { useList } from "@/hooks/useList";
import { useSnackbar } from "@/hooks/useSnackbar";

import { PaymentForm } from "./PaymentForm";
import { DatePicker } from "@mui/x-date-pickers";
import dayjs from "dayjs";
import { extractApiErrorMessage, unwrapApiResponse } from "@/lib/api-client";

type PaymentMethod = "cash" | "transfer" | "wallet";

interface Payment {
  id: string;
  studentFeeId: string;
  amount: number;
  method: PaymentMethod;
  paymentDate: string;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  receipts?: Array<{
    id: string;
    receiptNumber: string;
  }>;
  studentFee?: {
    id: string;
    month: string;
    amount: number;
    student?: {
      code: string;
      fullName: string;
    } | null;
    class?: {
      code: string;
      name: string;
    } | null;
    payments?: Array<{
      id: string;
      amount: number;
    }>;
  } | null;
}

const formatCurrency = (value: number): string =>
  `${new Intl.NumberFormat("vi-VN").format(value)} VND`;

const formatDate = (value: string): string =>
  new Date(value).toLocaleDateString("vi-VN");

const getMethodLabel = (method: PaymentMethod): string => {
  const labels: Record<PaymentMethod, string> = {
    cash: "Tiền mặt",
    transfer: "Chuyển khoản",
    wallet: "Ví điện tử",
  };

  return labels[method];
};

type PaymentListProps = {
  role: RoleCode;
};

export function PaymentList({ role }: PaymentListProps) {
  const canDelete = role === "ADMIN";
  const { showError, showSuccess, Snackbar } = useSnackbar();
  const [showForm, setShowForm] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [search, setSearch] = useState("");
  const [filterMethod, setFilterMethod] = useState<string>("");
  const [filterDateStart, setFilterDateStart] = useState<string>("");
  const [filterDateEnd, setFilterDateEnd] = useState<string>("");

  const {
    data: payments,
    isLoading,
    error,
    refresh,
    page,
    pageSize,
    setPageNumber,
    setPageSize,
  } = useList<Payment>("/api/payments", {
    pageSize: 10,
    search: search || undefined,
    method: filterMethod || undefined,
    startDate: filterDateStart || undefined,
    endDate: filterDateEnd || undefined,
  });

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm("Bạn có chắc chắn muốn xóa?")) {
        return;
      }

      try {
        const response = await fetch(`/api/payments/${id}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          throw new Error(await extractApiErrorMessage(response, "Failed to delete"));
        }

        showSuccess("Xóa thanh toán thành công");
        await refresh();
      } catch (error) {
        showError(
          error instanceof Error ? error.message : "Xóa thanh toán thất bại",
        );
      }
    },
    [refresh, showError, showSuccess],
  );

  const handleGenerateReceipt = useCallback(
    async (paymentId: string) => {
      try {
        const response = await fetch(`/api/payments/${paymentId}/receipt`, {
          method: "POST",
        });

        if (!response.ok) {
          throw new Error(
            await extractApiErrorMessage(response, "Failed to generate receipt"),
          );
        }
        const result = await unwrapApiResponse<{ receiptNumber?: string }>(response);

        showSuccess(`Tạo phiếu thu thành công: ${result.receiptNumber}`);
        await refresh();
      } catch (error) {
        showError(
          error instanceof Error ? error.message : "Tạo phiếu thu thất bại",
        );
      }
    },
    [refresh, showError, showSuccess],
  );

  const columns: GridColDef<Payment>[] = useMemo(
    () => [
      {
        field: "student",
        headerName: "Học viên",
        minWidth: 220,
        flex: 1,
        renderCell: ({ row }: GridRenderCellParams<Payment>) =>
          row.studentFee?.student
            ? `${row.studentFee.student.code} - ${row.studentFee.student.fullName}`
            : row.studentFeeId,
      },
      {
        field: "class",
        headerName: "Lớp",
        minWidth: 220,
        flex: 1,
        renderCell: ({ row }: GridRenderCellParams<Payment>) =>
          row.studentFee?.class
            ? `${row.studentFee.class.code} - ${row.studentFee.class.name}`
            : "-",
      },
      {
        field: "month",
        headerName: "Tháng học phí",
        width: 120,
        renderCell: ({ row }: GridRenderCellParams<Payment>) =>
          row.studentFee?.month || "-",
      },
      {
        field: "amount",
        headerName: "Số tiền",
        width: 150,
        align: "right",
        headerAlign: "right",
        renderCell: ({ row }: GridRenderCellParams<Payment>) =>
          formatCurrency(row.amount),
      },
      {
        field: "method",
        headerName: "Phương thức",
        width: 150,
        align: "center",
        headerAlign: "center",
        renderCell: ({ row }: GridRenderCellParams<Payment>) => (
          <Box
            sx={{
              width: "100%",
              height: "100%",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Chip
              label={getMethodLabel(row.method)}
              size="small"
              variant="outlined"
            />
          </Box>
        ),
      },
      {
        field: "paymentDate",
        headerName: "Ngày thanh toán",
        width: 140,
        renderCell: ({ row }: GridRenderCellParams<Payment>) =>
          formatDate(row.paymentDate),
      },
      {
        field: "receipt",
        headerName: "Phiếu thu",
        width: 170,
        align: "center",
        headerAlign: "center",
        renderCell: ({ row }: GridRenderCellParams<Payment>) => {
          const receipt = row.receipts?.[0];

          return (
            <Box
              sx={{
                width: "100%",
                height: "100%",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Chip
                label={receipt?.receiptNumber ?? "Chưa phát hành"}
                size="small"
                color={receipt ? "success" : "default"}
                variant={receipt ? "filled" : "outlined"}
              />
            </Box>
          );
        },
      },
      {
        field: "notes",
        headerName: "Ghi chú",
        minWidth: 180,
        flex: 1,
        renderCell: ({ row }: GridRenderCellParams<Payment>) =>
          row.notes || "-",
      },
      {
        field: "actions",
        type: "actions",
        width: 140,
        getActions: (params) => {
          const row = params.row as Payment;
          const hasReceipt = (row.receipts?.length || 0) > 0;

          return [
            <GridActionsCellItem
              key="edit"
              icon={<EditIcon />}
              label="Sửa"
              disabled={hasReceipt}
              onClick={() => {
                setEditingPayment(row);
                setShowForm(true);
              }}
            />,
            <GridActionsCellItem
              key="receipt"
              icon={<ReceiptIcon />}
              label="Phiếu thu"
              disabled={hasReceipt}
              onClick={() => void handleGenerateReceipt(row.id)}
            />,
            <GridActionsCellItem
              key="delete"
              icon={<DeleteIcon />}
              label="Xóa"
              disabled={hasReceipt || !canDelete}
              onClick={() => void handleDelete(row.id)}
            />,
          ];
        },
      },
    ],
    [canDelete, handleDelete, handleGenerateReceipt],
  );

  const hasRows = (payments?.items.length || 0) > 0;

  return (
    <>
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
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={2}
              alignItems={{ xs: "stretch", md: "center" }}
              justifyContent="space-between"
            >
              <Typography variant="h6" fontWeight={700}>
                Quản lý thanh toán
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => {
                  setEditingPayment(null);
                  setShowForm(true);
                }}
              >
                Ghi nhận thanh toán
              </Button>
            </Stack>

            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label="Tìm kiếm"
                placeholder="Mã/tên học viên, mã/tên lớp, tháng, ghi chú"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPageNumber(1);
                }}
                fullWidth
                InputProps={{
                  startAdornment: <SearchIcon fontSize="small" />,
                }}
              />

              <TextField
                select
                label="Phương thức"
                value={filterMethod}
                onChange={(event) => {
                  setFilterMethod(event.target.value);
                  setPageNumber(1);
                }}
                sx={{ width: 300 }}
              >
                <MenuItem value="">Tất cả</MenuItem>
                <MenuItem value="cash">Tiền mặt</MenuItem>
                <MenuItem value="transfer">Chuyển khoản</MenuItem>
                <MenuItem value="wallet">Ví điện tử</MenuItem>
              </TextField>

              <DatePicker
                label="Từ ngày"
                format="DD/MM/YYYY"
                value={filterDateStart ? dayjs(filterDateStart) : null}
                onChange={(value) => {
                  setFilterDateStart(value ? value.format("YYYY-MM-DD") : "");
                  setPageNumber(1);
                }}
              />

              <DatePicker
                label="Đến ngày"
                format="DD/MM/YYYY"
                value={filterDateEnd ? dayjs(filterDateEnd) : null}
                onChange={(value) => {
                  setFilterDateEnd(value ? value.format("YYYY-MM-DD") : "");
                  setPageNumber(1);
                }}
                minDate={filterDateStart ? dayjs(filterDateStart) : undefined}
              />
            </Stack>
          </Stack>
        </Paper>

        <Paper
          elevation={0}
          sx={{
            borderRadius: 3,
            border: "1px solid",
            borderColor: "divider",
            overflow: "hidden",
          }}
        >
          {error ? (
            <Box p={3}>
              <Alert severity="error">{error}</Alert>
            </Box>
          ) : !isLoading && !hasRows ? (
            <EmptyState
              title="Chưa có thanh toán"
              description="Không tìm thấy dữ liệu phù hợp với bộ lọc hiện tại."
            />
          ) : (
            <BaseTable
              rows={payments?.items || []}
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

      {showForm && (
        <PaymentForm
          initialData={editingPayment || undefined}
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false);
            setEditingPayment(null);
            void refresh();
          }}
        />
      )}

      {Snackbar}
    </>
  );
}
