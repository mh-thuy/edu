"use client";

import { Box, Stack, TextField, Button, Chip } from "@mui/material";
import { GridColDef } from "@mui/x-data-grid";
import { useState, useCallback } from "react";
import { BaseTable } from "@/components/BaseTable";
import { FormDialog } from "@/components/FormDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useList } from "@/hooks/useList";
import { useSnackbar } from "@/hooks/useSnackbar";
import { TeacherForm } from "./TeacherForm";
import type { ReactElement } from "react";
import type { z } from "zod";
import { teacherCreateSchema } from "@/modules/teacher/schemas/teacher.schema";

type TeacherFormData = z.infer<typeof teacherCreateSchema>;

export interface Teacher {
  id: string;
  code: string;
  phone?: string;
  email?: string;
  bankAccount?: string;
  specialty?: string;
  status: string;
}

const columns: GridColDef[] = [
  { field: "code", headerName: "Code", width: 100, flex: 0.5 },
  { field: "phone", headerName: "Phone", width: 130, flex: 0.7 },
  { field: "email", headerName: "Email", width: 150, flex: 1 },
  { field: "specialty", headerName: "Specialty", width: 120 },
  {
    field: "status",
    headerName: "Status",
    width: 100,
    renderCell: (params) => (
      <Chip
        label={params.value}
        size="small"
        color={params.value === "ACTIVE" ? "success" : "error"}
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

export function TeacherList(): ReactElement {
  const { data, isLoading, error, page, limit, setPageNumber, setPageSize, refresh } =
    useList<Teacher>("/api/teachers", { limit: 10 });

  const [openDialog, setOpenDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { showSuccess, showError, Snackbar } = useSnackbar();

  const handleCreate = useCallback(() => {
    setEditingId(null);
    setOpenDialog(true);
  }, []);

  const handleEdit = useCallback((teacher: Teacher) => {
    setEditingId(teacher.id);
    setOpenDialog(true);
  }, []);

  const handleDelete = useCallback((teacher: Teacher) => {
    setDeleteId(teacher.id);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteId) return;

    try {
      setIsSubmitting(true);
      const response = await fetch(`/api/teachers/${deleteId}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete teacher");

      showSuccess("Teacher deleted successfully");
      setDeleteId(null);
      refresh();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Error deleting teacher");
    } finally {
      setIsSubmitting(false);
    }
  }, [deleteId, refresh, showSuccess, showError]);

  const handleSubmit = useCallback(
    async (formData: TeacherFormData) => {
      try {
        setIsSubmitting(true);

        if (editingId) {
          const response = await fetch(`/api/teachers/${editingId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData),
          });
          if (!response.ok) throw new Error("Failed to update teacher");
          showSuccess("Teacher updated successfully");
        } else {
          const response = await fetch("/api/teachers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData),
          });
          if (!response.ok) throw new Error("Failed to create teacher");
          showSuccess("Teacher created successfully");
        }

        setOpenDialog(false);
        refresh();
      } catch (err) {
        showError(err instanceof Error ? err.message : "Error saving teacher");
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
        <TextField
          placeholder="Search..."
          size="small"
          sx={{ flex: 1 }}
        />
        <Button variant="contained" onClick={handleCreate}>
          Add Teacher
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
        title={editingId ? "Edit Teacher" : "Add Teacher"}
        onClose={() => setOpenDialog(false)}
        onSubmit={async () => {
          const form = document.querySelector("form") as HTMLFormElement;
          form?.requestSubmit();
        }}
        isLoading={isSubmitting}
      >
        <TeacherForm onSubmit={handleSubmit} />
      </FormDialog>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Teacher"
        message="Are you sure you want to delete this teacher?"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteId(null)}
        isLoading={isSubmitting}
      />

      {Snackbar}
    </Stack>
  );
}
