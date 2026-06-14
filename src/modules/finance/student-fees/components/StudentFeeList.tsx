"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useCallback, useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { GridActionsCellItem, GridColDef } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { useTranslation } from "react-i18next";

import { BaseTable } from "@/components/BaseTable";
import { useList } from "@/hooks/useList";
import { useSnackbar } from "@/hooks/useSnackbar";

import { StudentFeeForm } from "./StudentFeeForm";

interface StudentFee {
  id: string;
  studentId: string;
  classId: string;
  month: string;
  amount: number;
  dueDate: string;
  status: "unpaid" | "partial" | "paid";
  createdAt: string;
  updatedAt: string;
}

interface ClassInfo {
  classId: string;
  className: string;
  studentCount: number;
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

const getStatusLabel = (status: string, t: (key: string) => string) => {
  const labels: Record<string, string> = {
    paid: t("finance:paidStatus"),
    partial: t("finance:partialStatus"),
    unpaid: t("finance:unpaidStatus"),
  };
  return labels[status] || status;
};

export function StudentFeeList() {
  const { t } = useTranslation(["finance", "common"]);
  const snackbar = useSnackbar();
  const [editingFee, setEditingFee] = useState<StudentFee | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [bulkData, setBulkData] = useState({
    classId: "",
    month: new Date().toISOString().slice(0, 7),
    amount: 0,
    dueDate: "",
  });
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);

  const { data: fees, isLoading, error, refresh, page, limit, setPageNumber, setPageSize } = useList<StudentFee>(
    "/api/student-fees"
  );

  // Load classes for bulk fee creation
  React.useEffect(() => {
    const loadClasses = async () => {
      try {
        setLoadingClasses(true);
        const response = await fetch("/api/classes");
        if (!response.ok) throw new Error("Failed to load classes");
        const result = await response.json();
        setClasses(result.data || []);
      } catch {
        snackbar.showError("Failed to load classes");
      } finally {
        setLoadingClasses(false);
      }
    };
    loadClasses();
  }, []);

  const handleCreate = useCallback(() => {
    setEditingFee(null);
    setShowForm(true);
  }, []);

