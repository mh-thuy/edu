"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useCallback, useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  Stack,
  TextField,
  Typography,
  Chip,
} from "@mui/material";
import { GridActionsCellItem, GridColDef } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import ReceiptIcon from "@mui/icons-material/Receipt";

import { BaseTable } from "@/components/BaseTable";
import { useList } from "@/hooks/useList";
import { useSnackbar } from "@/hooks/useSnackbar";

import { PaymentForm } from "./PaymentForm";

interface Payment {
  id: string;
  studentFeeId: string;
  amount: number;
  method: "cash" | "transfer" | "wallet";
  paymentDate: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

const getMethodLabel = (method: string) => {
  const labels: Record<string, string> = {
    cash: "Tiền mặt",
    transfer: "Chuyển khoản",
    wallet: "Ví điện tử",
  };
  return labels[method] || method;
};

export function PaymentList() {
  const snackbar = useSnackbar();
  const [showForm, setShowForm] = useState(false);
  const [filterMethod, setFilterMethod] = useState<string>("");
  const [filterDateStart, setFilterDateStart] = useState<string>("");
  const [filterDateEnd, setFilterDateEnd] = useState<string>("");

  const queryParams = new URLSearchParams();
  if (filterMethod) queryParams.append("method", filterMethod);
  if (filterDateStart) queryParams.append("startDate", filterDateStart);
  if (filterDateEnd) queryParams.append("endDate", filterDateEnd);

  const { data: payments, isLoading, error, refresh, page, limit, setPageNumber, setPageSize } = useList<Payment>(
    `/api/payments${queryParams.toString() ? "?" + queryParams.toString() : ""}`
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm("Bạn có chắc chắn muốn xóa?")) return;

      try {
        const response = await fetch(`/api/payments/${id}`, {
          method: "DELETE",
        });
        if (!response.ok) throw new Error("Failed to delete");
        snackbar.showSuccess("Xóa thành công");
        refresh();
      } catch {
        snackbar.showError("Xóa thất bại");
      }
    },
    [refresh, snackbar]
  );

  const handleGenerateReceipt = useCallback(
    async (paymentId: string) => {
      try {
        const response = await fetch(
          `/api/payments/${paymentId}/receipt`,
          { method: "POST" }
        );
        if (!response.ok) throw new Error("Failed to generate receipt");
        const result = await response.json();
        snackbar.showSuccess(
          `Phiếu thu được tạo: ${result.receiptNumber}`
        );
        refresh();
      } catch {
        snackbar.showError("Tạo phiếu thu thất bại");
      }
    },
    [refresh, snackbar]
  );

  const columns: GridColDef[] = useMemo(
    () => [
      { field: "id", headerName: "ID", width: 100 },
      {
        field: "studentFeeId",
        headerName: "Hóa đơn",
        width: 150,
      },
      {
        field: "amount",
        headerName: "Số tiền",
        width: 150,
        valueGetter: (params: any) => `${(params.row?.amount || 0).toLocaleString()} VND`,
      },
      {
        field: "method",
        headerName: "Phương thức",
        width: 130,
        renderCell: (params) => (
          <Chip
            label={getMethodLabel(params.value)}
            size="small"
            variant="outlined"
          />
        ),
      },
      {
        field: "paymentDate",
        headerName: "Ngày thanh toán",
        width: 150,
        valueGetter: (params: any) => new Date(params.row?.paymentDate || Date.now()).toLocaleDateString("vi-VN"),
      },
      {
        field: "notes",
        headerName: "Ghi chú",
        width: 200,
      },
      {
        field: "actions",
        type: "actions",
        width: 150,
        getActions: (params) => [
          <GridActionsCellItem
            key="receipt"
            icon={<ReceiptIcon />}
            label="Phiếu thu"
            onClick={() => handleGenerateReceipt((params.row as Payment).id)}
          />,
          <GridActionsCellItem
            key="delete"
            icon={<DeleteIcon />}
            label="Xóa"
            onClick={() => handleDelete((params.row as Payment).id)}
          />,
        ],
      },
    ],
    [handleDelete, handleGenerateReceipt]
  );

  return (
    <Card>
      <Box p={2}>
        <Stack direction="row" spacing={2} mb={2}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setShowForm(true)}
          >
            Ghi nhận thanh toán
          </Button>
        </Stack>

        {/* Filters */}
        <Stack direction="row" spacing={2} mb={2}>
          <TextField
            select
            label="Phương thức"
            value={filterMethod}
            onChange={(e) => setFilterMethod(e.target.value)}
            size="small"
            sx={{ width: 150 }}
            slotProps={{
              select: {
                native: true,
              },
            }}
          >
            <option value="">-- Tất cả --</option>
            <option value="cash">Tiền mặt</option>
            <option value="transfer">Chuyển khoản</option>
            <option value="wallet">Ví điện tử</option>
          </TextField>

          <TextField
            type="date"
            label="Từ ngày"
            value={filterDateStart}
            onChange={(e) => setFilterDateStart(e.target.value)}
            size="small"
            sx={{ width: 150 }}
            InputLabelProps={{ shrink: true }}
          />

          <TextField
            type="date"
            label="Đến ngày"
            value={filterDateEnd}
            onChange={(e) => setFilterDateEnd(e.target.value)}
            size="small"
            sx={{ width: 150 }}
            InputLabelProps={{ shrink: true }}
          />

          {(filterMethod || filterDateStart || filterDateEnd) && (
            <Button
              variant="outlined"
              onClick={() => {
                setFilterMethod("");
                setFilterDateStart("");
                setFilterDateEnd("");
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
          rows={payments?.items || []}
          columns={columns}
          isLoading={isLoading}
          totalRows={payments?.total || 0}
          page={page - 1}
          pageSize={limit}
          onPageChange={(newPage) => setPageNumber(newPage + 1)}
          onPageSizeChange={setPageSize}
        />
      </Box>

      {showForm && (
        <PaymentForm
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false);
            refresh();
          }}
        />
      )}
    </Card>
  );
}
