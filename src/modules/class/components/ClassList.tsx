"use client";

import { Box, Stack, TextField, Button, Chip } from "@mui/material";
import { GridColDef } from "@mui/x-data-grid";
import { useState, useCallback } from "react";
import { BaseTable } from "@/components/BaseTable";
import { FormDialog } from "@/components/FormDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useList } from "@/hooks/useList";
import { useSnackbar } from "@/hooks/useSnackbar";
import { ClassForm } from "./ClassForm";
import type { ReactElement } from "react";
import type { z } from "zod";
import { classCreateSchema } from "@/modules/class/schemas/class.schema";

type ClassFormData = z.infer<typeof classCreateSchema>;

export interface Class {
  id: string;
  code: string;
  name: string;
  tuitionFee: number;
  totalSessions: number;
  maxStudents: number;
  status: string;
}

const columns: GridColDef[] = [
  { field: "code", headerName: "Code", width: 100, flex: 0.5 },
  { field: "name", headerName: "Name", width: 150, flex: 1 },
  { field: "tuitionFee", headerName: "Tuition Fee", width: 120 },
  { field: "totalSessions", headerName: "Sessions", width: 100 },
  { field: "maxStudents", headerName: "Max Students", width: 120 },
  {
    field: "status",
    headerName: "Status",
    width: 100,
    renderCell: (params) => (
      <Chip
        label={params.value}
        size="small"
        color={
          params.value === "ACTIVE"
            ? "success"
            : params.value === "DRAFT"
              ? "default"
              : "error"
        }
        variant="outlined"
      />
    ),
  },
  {
    field: "actions",
    headerName: "Actions",
    width: 150,
    sortable: false,
    renderCell: (params) => (
      <Box sx={{ display: "flex", gap: 1 }}>
        <Button size="small" variant="outlined" onClick={() => params.row._onEdit?.(params.row)}>
          Edit
        </Button>
        <Button
          size="small"
          variant="outlined"
          color="error"
          onClick={() => params.row._onDelete?.(params.row)}
        >
          Delete
        </Button>
      </Box>
    ),
  },
];

export function ClassList(): ReactElement {
  const { data, isLoading, error, page, limit, setPageNumber, setPageSize, refresh } =
    useList<Class>("/api/classes", { limit: 10 });

  const [openDialog, setOpenDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { showSuccess, showError, Snackbar } = useSnackbar();

  const handleCreate = useCallback(() => {
    setEditingId(null);
    setOpenDialog(true);
  }, []);

  const handleEdit = useCallback((cls: Class) => {
    setEditingId(cls.id);
    setOpenDialog(true);
  }, []);

  const handleDelete = useCallback((cls: Class) => {
    setDeleteId(cls.id);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteId) return;

    try {
      setIsSubmitting(true);
      const response = await fetch(`/api/classes/${deleteId}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete class");

      showSuccess("Class deleted successfully");
      setDeleteId(null);
      refresh();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Error deleting class");
    } finally {
      setIsSubmitting(false);
    }
  }, [deleteId, refresh, showSuccess, showError]);

  const handleSubmit = useCallback(
    async (formData: ClassFormData) => {
      try {
        setIsSubmitting(true);

        if (editingId) {
          const response = await fetch(`/api/classes/${editingId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData),
          });
          if (!response.ok) throw new Error("Failed to update class");
          showSuccess("Class updated successfully");
        } else {
          const response = await fetch("/api/classes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData),
          });
          if (!response.ok) throw new Error("Failed to create class");
          showSuccess("Class created successfully");
        }

        setOpenDialog(false);
        refresh();
      } catch (err) {
        showError(err instanceof Error ? err.message : "Error saving class");
      } finally {
        setIsSubmitting(false);
      }
    },
    [editingId, refresh, showSuccess, showError]
  );

  const tableData = (data?.items || []).map((row) => ({
    ...row,
    _onEdit: handleEdit,
    _onDelete: handleDelete,
  }));

  return (
    <Stack spacing={2}>
      <Box sx={{ display: "flex", gap: 2 }}>
        <TextField placeholder="Search..." size="small" sx={{ flex: 1 }} />
        <Button variant="contained" onClick={handleCreate}>
          Add Class
        </Button>
      </Box>

      <BaseTable
        columns={columns}
        rows={tableData}
        totalRows={data?.total || 0}
        page={page}
        pageSize={limit}
        isLoading={isLoading}
        onPageChange={setPageNumber}
        onPageSizeChange={setPageSize}
        error={error}
      />

      <FormDialog
        open={openDialog}
        title={editingId ? "Edit Class" : "Add Class"}
        onClose={() => setOpenDialog(false)}
        onSubmit={async () => {
          const form = document.querySelector("form") as HTMLFormElement;
          form?.requestSubmit();
        }}
        isLoading={isSubmitting}
      >
        <ClassForm onSubmit={handleSubmit} />
      </FormDialog>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Class"
        message="Are you sure you want to delete this class?"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteId(null)}
        isLoading={isSubmitting}
      />

      {Snackbar}
    </Stack>
  );
}
