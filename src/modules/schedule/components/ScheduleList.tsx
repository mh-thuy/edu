"use client";

import { Box, Stack, Button, Typography } from "@mui/material";
import { GridColDef } from "@mui/x-data-grid";
import { useState, useCallback } from "react";
import { BaseTable } from "@/components/BaseTable";
import { FormDialog } from "@/components/FormDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useList } from "@/hooks/useList";
import { useSnackbar } from "@/hooks/useSnackbar";
import { ScheduleForm } from "./ScheduleForm";
import type { ReactElement } from "react";
import type { z } from "zod";
import { classScheduleCreateSchema } from "@/modules/schedule/schemas/schedule.schema";

type ScheduleFormData = z.infer<typeof classScheduleCreateSchema>;

const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export interface Schedule {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  classId: string;
  roomId?: string;
}

const columns: GridColDef[] = [
  {
    field: "dayOfWeek",
    headerName: "Day",
    width: 100,
    renderCell: (params) => dayNames[params.value] || params.value,
  },
  { field: "startTime", headerName: "Start Time", width: 120 },
  { field: "endTime", headerName: "End Time", width: 120 },
  { field: "classId", headerName: "Class", width: 150, flex: 1 },
  { field: "roomId", headerName: "Room", width: 100 },
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

export function ScheduleList(): ReactElement {
  const { data, isLoading, error, page, limit, setPageNumber, setPageSize, refresh } =
    useList<Schedule>("/api/schedules", { limit: 10 });

  const [openDialog, setOpenDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);

  const { showSuccess, showError, Snackbar } = useSnackbar();

  const handleCreate = useCallback(() => {
    setEditingId(null);
    setOpenDialog(true);
    setConflictWarning(null);
  }, []);

  const handleEdit = useCallback((schedule: Schedule) => {
    setEditingId(schedule.id);
    setOpenDialog(true);
    setConflictWarning(null);
  }, []);

  const handleDelete = useCallback((schedule: Schedule) => {
    setDeleteId(schedule.id);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteId) return;

    try {
      setIsSubmitting(true);
      const response = await fetch(`/api/schedules/${deleteId}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete schedule");

      showSuccess("Schedule deleted successfully");
      setDeleteId(null);
      refresh();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Error deleting schedule");
    } finally {
      setIsSubmitting(false);
    }
  }, [deleteId, refresh, showSuccess, showError]);

  const handleSubmit = useCallback(
    async (formData: ScheduleFormData) => {
      try {
        setIsSubmitting(true);

        if (editingId) {
          const response = await fetch(`/api/schedules/${editingId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData),
          });
          if (!response.ok) throw new Error("Failed to update schedule");
          showSuccess("Schedule updated successfully");
        } else {
          const response = await fetch("/api/schedules", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData),
          });
          if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || "Failed to create schedule");
          }
          showSuccess("Schedule created successfully");
        }

        setOpenDialog(false);
        refresh();
      } catch (err) {
        showError(err instanceof Error ? err.message : "Error saving schedule");
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
        <Typography sx={{ flex: 1, alignSelf: "center", fontSize: "14px" }}>
          Schedules with automatic conflict detection
        </Typography>
        <Button variant="contained" onClick={handleCreate}>
          Add Schedule
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
        title={editingId ? "Edit Schedule" : "Add Schedule"}
        onClose={() => setOpenDialog(false)}
        onSubmit={async () => {
          const form = document.querySelector("form") as HTMLFormElement;
          form?.requestSubmit();
        }}
        isLoading={isSubmitting}
      >
        <ScheduleForm
          onSubmit={handleSubmit}
          onConflictCheck={(data) => {
            if (data.hasConflict) {
              setConflictWarning("Room conflict detected!");
            } else {
              setConflictWarning(null);
            }
          }}
        />
        {conflictWarning && <Box sx={{ color: "orange", fontSize: "12px", mt: 1 }}>{conflictWarning}</Box>}
      </FormDialog>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Schedule"
        message="Are you sure you want to delete this schedule?"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteId(null)}
        isLoading={isSubmitting}
      />

      {Snackbar}
    </Stack>
  );
}
