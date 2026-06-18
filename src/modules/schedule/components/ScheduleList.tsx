"use client";

import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EventNoteIcon from "@mui/icons-material/EventNote";
import type { GridColDef } from "@mui/x-data-grid";
import { useCallback, useState, type ReactElement } from "react";

import { BaseTable } from "@/components/shared/tables/BaseTable";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FormDialog } from "@/components/FormDialog";
import { useList } from "@/hooks/useList";
import { useSnackbar } from "@/hooks/useSnackbar";
import { ScheduleForm } from "./ScheduleForm";
import { extractApiErrorMessage } from "@/lib/api-client";

type ScheduleSubmitData = {
  classId: string;
  roomId?: string | null;
  teacherId?: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

type ConflictResult = {
  hasConflict: boolean;
  conflicts?: unknown[];
};

export interface Schedule {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;

  classId: string;
  roomId?: string | null;
  teacherId?: string | null;

  class?: {
    id: string;
    name: string;
    code: string;
  };

  room?: {
    id: string;
    name: string;
    code: string;
  } | null;

  teacher?: {
    id: string;
    name: string;
    code: string;
  } | null;
}

type ScheduleRow = Schedule & {
  _onEdit?: (schedule: Schedule) => void;
  _onDelete?: (schedule: Schedule) => void;
};

const dayNames = [
  "Thứ 2",
  "Thứ 3",
  "Thứ 4",
  "Thứ 5",
  "Thứ 6",
  "Thứ 7",
  "Chủ nhật",
];

const columns: GridColDef<ScheduleRow>[] = [
  {
    field: "dayOfWeek",
    headerName: "Ngày học",
    minWidth: 120,
    flex: 0.7,
    renderCell: (params) => {
      const dayIndex = Number(params.value);
      return dayNames[dayIndex] ?? params.value;
    },
  },
  {
    field: "startTime",
    headerName: "Giờ bắt đầu",
    minWidth: 120,
  },
  {
    field: "endTime",
    headerName: "Giờ kết thúc",
    minWidth: 120,
  },
  {
    field: "classId",
    headerName: "Lớp học",
    minWidth: 200,
    flex: 1,
    renderCell: (params) => {
      const classData = params.row.class;

      if (!classData) return params.value;

      return `${classData.name} (${classData.code})`;
    },
  },
  {
    field: "roomId",
    headerName: "Phòng",
    minWidth: 150,
    renderCell: (params) => {
      const roomData = params.row.room;

      if (!roomData) return "-";

      return `${roomData.name} (${roomData.code})`;
    },
  },
  {
    field: "timeRange",
    headerName: "Thời lượng",
    minWidth: 150,
    sortable: false,
    filterable: false,
    disableColumnMenu: true,
    renderCell: (params) => (
      <Chip
        label={`${params.row.startTime} - ${params.row.endTime}`}
        size="small"
        variant="outlined"
        sx={{
          fontWeight: 600,
          borderRadius: 999,
        }}
      />
    ),
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

export function ScheduleList(): ReactElement {
  const {
    data,
    isLoading,
    error,
    page,
    pageSize,
    setPageNumber,
    setPageSize,
    refresh,
  } = useList<Schedule>("/api/schedules", { pageSize: 10 });

  const [openDialog, setOpenDialog] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasConflict, setHasConflict] = useState(false);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);

  const { showSuccess, showError, Snackbar } = useSnackbar();

  const handleCreate = useCallback(() => {
    setEditingSchedule(null);
    setConflictWarning(null);
    setHasConflict(false);
    setOpenDialog(true);
  }, []);

  const handleEdit = useCallback((schedule: Schedule) => {
    setEditingSchedule(schedule);
    setConflictWarning(null);
    setHasConflict(false);
    setOpenDialog(true);
  }, []);

  const handleDelete = useCallback((schedule: Schedule) => {
    setDeleteId(schedule.id);
  }, []);

  const handleCloseDialog = useCallback(() => {
    if (isSubmitting) return;

    setOpenDialog(false);
    setEditingSchedule(null);
    setConflictWarning(null);
    setHasConflict(false);
  }, [isSubmitting]);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteId) return;

    try {
      setIsSubmitting(true);

      const response = await fetch(`/api/schedules/${deleteId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Xóa lịch học thất bại");
      }

      showSuccess("Đã xóa lịch học thành công");
      setDeleteId(null);
      await refresh();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Có lỗi khi xóa lịch học");
    } finally {
      setIsSubmitting(false);
    }
  }, [deleteId, refresh, showSuccess, showError]);

  const handleSubmit = useCallback(
    async (formData: ScheduleSubmitData) => {
      if (hasConflict) {
        showError("Không thể lưu do trùng lịch phòng học");
        return;
      }

      try {
        setIsSubmitting(true);

        const isEdit = !!editingSchedule?.id;

        const response = await fetch(
          isEdit ? `/api/schedules/${editingSchedule.id}` : "/api/schedules",
          {
            method: isEdit ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData),
          },
        );

        if (!response.ok) {
          let message = isEdit
            ? "Cập nhật lịch học thất bại"
            : "Thêm lịch học thất bại";

          try {
            message = await extractApiErrorMessage(response, message);
          } catch {
            // Ignore JSON parse error
          }

          throw new Error(message);
        }

        showSuccess(
          isEdit
            ? "Đã cập nhật lịch học thành công"
            : "Đã thêm lịch học thành công",
        );

        setOpenDialog(false);
        setEditingSchedule(null);
        setConflictWarning(null);
        setHasConflict(false);
        await refresh();
      } catch (err) {
        showError(
          err instanceof Error ? err.message : "Có lỗi khi lưu lịch học",
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [editingSchedule, hasConflict, refresh, showSuccess, showError],
  );

  const tableData: ScheduleRow[] = (data?.items ?? []).map((row) => ({
    ...row,
    roomId: row.roomId ?? "",
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
              <EventNoteIcon />
            </Box>

            <Box>
              <Typography variant="h6" fontWeight={700}>
                Quản lý lịch học
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Danh sách lịch học, phòng học và tự động kiểm tra trùng lịch
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
            Thêm lịch học
          </Button>
        </Stack>
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
          totalRows={data?.total ?? 0}
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
        title={editingSchedule ? "Sửa lịch học" : "Thêm lịch học"}
        onClose={handleCloseDialog}
        formId="schedule-form"
        isLoading={isSubmitting}
      >
        <ScheduleForm
          key={editingSchedule?.id ?? "create"}
          formId="schedule-form"
          onSubmit={handleSubmit}
          scheduleId={editingSchedule?.id}
          defaultValues={
            editingSchedule
              ? {
                  classId: editingSchedule.classId ?? "",
                  classCode: editingSchedule.class?.code ?? "",
                  className: editingSchedule.class?.name ?? "",

                  roomId: editingSchedule.roomId ?? "",
                  roomCode: editingSchedule.room?.code ?? "",
                  roomName: editingSchedule.room?.name ?? "",

                  teacherId: editingSchedule.teacherId ?? "",

                  dayOfWeek: editingSchedule.dayOfWeek,
                  startTime: editingSchedule.startTime ?? "",
                  endTime: editingSchedule.endTime ?? "",
                }
              : undefined
          }
          onConflictCheck={(data: ConflictResult) => {
            setHasConflict(data.hasConflict);

            if (data.hasConflict) {
              setConflictWarning("Phát hiện trùng lịch phòng học!");
            } else {
              setConflictWarning(null);
            }
          }}
        />

        {conflictWarning && (
          <Alert severity="warning" sx={{ mt: 2, borderRadius: 2 }}>
            {conflictWarning}
          </Alert>
        )}
      </FormDialog>

      <ConfirmDialog
        open={!!deleteId}
        title="Xóa lịch học"
        message="Bạn có chắc chắn muốn xóa lịch học này không?"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteId(null)}
        isLoading={isSubmitting}
      />

      {Snackbar}
    </Stack>
  );
}
