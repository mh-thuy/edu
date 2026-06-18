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
import SchoolIcon from "@mui/icons-material/School";
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
  birthday?: string | null;
  email?: string | null;
  phone?: string | null;
  status: "ACTIVE" | "INACTIVE";
}

type StudentRow = Student & {
  _onEdit?: (student: Student) => void;
  _onDelete?: (student: Student) => void;
};

const columns: GridColDef<StudentRow>[] = [
  {
    field: "code",
    headerName: "Mã học sinh",
    minWidth: 120,
    flex: 0.6,
  },
  {
    field: "fullName",
    headerName: "Họ tên",
    minWidth: 180,
    flex: 1,
  },
  {
    field: "email",
    headerName: "Email",
    minWidth: 180,
    flex: 1,
  },
  {
    field: "phone",
    headerName: "Số điện thoại",
    minWidth: 140,
  },
  {
    field: "status",
    headerName: "Trạng thái",
    minWidth: 140,
    align: "center",
    headerAlign: "center",
    renderCell: (params) => {
      const status = params.value as Student["status"];

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
            label={status === "ACTIVE" ? "Hoạt động" : "Ngừng"}
            size="small"
            color={status === "ACTIVE" ? "success" : "error"}
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

export function StudentList(): ReactElement {
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
  } = useList<Student>("/api/students", { pageSize: 10, search });

  const [openDialog, setOpenDialog] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { showSuccess, showError, Snackbar } = useSnackbar();

  const handleCreate = useCallback(() => {
    setEditingStudent(null);
    setOpenDialog(true);
  }, []);

  const handleEdit = useCallback((student: Student) => {
    setEditingStudent(student);
    setOpenDialog(true);
  }, []);

  const handleDelete = useCallback((student: Student) => {
    setDeleteId(student.id);
  }, []);

  const handleCloseDialog = useCallback(() => {
    if (isSubmitting) return;

    setOpenDialog(false);
    setEditingStudent(null);
  }, [isSubmitting]);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteId) return;

    try {
      setIsSubmitting(true);

      const response = await fetch(`/api/students/${deleteId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Xóa học sinh thất bại");
      }

      showSuccess("Đã xóa học sinh thành công");
      setDeleteId(null);
      await refresh();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Có lỗi khi xóa học sinh");
    } finally {
      setIsSubmitting(false);
    }
  }, [deleteId, refresh, showSuccess, showError]);

  const handleSubmit = useCallback(
    async (formData: StudentFormData) => {
      try {
        setIsSubmitting(true);

        const isEdit = !!editingStudent?.id;

        const response = await fetch(
          isEdit ? `/api/students/${editingStudent.id}` : "/api/students",
          {
            method: isEdit ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData),
          },
        );

        if (!response.ok) {
          throw new Error(
            isEdit ? "Cập nhật học sinh thất bại" : "Thêm học sinh thất bại",
          );
        }

        showSuccess(
          isEdit
            ? "Đã cập nhật học sinh thành công"
            : "Đã thêm học sinh thành công",
        );

        setOpenDialog(false);
        setEditingStudent(null);
        await refresh();
      } catch (err) {
        showError(
          err instanceof Error ? err.message : "Có lỗi khi lưu học sinh",
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [editingStudent, refresh, showSuccess, showError],
  );

  const tableData = (data?.items || []).map((row) => ({
    ...row,
    email: row.email ?? "",
    phone: row.phone ?? "",
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
              <SchoolIcon />
            </Box>

            <Box>
              <Typography variant="h6" fontWeight={700}>
                Quản lý học sinh
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Danh sách học sinh, thông tin liên hệ và trạng thái
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
            Thêm học sinh
          </Button>
        </Stack>

        <Box sx={{ mt: 2.5 }}>
          <TextField
            placeholder="Tìm theo mã học sinh, họ tên, email hoặc số điện thoại..."
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
              maxWidth: 520,
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
        title={editingStudent ? "Sửa học sinh" : "Thêm học sinh"}
        onClose={handleCloseDialog}
        formId="student-form"
        isLoading={isSubmitting}
      >
        <StudentForm
          key={editingStudent?.id ?? "create"}
          formId="student-form"
          onSubmit={handleSubmit}
          defaultValues={
            editingStudent
              ? {
                  code: editingStudent.code ?? "",
                  fullName: editingStudent.fullName ?? "",
                  birthday: editingStudent.birthday ?? undefined,
                  email: editingStudent.email ?? "",
                  phone: editingStudent.phone ?? "",
                  status: editingStudent.status ?? "ACTIVE",
                }
              : undefined
          }
        />
      </FormDialog>

      <ConfirmDialog
        open={!!deleteId}
        title="Xóa học sinh"
        message="Bạn có chắc chắn muốn xóa học sinh này không?"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteId(null)}
        isLoading={isSubmitting}
      />

      {Snackbar}
    </Stack>
  );
}
