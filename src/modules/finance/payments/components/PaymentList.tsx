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
import { useTranslation } from "react-i18next";

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

const getMethodLabel = (method: string, t: (key: string) => string) => {
  const labels: Record<string, string> = {
    cash: t("finance:cash"),
    transfer: t("finance:transfer"),
    wallet: t("finance:wallet"),
  };
  return labels[method] || method;
};

export function PaymentList() {
  const { t } = useTranslation(["finance", "common"]);
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
      if (!confirm(t("common:confirmDelete"))) return;

      try {
        const response = await fetch(`/api/payments/${id}`, {
          method: "DELETE",
        });
        if (!response.ok) throw new Error("Failed to delete");
        snackbar.showSuccess(t("common:deleteSuccess"));
        refresh();
      } catch {
        snackbar.showError(t("common:deleteError"));
      }
    },
    [refresh, snackbar, t]
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
          `${t("finance:receiptCreated")}${result.receiptNumber}`
        );
        refresh();
      } catch {
        snackbar.showError(t("finance:generateReceiptError"));
      }
    },
    [refresh, snackbar, t]
  );

  const columns: GridColDef[] = useMemo(
    () => [
      { field: "id", headerName: "ID", width: 100 },
      {
        field: "studentFeeId",
        headerName: t("finance:invoice"),
        width: 150,
      },
      {
        field: "amount",
        headerName: t("finance:amount"),
        width: 150,
        valueGetter: (params: any) => `${(params.row?.amount || 0).toLocaleString()} VND`,
      },
      {
        field: "method",
        headerName: t("finance:paymentMethod"),
        width: 130,
        renderCell: (params) => (
          <Chip
            label={getMethodLabel(params.value, t)}
            size="small"
            variant="outlined"
          />
        ),
      },
      {
        field: "paymentDate",
        headerName: t("finance:paymentDate"),
        width: 150,
        valueGetter: (params: any) => new Date(params.row?.paymentDate || Date.now()).toLocaleDateString("vi-VN"),
      },
      {
        field: "notes",
        headerName: t("common:notes"),
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
            label={t("finance:receipts")}
            onClick={() => handleGenerateReceipt((params.row as Payment).id)}
          />,
          <GridActionsCellItem
            key="delete"
            icon={<DeleteIcon />}
            label={t("common:delete")}
            onClick={() => handleDelete((params.row as Payment).id)}
          />,
        ],
      },
    ],
    [handleDelete, handleGenerateReceipt, t]
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
            {t("finance:recordPayment")}
          </Button>
        </Stack>

        {/* Filters */}
        <Stack direction="row" spacing={2} mb={2}>
          <TextField
            select
            label={t("finance:paymentMethod")}
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
            <option value="">{t("finance:allStatus")}</option>
            <option value="cash">{t("finance:cash")}</option>
            <option value="transfer">{t("finance:transfer")}</option>
            <option value="wallet">{t("finance:wallet")}</option>
          </TextField>

          <TextField
            type="date"
            label={t("common:from")}
            value={filterDateStart}
            onChange={(e) => setFilterDateStart(e.target.value)}
            size="small"
            sx={{ width: 150 }}
            InputLabelProps={{ shrink: true }}
          />

          <TextField
            type="date"
            label={t("common:to")}
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
              {t("finance:clearFilters")}
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
