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
import ClassIcon from "@mui/icons-material/Class";
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
  teacherId?: string | null;
  roomId?: string | null;
  tuitionFee: number;
  totalSessions: number;
  maxStudents: number;
  startDate?: string | null;
  endDate?: string | null;
  status: "ACTIVE" | "DRAFT" | "COMPLETED" | "CANCELLED";
  teacher?: {
    code?: string;
    user?: {
      fullName?: string | null;
    } | null;
  } | null;
  room?: {
    code?: string;
    name?: string | null;
  } | null;
}

type ClassRow = Class & {
  _onEdit?: (cls: Class) => void;
  _onDelete?: (cls: Class) => void;
};

const formatCurrency = (value?: number | null): string =>
  new Intl.NumberFormat("vi-VN").format(value ?? 0);

const columns: GridColDef<ClassRow>[] = [
  {
    field: "code",
    headerName: "Mã lớp",
    minWidth: 110,
    flex: 0.6,
  },
  {
    field: "name",
    headerName: "Tên lớp",
    minWidth: 180,
    flex: 1,
  },
  {
    field: "tuitionFee",
    headerName: "Học phí",
    minWidth: 130,
    align: "right",
    headerAlign: "right",
    valueFormatter: (value) => `${formatCurrency(Number(value))} đ`,
  },
  {
    field: "totalSessions",
    headerName: "Số buổi",
    minWidth: 100,
    align: "center",
    headerAlign: "center",
  },
  {
    field: "maxStudents",
    headerName: "Sĩ số",
    minWidth: 100,
    align: "center",
    headerAlign: "center",
  },
  {
    field: "status",
    headerName: "Trạng thái",
    minWidth: 140,
    align: "center",
    headerAlign: "center",
    renderCell: (params) => {
      const status = params.value as Class["status"];

      const label =
        status === "ACTIVE"
          ? "Hoạt động"
          : status === "DRAFT"
            ? "Nháp"
            : status === "COMPLETED"
              ? "Hoàn thành"
              : "Đã hủy";

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
              status === "ACTIVE"
                ? "success"
                : status === "DRAFT"
                  ? "default"
                  : status === "COMPLETED"
                    ? "info"
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

export function ClassList(): ReactElement {
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
  } = useList<Class>("/api/classes", { pageSize: 10, search });

  const [openDialog, setOpenDialog] = useState(false);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { showSuccess, showError, Snackbar } = useSnackbar();

  const handleCreate = useCallback(() => {
    setEditingClass(null);
    setOpenDialog(true);
  }, []);

  const handleEdit = useCallback((cls: Class) => {
    setEditingClass(cls);
    setOpenDialog(true);
  }, []);

  const handleDelete = useCallback((cls: Class) => {
    setDeleteId(cls.id);
  }, []);

  const handleCloseDialog = useCallback(() => {
    if (isSubmitting) return;

    setOpenDialog(false);
    setEditingClass(null);
  }, [isSubmitting]);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteId) return;

    try {
      setIsSubmitting(true);

      const response = await fetch(`/api/classes/${deleteId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Xóa lớp học thất bại");
      }

      showSuccess("Đã xóa lớp học thành công");
      setDeleteId(null);
      await refresh();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Có lỗi khi xóa lớp học");
    } finally {
      setIsSubmitting(false);
    }
  }, [deleteId, refresh, showSuccess, showError]);

  const handleSubmit = useCallback(
    async (formData: ClassFormData) => {
      try {
        setIsSubmitting(true);

        const isEdit = !!editingClass?.id;

        const response = await fetch(
          isEdit ? `/api/classes/${editingClass.id}` : "/api/classes",
          {
            method: isEdit ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData),
          },
        );

        if (!response.ok) {
          throw new Error(
            isEdit ? "Cập nhật lớp học thất bại" : "Thêm lớp học thất bại",
          );
        }

        showSuccess(
          isEdit
            ? "Đã cập nhật lớp học thành công"
            : "Đã thêm lớp học thành công",
        );

        setOpenDialog(false);
        setEditingClass(null);
        await refresh();
      } catch (err) {
        showError(
          err instanceof Error ? err.message : "Có lỗi khi lưu lớp học",
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [editingClass, refresh, showSuccess, showError],
  );

  const tableData = (data?.items || []).map((row) => ({
    ...row,
    tuitionFee: row.tuitionFee ?? 0,
    totalSessions: row.totalSessions ?? 0,
    maxStudents: row.maxStudents ?? 0,
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
              <ClassIcon />
            </Box>

            <Box>
              <Typography variant="h6" fontWeight={700}>
                Quản lý lớp học
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Danh sách lớp học, học phí, số buổi và trạng thái
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
            Thêm lớp học
          </Button>
        </Stack>

        <Box sx={{ mt: 2.5 }}>
          <TextField
            placeholder="Tìm theo mã lớp hoặc tên lớp..."
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
        title={editingClass ? "Sửa lớp học" : "Thêm lớp học"}
        onClose={handleCloseDialog}
        formId="class-form"
        isLoading={isSubmitting}
      >
        <ClassForm
          key={editingClass?.id ?? "create"}
          formId="class-form"
          onSubmit={handleSubmit}
          defaultValues={
            editingClass
              ? {
                  code: editingClass.code ?? "",
                  name: editingClass.name ?? "",
                  tuitionFee: editingClass.tuitionFee ?? 0,
                  totalSessions: editingClass.totalSessions ?? 0,
                  maxStudents: editingClass.maxStudents ?? 0,
                  teacherId: editingClass.teacherId ?? null,
                  roomId: editingClass.roomId ?? null,
                  startDate: editingClass.startDate ?? undefined,
                  endDate: editingClass.endDate ?? undefined,
                  status: editingClass.status ?? "DRAFT",
                  teacherCode: editingClass.teacher?.code ?? "",
                  teacherName: editingClass.teacher?.user?.fullName ?? "",
                  roomCode: editingClass.room?.code ?? "",
                  roomName: editingClass.room?.name ?? "",
                }
              : undefined
          }
        />
      </FormDialog>

      <ConfirmDialog
        open={!!deleteId}
        title="Xóa lớp học"
        message="Bạn có chắc chắn muốn xóa lớp học này không?"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteId(null)}
        isLoading={isSubmitting}
      />

      {Snackbar}
    </Stack>
  );
}
