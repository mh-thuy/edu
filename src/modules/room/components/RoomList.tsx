"use client";

import { Box, Stack, TextField, Button, Chip } from "@mui/material";
import { GridColDef } from "@mui/x-data-grid";
import { useState, useCallback } from "react";
import { BaseTable } from "@/components/BaseTable";
import { FormDialog } from "@/components/FormDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useList } from "@/hooks/useList";
import { useSnackbar } from "@/hooks/useSnackbar";
import { RoomForm } from "./RoomForm";
import type { ReactElement } from "react";
import type { z } from "zod";
import { roomCreateSchema } from "@/modules/room/schemas/room.schema";

type RoomFormData = z.infer<typeof roomCreateSchema>;

export interface Room {
  id: string;
  code: string;
  name: string;
  capacity: number;
  floor: number;
  location?: string;
  status: string;
  note?: string;
}

const columns: GridColDef[] = [
  { field: "code", headerName: "Code", width: 100, flex: 0.5 },
  { field: "name", headerName: "Name", width: 150, flex: 1 },
  { field: "capacity", headerName: "Capacity", width: 100 },
  { field: "floor", headerName: "Floor", width: 80 },
  { field: "location", headerName: "Location", width: 120 },
  {
    field: "status",
    headerName: "Status",
    width: 120,
    renderCell: (params) => (
      <Chip
        label={params.value}
        size="small"
        color={
          params.value === "AVAILABLE"
            ? "success"
            : params.value === "OCCUPIED"
              ? "warning"
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

export function RoomList(): ReactElement {
  const { data, isLoading, error, page, limit, setPageNumber, setPageSize, refresh } =
    useList<Room>("/api/rooms", { limit: 10 });

  const [openDialog, setOpenDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [search, setSearch] = useState("");

  const { showSuccess, showError, Snackbar } = useSnackbar();

  const handleCreate = useCallback(() => {
    setEditingId(null);
    setOpenDialog(true);
  }, []);

  const handleEdit = useCallback((room: Room) => {
    setEditingId(room.id);
    setOpenDialog(true);
  }, []);

  const handleDelete = useCallback((room: Room) => {
    setDeleteId(room.id);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteId) return;

    try {
      setIsSubmitting(true);
      const response = await fetch(`/api/rooms/${deleteId}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete room");

      showSuccess("Room deleted successfully");
      setDeleteId(null);
      refresh();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Error deleting room");
    } finally {
      setIsSubmitting(false);
    }
  }, [deleteId, refresh, showSuccess, showError]);

  const handleSubmit = useCallback(
    async (formData: RoomFormData) => {
      try {
        setIsSubmitting(true);

        if (editingId) {
          const response = await fetch(`/api/rooms/${editingId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData),
          });
          if (!response.ok) throw new Error("Failed to update room");
          showSuccess("Room updated successfully");
        } else {
          const response = await fetch("/api/rooms", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData),
          });
          if (!response.ok) throw new Error("Failed to create room");
          showSuccess("Room created successfully");
        }

        setOpenDialog(false);
        refresh();
      } catch (err) {
        showError(err instanceof Error ? err.message : "Error saving room");
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
      <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
        <TextField
          placeholder="Search by code or name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          size="small"
          sx={{ flex: 1 }}
        />
        <Button variant="contained" onClick={handleCreate}>
          Add Room
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
        title={editingId ? "Edit Room" : "Add Room"}
        onClose={() => setOpenDialog(false)}
        onSubmit={async () => {
          const form = document.querySelector("form") as HTMLFormElement;
          form?.requestSubmit();
        }}
        isLoading={isSubmitting}
      >
        <RoomForm onSubmit={handleSubmit} />
      </FormDialog>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Room"
        message="Are you sure you want to delete this room?"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteId(null)}
        isLoading={isSubmitting}
      />

      {Snackbar}
    </Stack>
  );
}
