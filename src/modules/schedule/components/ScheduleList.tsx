"use client";

import AddIcon from "@mui/icons-material/Add";
import ClearIcon from "@mui/icons-material/Clear";
import EventNoteIcon from "@mui/icons-material/EventNote";
import {
  Box,
  Button,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { GridColDef } from "@mui/x-data-grid";
import { useCallback, useMemo, useState, type ReactElement } from "react";

import { ClassSelectDialog } from "@/components/shared/dialogs/ClassSelectDialog";
import { ConfirmDialog } from "@/components/shared/dialogs/ConfirmDialog";
import { FormDialog } from "@/components/shared/dialogs/FormDialog";
import { MasterSelectField } from "@/components/shared/forms/MasterSelectField";
import { BaseTable } from "@/components/shared/tables/BaseTable";
import { useDisclosure } from "@/hooks/useDisclosure";
import { useList } from "@/hooks/useList";
import { parseApiResponse } from "@/lib/api-client";
import { useSnackbar } from "@/hooks/useSnackbar";
import { intToTime } from "@/utils/date";
import { ScheduleForm, type ConflictResult } from "./ScheduleForm";

type ScheduleSubmitData = {
  classId: string;
  roomId: string;
  teacherId: string;
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
};

type ScheduleConflict = {
  id: string;
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
  class?: {
    code: string;
    name: string;
  } | null;
  room?: {
    id: string;
    code: string;
    name: string;
  } | null;
  teacher?: {
    id: string;
    code: string;
    fullName: string;
  } | null;
};

export interface Schedule {
  id: string;
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
  classId: string;
  roomId: string;
  teacherId: string;
  class?: {
    id: string;
    name: string;
    code: string;
  } | null;
  room?: {
    id: string;
    name: string;
    code: string;
  } | null;
  teacher?: {
    id: string;
    fullName: string;
    code: string;
  } | null;
}

type ScheduleRow = Schedule & {
  _onEdit?: (schedule: Schedule) => void;
  _onDelete?: (schedule: Schedule) => void;
};

type FilterClassValue = {
  id: string;
  code: string;
  name: string;
} | null;

const dayNames = [
  "Chủ nhật",
  "Thứ 2",
  "Thứ 3",
  "Thứ 4",
  "Thứ 5",
  "Thứ 6",
  "Thứ 7",
];

function buildConflictMessage(
  conflicts: ScheduleConflict[],
  formData: ScheduleSubmitData,
): string {
  const messages: string[] = [];

  if (conflicts.some((item) => item.room?.id === formData.roomId)) {
    messages.push("Phòng học đã có lịch trùng.");
  }

  if (conflicts.some((item) => item.teacher?.id === formData.teacherId)) {
    messages.push("Giáo viên đã có lịch trùng.");
  }

  const details = conflicts
    .slice(0, 2)
    .map((item) => {
      const classLabel = item.class
        ? `${item.class.code} - ${item.class.name}`
        : "Lịch hiện có";
      const dayLabel = dayNames[item.dayOfWeek] ?? `Thứ ${item.dayOfWeek}`;
      return `${classLabel} (${dayLabel}, ${intToTime(item.startMinute)}-${intToTime(item.endMinute)})`;
    })
    .join("; ");

  return details
    ? `${messages.join(" ")} ${details}`.trim()
    : messages.join(" ");
}

export function ScheduleList(): ReactElement {
  const [openDialog, setOpenDialog] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedClass, setSelectedClass] = useState<FilterClassValue>(null);
  const [dayOfWeekFilter, setDayOfWeekFilter] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasConflict, setHasConflict] = useState(false);

  const classDialog = useDisclosure();
  const { showSuccess, showError, Snackbar } = useSnackbar();

  const {
    data,
    isLoading,
    error,
    page,
    pageSize,
    setPageNumber,
    setPageSize,
    refresh,
  } = useList<Schedule>("/api/schedules", {
    pageSize: 10,
    classId: selectedClass?.id,
    dayOfWeek: dayOfWeekFilter || undefined,
  });

  const columns = useMemo<GridColDef<ScheduleRow>[]>(
    () => [
      {
        field: "dayOfWeek",
        headerName: "Ngày học",
        minWidth: 120,
        flex: 0.7,
        renderCell: (params) => dayNames[Number(params.value)] ?? params.value,
      },
      {
        field: "startMinute",
        headerName: "Giờ bắt đầu",
        minWidth: 120,
        renderCell: (params) => intToTime(Number(params.value)),
      },
      {
        field: "endMinute",
        headerName: "Giờ kết thúc",
        minWidth: 120,
        renderCell: (params) => intToTime(Number(params.value)),
      },
      {
        field: "classId",
        headerName: "Lớp học",
        minWidth: 220,
        flex: 1,
        renderCell: (params) =>
          params.row.class
            ? `${params.row.class.name} (${params.row.class.code})`
            : params.value,
      },
      {
        field: "teacherId",
        headerName: "Giáo viên",
        minWidth: 200,
        flex: 0.9,
        renderCell: (params) =>
          params.row.teacher
            ? `${params.row.teacher.fullName} (${params.row.teacher.code})`
            : "-",
      },
      {
        field: "roomId",
        headerName: "Phòng",
        minWidth: 160,
        renderCell: (params) =>
          params.row.room
            ? `${params.row.room.name} (${params.row.room.code})`
            : "-",
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
            sx={{ width: "100%", height: "100%" }}
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
    ],
    [],
  );

  const handleCreate = useCallback(() => {
    setEditingSchedule(null);
    setHasConflict(false);
    setOpenDialog(true);
  }, []);

  const handleEdit = useCallback((schedule: Schedule) => {
    setEditingSchedule(schedule);
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
        const payload = await parseApiResponse<Schedule>(response);
        if (!payload.success) {
          throw new Error(payload.error.message);
        }
      }

      showSuccess("Đã xóa lịch học thành công");
      setDeleteId(null);
      await refresh();
    } catch (error) {
      showError(
        error instanceof Error ? error.message : "Có lỗi khi xóa lịch học",
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [deleteId, refresh, showError, showSuccess]);

  const handleSubmit = useCallback(
    async (formData: ScheduleSubmitData) => {
      if (hasConflict) {
        showError(
          "Không thể lưu vì lịch học đang bị trùng phòng hoặc giáo viên.",
        );
        return;
      }

      try {
        setIsSubmitting(true);

        const isEdit = Boolean(editingSchedule?.id);
        const scheduleId = editingSchedule?.id;
        const response = await fetch(
          isEdit && scheduleId
            ? `/api/schedules/${scheduleId}`
            : "/api/schedules",
          {
            method: isEdit ? "PATCH" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData),
          },
        );

        const payload = await parseApiResponse<Schedule>(response);

        if (!payload.success) {
          if (payload.error.code === "CONFLICT") {
            const details = payload.error.details as
              | { conflicts?: ScheduleConflict[] }
              | undefined;
            const conflicts = details?.conflicts ?? [];

            throw new Error(
              conflicts.length > 0
                ? buildConflictMessage(conflicts, formData)
                : payload.error.message,
            );
          }

          throw new Error(payload.error.message);
        }

        showSuccess(
          isEdit
            ? "Đã cập nhật lịch học thành công"
            : "Đã thêm lịch học thành công",
        );

        setOpenDialog(false);
        setEditingSchedule(null);
        setHasConflict(false);
        await refresh();
      } catch (error) {
        showError(
          error instanceof Error ? error.message : "Có lỗi khi lưu lịch học",
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [editingSchedule, hasConflict, refresh, showError, showSuccess],
  );

  const handleResetFilters = useCallback(() => {
    setSelectedClass(null);
    setDayOfWeekFilter("");
    setPageNumber(1);
  }, [setPageNumber]);

  const tableData: ScheduleRow[] = (data?.items ?? []).map((row) => ({
    ...row,
    _onEdit: handleEdit,
    _onDelete: handleDelete,
  }));

  return (
    <Stack spacing={2.5}>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, sm: 3 }, // Linh hoạt không gian: 16px cho mobile, 24px cho desktop
          borderRadius: 3,
          border: "1px solid",
          borderColor: "divider",
          bgcolor: "background.paper",
        }}
      >
        <Stack spacing={3}>
          {" "}
          {/* Tăng nhẹ spacing lên 3 để tách biệt Header và Filter rõ ràng hơn */}
          {/* Header Section */}
          <Stack
            direction={{ xs: "column", sm: "row" }} // Chuyển đổi từ màn 'sm' sẽ mượt mà hơn 'md' đối với cụm header ngắn
            spacing={2}
            alignItems={{ xs: "stretch", sm: "center" }}
            justifyContent="space-between"
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <Box
                sx={{
                  width: 46,
                  height: 46,
                  borderRadius: 2.5, // Bo góc mềm mại hơn một chút phù hợp với Paper
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  bgcolor: "primary.lighter", // Nếu theme hỗ trợ, dùng tone nhạt + icon đậm sẽ sang hơn
                  color: "primary.main", // Thay đổi cặp màu: Nền nhạt - Chữ/Icon đậm
                  // Nếu không dùng primary.lighter, bạn giữ nguyên:
                  // bgcolor: "primary.main", color: "primary.contrastText"
                }}
              >
                <EventNoteIcon fontSize="medium" />
              </Box>

              <Box>
                <Typography variant="h6" fontWeight={700} lineHeight={1.3}>
                  Quản lý lịch học
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 0.5 }}
                >
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
                px: 3,
                height: 40,
                whiteSpace: "nowrap",
                boxShadow: "none", // Loại bỏ shadow quá đậm của mặc địnhcontained mang lại cảm giác flat-modern
                "&:hover": { boxShadow: "none" },
              }}
            >
              Thêm lịch học
            </Button>
          </Stack>
          {/* Filters Section */}
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            alignItems={{ xs: "stretch", md: "center" }} // Đổi từ flex-end sang center để các thành phần 40px thẳng hàng tăm tắp
          >
            {/* Ô lọc theo lớp */}
            <Box sx={{ flex: 1 }}>
              <MasterSelectField
                label="Lọc theo lớp"
                value={selectedClass}
                onOpen={classDialog.onOpen}
                codeLabel="Mã lớp"
                nameLabel="Tên lớp"
              />
            </Box>

            {/* Ô lọc theo ngày */}
            <TextField
              select
              label="Lọc theo ngày"
              value={dayOfWeekFilter}
              onChange={(event) => {
                setDayOfWeekFilter(event.target.value);
                setPageNumber(1);
              }}
              sx={{
                width: { xs: "100%", md: 220 },
                "& .MuiInputLabel-root": {
                  bgcolor: "background.paper",
                  px: 0.5,
                }, // Tránh lỗi label đè viền khi thu nhỏ
              }}
            >
              <MenuItem value="">Tất cả ngày</MenuItem>
              {dayNames.map((label, index) => (
                <MenuItem key={label} value={String(index)}>
                  {label}
                </MenuItem>
              ))}
            </TextField>

            {/* Nút Xóa lọc */}
            <Button
              variant="outlined"
              color="secondary" // Thay 'inherit' bằng 'secondary' hoặc màu xám để nút rõ ràng, không bị chìm
              startIcon={<ClearIcon />}
              onClick={handleResetFilters}
              sx={{
                height: 40, // Chuẩn 40px bằng với 2 ô input trên
                minWidth: { xs: "100%", md: 120 },
                borderRadius: 1.5,
                borderColor: "divider",
                textTransform: "none", // Giữ chữ thường tự nhiên thay vì UPPERCASE mặc định nếu cấu hình theme chưa tắt
              }}
            >
              Xóa lọc
            </Button>
          </Stack>
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
                  classId: editingSchedule.classId,
                  classCode: editingSchedule.class?.code ?? "",
                  className: editingSchedule.class?.name ?? "",
                  roomId: editingSchedule.roomId,
                  roomCode: editingSchedule.room?.code ?? "",
                  roomName: editingSchedule.room?.name ?? "",
                  teacherId: editingSchedule.teacherId,
                  teacherCode: editingSchedule.teacher?.code ?? "",
                  teacherName: editingSchedule.teacher?.fullName ?? "",
                  dayOfWeek: editingSchedule.dayOfWeek,
                  startMinute: editingSchedule.startMinute,
                  endMinute: editingSchedule.endMinute,
                }
              : undefined
          }
          onConflictCheck={(result: ConflictResult) => {
            setHasConflict(result.hasConflict);
          }}
        />
      </FormDialog>

      <ConfirmDialog
        open={!!deleteId}
        title="Xóa lịch học"
        message="Bạn có chắc chắn muốn xóa lịch học này không?"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteId(null)}
        isLoading={isSubmitting}
      />

      <ClassSelectDialog
        open={classDialog.open}
        onClose={classDialog.onClose}
        onSelect={(classItem) => {
          setSelectedClass({
            id: classItem.id,
            code: classItem.code,
            name: classItem.name,
          });
          setPageNumber(1);
          classDialog.onClose();
        }}
      />

      {Snackbar}
    </Stack>
  );
}
