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
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";
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
  status: TeacherFormData["status"];
}

const columns: GridColDef[] = [
  {
    field: "code",
    headerName: "Mã giáo viên",
    minWidth: 130,
    flex: 0.7,
  },
  {
    field: "phone",
    headerName: "Số điện thoại",
    minWidth: 140,
    flex: 0.8,
  },
  {
    field: "email",
    headerName: "Email",
    minWidth: 180,
    flex: 1,
  },
  {
    field: "specialty",
    headerName: "Chuyên môn",
    minWidth: 150,
    flex: 0.8,
  },
  {
    field: "status",
    headerName: "Trạng thái",
    minWidth: 130,
    align: "center",
    headerAlign: "center",
    renderCell: (params) => {
      const status = params.value;
      const active = status === "ACTIVE";

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
            label={active ? "Đang hoạt động" : "Ngừng hoạt động"}
            size="small"
            color={active ? "success" : "error"}
            variant="outlined"
            sx={{
              minWidth: 120,
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
    minWidth: 160,
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

export function TeacherList(): ReactElement {
  const [search, setSearch] = useState("");

  const {
    data,
    isLoading,
    error,
    page,
    limit,
    setPageNumber,
    setPageSize,
    refresh,
  } = useList<Teacher>("/api/teachers", { limit: 10, search });

  const [openDialog, setOpenDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { showSuccess, showError, Snackbar } = useSnackbar();

  const handleCreate = useCallback(() => {
    setEditingId(null);
    setEditingTeacher(null);
    setOpenDialog(true);
  }, []);

  const handleEdit = useCallback((teacher: Teacher) => {
    setEditingId(teacher.id);
    setEditingTeacher(teacher);
    setOpenDialog(true);
  }, []);

  const handleDelete = useCallback((teacher: Teacher) => {
    setDeleteId(teacher.id);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteId) return;

    try {
      setIsSubmitting(true);

      const response = await fetch(`/api/teachers/${deleteId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Không thể xóa giáo viên");
      }

      showSuccess("Xóa giáo viên thành công");
      setDeleteId(null);
      refresh();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Lỗi khi xóa giáo viên");
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

          if (!response.ok) {
            throw new Error("Không thể cập nhật giáo viên");
          }

          showSuccess("Cập nhật giáo viên thành công");
        } else {
          const response = await fetch("/api/teachers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData),
          });

          if (!response.ok) {
            throw new Error("Không thể thêm giáo viên");
          }

          showSuccess("Thêm giáo viên thành công");
        }

        setOpenDialog(false);
        setEditingId(null);
        setEditingTeacher(null);
        refresh();
      } catch (err) {
        showError(err instanceof Error ? err.message : "Lỗi khi lưu giáo viên");
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
              <SchoolOutlinedIcon />
            </Box>

            <Box>
              <Typography variant="h6" fontWeight={700}>
                Quản lý giáo viên
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Danh sách giáo viên, chuyên môn và trạng thái hoạt động
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
              textTransform: "none",
            }}
          >
            Thêm giáo viên
          </Button>
        </Stack>

        <Box sx={{ mt: 2.5 }}>
          <TextField
            placeholder="Tìm theo mã, số điện thoại hoặc email..."
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
              maxWidth: 460,
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
          pageSize={limit}
          isLoading={isLoading}
          onPageChange={setPageNumber}
          onPageSizeChange={setPageSize}
          error={error}
        />
      </Paper>

      <FormDialog
        open={openDialog}
        title={editingId ? "Sửa giáo viên" : "Thêm giáo viên"}
        onClose={() => {
          setOpenDialog(false);
          setEditingId(null);
          setEditingTeacher(null);
        }}
        formId="teacher-form"
        isLoading={isSubmitting}
      >
        <TeacherForm
          formId="teacher-form"
          key={editingId ?? "create"}
          defaultValues={editingTeacher ?? undefined}
          onSubmit={handleSubmit}
        />
      </FormDialog>

      <ConfirmDialog
        open={!!deleteId}
        title="Xóa giáo viên"
        message="Bạn có chắc chắn muốn xóa giáo viên này không?"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteId(null)}
        isLoading={isSubmitting}
      />

      {Snackbar}
    </Stack>
  );
}
