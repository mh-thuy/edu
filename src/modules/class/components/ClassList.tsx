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
  MenuItem,
  Select,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import ClassIcon from "@mui/icons-material/Class";
import { GridColDef } from "@mui/x-data-grid";
import { useState, useCallback, useEffect } from "react";
import { BaseTable } from "@/components/shared/tables/BaseTable";
import { FormDialog } from "@/components/shared/dialogs/FormDialog";
import { ConfirmDialog } from "@/components/shared/dialogs/ConfirmDialog";
import { useList } from "@/hooks/useList";
import { useSnackbar } from "@/hooks/useSnackbar";
import { ClassForm } from "./ClassForm";
import type { ReactElement } from "react";
import type { z } from "zod";
import { classCreateSchema } from "@/modules/class/schemas/class.schema";
import Link from "next/link";
import { extractApiErrorMessage } from "@/lib/api-client";

type ClassFormData = z.infer<typeof classCreateSchema>;

export interface Class {
  id: string;
  code: string;
  name: string;
  startDate?: string | null;
  endDate?: string | null;
  status: "ACTIVE" | "DRAFT" | "COMPLETED" | "CANCELLED";
  _count?: { students: number; schedules: number };
}

type ClassRow = Class & {
  _onEdit?: (cls: Class) => void;
  _onDelete?: (cls: Class) => void;
};

const getColumns = (): GridColDef<ClassRow>[] => [
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
    field: "_count.students",
    headerName: "Học viên",
    minWidth: 95,
    align: "center",
    headerAlign: "center",
    valueGetter: (_value, row) => row._count?.students ?? 0,
  },
  {
    field: "_count.schedules",
    headerName: "Lịch học",
    minWidth: 90,
    align: "center",
    headerAlign: "center",
    valueGetter: (_value, row) => row._count?.schedules ?? 0,
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
    minWidth: 220,
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
          component={Link}
          href={`/admin/classes/${params.row.id}`}
          variant="outlined"
          sx={{
            minWidth: 64,
          }}
        >
          Chi tiết
        </Button>

        <Button
          size="small"
          variant="outlined"
          onClick={() => params.row._onEdit?.(params.row)}
          sx={{
            minWidth: 64,
          }}
        >
          Sửa
        </Button>

        <Button
          size="small"
          variant="outlined"
          color="error"
          onClick={() => params.row._onDelete?.(params.row)}
          sx={{
            minWidth: 64,
          }}
        >
          Đóng lớp
        </Button>
      </Stack>
    ),
  },
];

export function ClassList(): ReactElement {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  const {
    data,
    isLoading,
    error,
    page,
    pageSize,
    setPageNumber,
    setPageSize,
    refresh,
  } = useList<Class>("/api/classes", {
    pageSize: 10,
    search: debouncedSearch,
    status: status || undefined,
  });

  const [openDialog, setOpenDialog] = useState(false);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Class | null>(null);
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
    setDeleteTarget(cls);
  }, []);

  const handleCloseDialog = useCallback(() => {
    if (isSubmitting) return;

    setOpenDialog(false);
    setEditingClass(null);
  }, [isSubmitting]);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;

    try {
      setIsSubmitting(true);

      const response = await fetch(`/api/classes/${deleteTarget.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(await extractApiErrorMessage(response, "Đóng lớp học thất bại"));
      }

      showSuccess("Đã đóng lớp và giữ lại lịch sử");
      setDeleteTarget(null);
      await refresh();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Có lỗi khi đóng lớp học");
    } finally {
      setIsSubmitting(false);
    }
  }, [deleteTarget, refresh, showSuccess, showError]);

  const handleSubmit = useCallback(
    async (formData: ClassFormData) => {
      try {
        setIsSubmitting(true);

        const isEdit = !!editingClass?.id;

        const response = await fetch(
          isEdit ? `/api/classes/${editingClass.id}` : "/api/classes",
          {
            method: isEdit ? "PATCH" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData),
          },
        );

        if (!response.ok) {
          throw new Error(await extractApiErrorMessage(response, isEdit ? "Cập nhật lớp học thất bại" : "Thêm lớp học thất bại"));
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
    _onEdit: handleEdit,
    _onDelete: handleDelete,
  }));

  return (
    <Stack spacing={{ xs: 2, md: 3 }}>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, md: 3 },
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
                Tập trung thông tin lớp, giáo viên, học sinh và lịch học
              </Typography>
            </Box>
          </Box>

          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreate}
            sx={{
              whiteSpace: "nowrap",
            }}
          >
            Thêm lớp học
          </Button>
        </Stack>

      </Paper>

      <Paper sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1.5}
        >
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
              flex: 1,
              "& .MuiOutlinedInput-root": {
                borderRadius: 2,
                bgcolor: "background.default",
              },
            }}
          />
          <Select
            size="small"
            value={status}
            displayEmpty
            onChange={(event) => setStatus(event.target.value)}
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="">Tất cả trạng thái</MenuItem>
            <MenuItem value="ACTIVE">Hoạt động</MenuItem>
            <MenuItem value="DRAFT">Nháp</MenuItem>
            <MenuItem value="COMPLETED">Hoàn thành</MenuItem>
            <MenuItem value="CANCELLED">Đã hủy</MenuItem>
          </Select>
          <Button variant="outlined" onClick={() => { setSearch(""); setStatus(""); }} disabled={!search && !status}>Xóa bộ lọc</Button>
        </Stack>
      </Paper>

      <BaseTable
        columns={getColumns()}
        rows={tableData}
        totalRows={data?.total || 0}
        page={page}
        pageSize={pageSize}
        isLoading={isLoading}
        onPageChange={setPageNumber}
        onPageSizeChange={setPageSize}
        error={error}
        onRetry={refresh}
      />

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
                  startDate: editingClass.startDate ?? undefined,
                  endDate: editingClass.endDate ?? undefined,
                  status: editingClass.status ?? "DRAFT",
                }
              : undefined
          }
        />
      </FormDialog>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Đóng lớp học"
        message={`Lớp ${deleteTarget?.code ?? "này"} — ${deleteTarget?.name ?? ""} sẽ được giữ lại và chuyển sang trạng thái đã hủy. Chỉ thực hiện được khi lớp chưa có dữ liệu liên quan. Tiếp tục?`}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
        isLoading={isSubmitting}
        confirmLabel="Đóng lớp"
      />

      {Snackbar}
    </Stack>
  );
}
