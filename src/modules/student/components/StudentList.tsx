"use client";

import { Box, Stack, TextField, Button, Chip } from "@mui/material";
import { GridColDef } from "@mui/x-data-grid";
import { useState, useCallback } from "react";
import { BaseTable } from "@/components/BaseTable";
import { FormDialog } from "@/components/FormDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useList } from "@/hooks/useList";
import { useSnackbar } from "@/hooks/useSnackbar";
import { StudentForm } from "./StudentForm";
import type { ReactElement } from "react";
import type { z } from "zod";
import { studentCreateSchema } from "@/modules/student/schemas/student.schema";

type StudentFormData = z.infer<typeof studentCreateSchema>;

export interface Student {
  id: string;
  code: string;
  fullName: string;
  email?: string;
  phone?: string;
  status: string;
}

const columns: GridColDef[] = [
  { field: "code", headerName: "Code", width: 100, flex: 0.5 },
  { field: "fullName", headerName: "Full Name", width: 150, flex: 1 },
  { field: "email", headerName: "Email", width: 150, flex: 1 },
  { field: "phone", headerName: "Phone", width: 130 },
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

export function StudentList(): ReactElement {
  const { data, isLoading, error, page, limit, setPageNumber, setPageSize, refresh } =
    useList<Student>("/api/students", { limit: 10 });

  const [openDialog, setOpenDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { showSuccess, showError, Snackbar } = useSnackbar();

  const handleCreate = useCallback(() => {
    setEditingId(null);
    setOpenDialog(true);
  }, []);

  const handleEdit = useCallback((student: Student) => {
    setEditingId(student.id);
    setOpenDialog(true);
  }, []);

  const handleDelete = useCallback((student: Student) => {
    setDeleteId(student.id);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteId) return;

    try {
      setIsSubmitting(true);
      const response = await fetch(`/api/students/${deleteId}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete student");

      showSuccess("Student deleted successfully");
      setDeleteId(null);
      refresh();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Error deleting student");
    } finally {
      setIsSubmitting(false);
    }
  }, [deleteId, refresh, showSuccess, showError]);

  const handleSubmit = useCallback(
    async (formData: StudentFormData) => {
      try {
        setIsSubmitting(true);

        if (editingId) {
          const response = await fetch(`/api/students/${editingId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData),
          });
          if (!response.ok) throw new Error("Failed to update student");
          showSuccess("Student updated successfully");
        } else {
          const response = await fetch("/api/students", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData),
          });
          if (!response.ok) throw new Error("Failed to create student");
          showSuccess("Student created successfully");
        }

        setOpenDialog(false);
        refresh();
      } catch (err) {
        showError(err instanceof Error ? err.message : "Error saving student");
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
          Add Student
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
        title={editingId ? "Edit Student" : "Add Student"}
        onClose={() => setOpenDialog(false)}
        onSubmit={async () => {
          const form = document.querySelector("form") as HTMLFormElement;
          form?.requestSubmit();
        }}
        isLoading={isSubmitting}
      >
        <StudentForm onSubmit={handleSubmit} />
      </FormDialog>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Student"
        message="Are you sure you want to delete this student?"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteId(null)}
        isLoading={isSubmitting}
      />

      {Snackbar}
    </Stack>
  );
}
