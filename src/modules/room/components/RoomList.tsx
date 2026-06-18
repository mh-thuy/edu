"use client";

import {
  Box,
  Stack,
  TextField,
  Button,
  Chip,
  Paper,
  Typography,
  InputAdornment,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import MeetingRoomIcon from "@mui/icons-material/MeetingRoom";
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
  status: "AVAILABLE" | "MAINTENANCE" | "UNAVAILABLE";
  note?: string;
}

const columns: GridColDef[] = [
  {
    field: "code",
    headerName: "Mã phòng",
    minWidth: 110,
    flex: 0.6,
  },
  {
    field: "name",
    headerName: "Tên phòng",
    minWidth: 180,
    flex: 1,
  },
  {
    field: "capacity",
    headerName: "Sức chứa",
    minWidth: 110,
  },
  {
    field: "floor",
    headerName: "Tầng",
    minWidth: 90,
  },
  {
    field: "location",
    headerName: "Vị trí",
    minWidth: 150,
    flex: 0.8,
  },
  {
    field: "status",
    headerName: "Trạng thái",
    minWidth: 140,
    align: "center",
    headerAlign: "center",
    renderCell: (params) => {
      const status = params.value;

      const label =
        status === "AVAILABLE"
          ? "Trống"
          : status === "OCCUPIED"
            ? "Đang dùng"
            : "Bảo trì";

      return (
        <Box
          sx={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Chip
            label={label}
            size="small"
            color={
              status === "AVAILABLE"
                ? "success"
                : status === "OCCUPIED"
                  ? "warning"
                  : "error"
            }
            variant="outlined"
            sx={{
              minWidth: 90,
              fontWeight: 600,
              borderRadius: 999,
            }}
          />
        </Box>
      );
    },
  },
  {
    field: "actions",
    headerName: "Thao tác",
    minWidth: 150,
    sortable: false,
    filterable: false,
    disableColumnMenu: true,
    align: "center",
    headerAlign: "center",
    renderCell: (params) => (
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        justifyContent="center"
        sx={{
          width: "100%",
          height: "100%",
        }}
      >
        <Button
          size="small"
          variant="contained"
          onClick={() => params.row._onEdit?.(params.row)}
          sx={{
            minWidth: 56,
            height: 30,
            borderRadius: 1.5,
            textTransform: "none",
          }}
        >
          Sửa
        </Button>

        <Button
          size="small"
          variant="contained"
          color="error"
          onClick={() => params.row._onDelete?.(params.row)}
          sx={{
            minWidth: 56,
            height: 30,
            borderRadius: 1.5,
            textTransform: "none",
          }}
        >
          Xóa
        </Button>
      </Stack>
    ),
  },
];

export function RoomList(): ReactElement {
  const [search, setSearch] = useState("");

  const {
    data,
    isLoading,
    error,
    page,
    pageSize,
    setPageNumber,
    setPageSize,
    refresh,
  } = useList<Room>("/api/rooms", { pageSize: 10, search });

  const [openDialog, setOpenDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [editingRoom, setEditingRoom] = useState<Room | null>(null);

  const { showSuccess, showError, Snackbar } = useSnackbar();

  const handleCreate = useCallback(() => {
    setEditingId(null);
    setEditingRoom(null);
    setOpenDialog(true);
  }, []);

  const handleEdit = useCallback((room: Room) => {
    setEditingId(room.id);
    setEditingRoom(room);
    setOpenDialog(true);
  }, []);

  const handleDelete = useCallback((room: Room) => {
    setDeleteId(room.id);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteId) return;

    try {
      setIsSubmitting(true);
      const response = await fetch(`/api/rooms/${deleteId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete room");

      showSuccess("Xóa phòng thành công");
      setDeleteId(null);
      refresh();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Lỗi khi xóa phòng");
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
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData),
          });
          if (!response.ok) throw new Error("Failed to update room");
          showSuccess("Cập nhật phòng thành công");
        } else {
          const response = await fetch("/api/rooms", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData),
          });
          if (!response.ok) throw new Error("Failed to create room");
          showSuccess("Thêm phòng thành công");
        }

        setOpenDialog(false);
        refresh();
      } catch (err) {
        showError(err instanceof Error ? err.message : "Lỗi khi lưu phòng");
      } finally {
        setIsSubmitting(false);
      }
    },
    [editingId, refresh, showSuccess, showError],
  );

  const tableData = (data?.items || []).map((row) => ({
    ...row,
    _onEdit: handleEdit,
    _onDelete: handleDelete,
  }));

  return (
    <Stack spacing={2.5}>
      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          borderRadius: 3,
          border: "1px solid",
          borderColor: "divider",
          bgcolor: "background.paper",
        }}
      >
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          alignItems={{ xs: "stretch", md: "center" }}
          justifyContent="space-between"
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: 2,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: "primary.main",
                color: "primary.contrastText",
              }}
            >
              <MeetingRoomIcon />
            </Box>

            <Box>
              <Typography variant="h6" fontWeight={700}>
                Quản lý phòng
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Danh sách phòng học, trạng thái và sức chứa
              </Typography>
            </Box>
          </Box>

          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreate}
            sx={{
              borderRadius: 2,
              px: 2.5,
              height: 40,
              whiteSpace: "nowrap",
            }}
          >
            Thêm phòng
          </Button>
        </Stack>

        <Box sx={{ mt: 2.5 }}>
          <TextField
            placeholder="Tìm theo mã phòng hoặc tên phòng..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            size="small"
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" color="action" />
                </InputAdornment>
              ),
            }}
            sx={{
              maxWidth: 420,
              "& .MuiOutlinedInput-root": {
                borderRadius: 2,
                bgcolor: "background.default",
              },
            }}
          />
        </Box>
      </Paper>

      <Paper
        elevation={0}
        sx={{
          borderRadius: 3,
          border: "1px solid",
          borderColor: "divider",
          overflow: "hidden",
          bgcolor: "background.paper",
        }}
      >
        <BaseTable
          columns={columns}
          rows={tableData}
          totalRows={data?.total || 0}
          page={page}
          pageSize={pageSize}
          isLoading={isLoading}
          onPageChange={setPageNumber}
          onPageSizeChange={setPageSize}
          error={error}
        />
      </Paper>

      <FormDialog
        open={openDialog}
        title={editingId ? "Sửa phòng" : "Thêm phòng"}
        onClose={() => setOpenDialog(false)}
        formId="room-form"
        isLoading={isSubmitting}
      >
        <RoomForm
          formId="room-form"
          key={editingId ?? "create"}
          defaultValues={editingRoom ?? undefined}
          onSubmit={handleSubmit}
        />
      </FormDialog>

      <ConfirmDialog
        open={!!deleteId}
        title="Xóa phòng"
        message="Bạn có chắc chắn muốn xóa phòng này không?"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteId(null)}
        isLoading={isSubmitting}
      />

      {Snackbar}
    </Stack>
  );
}