  const handleEdit = useCallback((row: StudentFee) => {
    setEditingFee(row);
    setShowForm(true);
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm(t("common:confirmDelete"))) return;

    try {
      const response = await fetch(`/api/student-fees/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete");
      snackbar.showSuccess(t("common:deleteSuccess"));
      refresh();
    } catch {
      snackbar.showError(t("common:deleteError"));
    }
  }, [refresh, snackbar, t]);

  const handleBulkCreate = useCallback(async () => {
    if (!bulkData.classId || !bulkData.month || bulkData.amount <= 0) {
      snackbar.showError(t("common:error"));
      return;
    }

    try {
      const response = await fetch("/api/student-fees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bulkData),
      });
      if (!response.ok) throw new Error("Failed to create fees");
      snackbar.showSuccess(t("finance:createFeeSuccess"));
      setShowBulkDialog(false);
      setBulkData({
        classId: "",
        month: new Date().toISOString().slice(0, 7),
        amount: 0,
        dueDate: "",
      });
      refresh();
    } catch {
      snackbar.showError(t("common:error"));
    }
  }, [bulkData, refresh, snackbar, t]);

  const columns: GridColDef[] = useMemo(
    () => [
      { field: "id", headerName: "ID", width: 100 },
      {
        field: "studentId",
        headerName: t("finance:student"),
        width: 150,
        valueGetter: (params) => params,
      },
      {
        field: "classId",
        headerName: t("finance:class"),
        width: 150,
        valueGetter: (params) => params,
      },
      {
        field: "month",
        headerName: t("finance:month"),
        width: 120,
        valueGetter: (params) => params,
      },
      {
        field: "amount",
        headerName: t("finance:amount"),
        width: 120,
        valueGetter: (params: any) => `${(params.row?.amount || 0).toLocaleString()} VND`,
      },
      {
        field: "dueDate",
        headerName: t("finance:dueDate"),
        width: 150,
        valueGetter: (params: any) => params.row?.dueDate ? new Date(params.row.dueDate).toLocaleDateString("vi-VN") : "",
      },
      {
        field: "status",
        headerName: t("finance:status"),
        width: 150,
        renderCell: (params) => (
          <Typography
            variant="caption"
            sx={{
              px: 1.5,
              py: 0.5,
              borderRadius: 1,
              backgroundColor: `${getStatusColor(params.value)}.light`,
              color: `${getStatusColor(params.value)}.dark`,
            }}
          >
            {getStatusLabel(params.value, t)}
          </Typography>
        ),
      },
      {
        field: "actions",
        type: "actions",
        width: 120,
        getActions: (params) => [
          <GridActionsCellItem
            key="edit"
            icon={<EditIcon />}
            label={t("common:edit")}
            onClick={() => handleEdit(params.row as StudentFee)}
          />,
          <GridActionsCellItem
            key="delete"
            icon={<DeleteIcon />}
            label={t("common:delete")}
            onClick={() => handleDelete((params.row as StudentFee).id)}
          />,
        ],
      },
    ],
    [handleDelete, handleEdit, t]
  );

  return (
    <Card>
      <Box p={2}>
        <Stack direction="row" spacing={2} mb={2}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreate}
          >
            {t("finance:createStudentFee")}
          </Button>
          <Button
            variant="outlined"
            onClick={() => setShowBulkDialog(true)}
          >
            {t("finance:createStudentFee")}
          </Button>
        </Stack>

        {error && (
          <Typography color="error" mb={2}>
            {error}
          </Typography>
        )}

        <BaseTable
          rows={fees?.items || []}
          columns={columns}
          isLoading={isLoading}
          totalRows={fees?.total || 0}
          page={page - 1}
          pageSize={limit}
          onPageChange={(newPage) => setPageNumber(newPage + 1)}
          onPageSizeChange={setPageSize}
        />
      </Box>

      {/* Single Fee Form */}
      {showForm && (
        <StudentFeeForm
          initialData={editingFee || undefined}
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false);
            refresh();
          }}
        />
      )}

      {/* Bulk Create Dialog */}
      <Dialog
        open={showBulkDialog}
        onClose={() => setShowBulkDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t("finance:createStudentFee")}</DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Stack spacing={2}>
            <TextField
              select
              label={t("finance:class")}
              value={bulkData.classId}
              onChange={(e) =>
                setBulkData({ ...bulkData, classId: e.target.value })
              }
              fullWidth
              disabled={loadingClasses}
              slotProps={{
                select: {
                  native: true,
                },
              }}
            >
              <option value="">{t("finance:allStatus")}</option>
              {classes.map((cls) => (
                <option key={cls.classId} value={cls.classId}>
                  {cls.className} ({cls.studentCount} {t("finance:student")})
                </option>
              ))}
            </TextField>

            <TextField
              type="month"
              label={t("finance:month")}
              value={bulkData.month}
              onChange={(e) =>
                setBulkData({ ...bulkData, month: e.target.value })
              }
              fullWidth
              InputLabelProps={{ shrink: true }}
            />

            <TextField
              type="number"
              label={t("finance:amount")}
              value={bulkData.amount}
              onChange={(e) =>
                setBulkData({
                  ...bulkData,
                  amount: parseFloat(e.target.value) || 0,
                })
              }
              fullWidth
              inputProps={{ step: "100" }}
            />

            <TextField
              type="date"
              label={t("finance:dueDate")}
              value={bulkData.dueDate}
              onChange={(e) =>
                setBulkData({ ...bulkData, dueDate: e.target.value })
              }
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowBulkDialog(false)}>{t("common:cancel")}</Button>
          <Button
            onClick={handleBulkCreate}
            variant="contained"
            disabled={!bulkData.classId || bulkData.amount <= 0}
          >
            {t("common:create")}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
