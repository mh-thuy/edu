"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { Role } from "@prisma/client";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  DataGrid,
  GridActionsCellItem,
  type GridColDef,
  type GridRowId,
  type GridRowSelectionModel,
} from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import SearchIcon from "@mui/icons-material/Search";

import { BaseTable } from "@/components/shared/tables/BaseTable";
import { EmptyState } from "@/components/shared/tables/EmptyState";
import {
  MasterSelectField,
  type MasterSelectValue,
} from "@/components/shared/forms/MasterSelectField";
import {
  ClassSelectDialog,
  type ClassItem,
} from "@/components/shared/dialogs/ClassSelectDialog";
import { useDisclosure } from "@/hooks/useDisclosure";
import { useList } from "@/hooks/useList";
import { useSnackbar } from "@/hooks/useSnackbar";

import { StudentFeeForm } from "./StudentFeeForm";
import { DatePicker } from "@mui/x-date-pickers";
import dayjs, { Dayjs } from "dayjs";
import { extractApiErrorMessage, unwrapApiResponse } from "@/lib/api-client";

type StudentFeeStatus = "unpaid" | "partial" | "paid";

interface StudentFee {
  id: string;
  studentId: string;
  classId: string;
  month: string;
  amount: number;
  dueDate: string;
  status: StudentFeeStatus;
  discount?: number;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
  student?: {
    id: string;
    code: string;
    fullName: string;
  } | null;
  class?: {
    id: string;
    code: string;
    name: string;
  } | null;
}

interface BulkStudentRow {
  id: string;
  studentId: string;
  studentCode: string;
  studentName: string;
}

interface BulkClassStudentApiItem {
  classId: string;
  studentId: string;
  student: {
    id: string;
    code: string;
    fullName: string;
  };
}

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat("vi-VN").format(value);

const formatDate = (value: string): string =>
  new Date(value).toLocaleDateString("vi-VN");

const getStatusLabel = (status: StudentFeeStatus): string => {
  const labels: Record<StudentFeeStatus, string> = {
    paid: "Đã thanh toán",
    partial: "Thanh toán một phần",
    unpaid: "Chưa thanh toán",
  };
  return labels[status];
};

const getStatusColor = (
  status: StudentFeeStatus,
): "success" | "warning" | "error" => {
  switch (status) {
    case "paid":
      return "success";
    case "partial":
      return "warning";
    case "unpaid":
      return "error";
  }
};

const emptySelectionModel = (): GridRowSelectionModel => ({
  type: "include",
  ids: new Set<GridRowId>(),
});

type StudentFeeListProps = {
  role: Role;
};

export function StudentFeeList({ role }: StudentFeeListProps) {
  const canDelete = role === "ADMIN";
  const snackbar = useSnackbar();
  const classDialog = useDisclosure();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [monthFilter, setMonthFilter] = useState<string>("");
  const [editingFee, setEditingFee] = useState<StudentFee | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [selectedBulkClass, setSelectedBulkClass] =
    useState<MasterSelectValue | null>(null);
  const [bulkData, setBulkData] = useState({
    classId: "",
    month: new Date().toISOString().slice(0, 7) || "",
    amount: 0,
    dueDate: new Date().toISOString().slice(0, 10) || "",
    discount: 0,
    note: "",
  });
  const [bulkStudents, setBulkStudents] = useState<BulkStudentRow[]>([]);
  const [bulkStudentsLoading, setBulkStudentsLoading] = useState(false);
  const [bulkStudentsError, setBulkStudentsError] = useState<string | null>(
    null,
  );
  const [selectedBulkRows, setSelectedBulkRows] =
    useState<GridRowSelectionModel>(emptySelectionModel);

  const {
    data: fees,
    isLoading,
    error,
    refresh,
    page,
    pageSize,
    setPageNumber,
    setPageSize,
  } = useList<StudentFee>("/api/student-fees", {
    pageSize: 10,
    search: search || undefined,
    status: statusFilter || undefined,
    month: monthFilter || undefined,
  });

  const loadBulkStudents = useCallback(async (classId: string) => {
    try {
      setBulkStudentsLoading(true);
      setBulkStudentsError(null);
      const response = await fetch(`/api/classes/${classId}/students`);
      if (!response.ok) {
        throw new Error(
          await extractApiErrorMessage(
            response,
            "Không tải được danh sách học viên",
          ),
        );
      }

      const result = await unwrapApiResponse<BulkClassStudentApiItem[]>(response);
      setBulkStudents(
        result.map((item) => ({
          id: item.student.id,
          studentId: item.student.id,
          studentCode: item.student.code,
          studentName: item.student.fullName,
        })),
      );
      setSelectedBulkRows(emptySelectionModel());
    } catch (loadError) {
      setBulkStudents([]);
      setSelectedBulkRows(emptySelectionModel());
      setBulkStudentsError(
        loadError instanceof Error
          ? loadError.message
          : "Không tải được danh sách học viên",
      );
    } finally {
      setBulkStudentsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!bulkData.classId) {
      setBulkStudents([]);
      setSelectedBulkRows(emptySelectionModel());
      setBulkStudentsError(null);
      return;
    }

    void loadBulkStudents(bulkData.classId);
  }, [bulkData.classId, loadBulkStudents]);

  const handleCreate = useCallback(() => {
    setEditingFee(null);
    setShowForm(true);
  }, []);

  const handleEdit = useCallback((row: StudentFee) => {
    setEditingFee(row);
    setShowForm(true);
  }, []);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm("Bạn có chắc chắn muốn xóa?")) return;

      try {
        const response = await fetch(`/api/student-fees/${id}`, {
          method: "DELETE",
        });
        if (!response.ok) {
          throw new Error(await extractApiErrorMessage(response, "Failed to delete"));
        }
        snackbar.showSuccess("Xóa học phí thành công");
        await refresh();
      } catch (deleteError) {
        snackbar.showError(
          deleteError instanceof Error ? deleteError.message : "Xóa thất bại",
        );
      }
    },
    [refresh, snackbar],
  );

  const handleBulkCreate = useCallback(async () => {
    if (
      !bulkData.classId ||
      !bulkData.month ||
      bulkData.amount <= 0 ||
      !bulkData.dueDate ||
      selectedBulkRows.ids.size === 0
    ) {
      snackbar.showError(
        "Vui lòng điền đủ thông tin và chọn ít nhất một học viên",
      );
      return;
    }

    try {
      setBulkSubmitting(true);
      const response = await fetch("/api/student-fees/bulk-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...bulkData,
          note: bulkData.note || undefined,
          studentIds: Array.from(selectedBulkRows.ids, (value) =>
            String(value),
          ),
        }),
      });
      if (!response.ok) {
        throw new Error(
          await extractApiErrorMessage(response, "Tạo hóa đơn hàng loạt thất bại"),
        );
      }
      const data = await unwrapApiResponse<{ created: number; skipped: number }>(
        response,
      );

      snackbar.showSuccess(
        `Tạo hóa đơn hàng loạt thành công: ${data.created} mới, ${data.skipped} bỏ qua`,
      );
      setShowBulkDialog(false);
      setBulkData({
        classId: "",
        month: new Date().toISOString().slice(0, 7) || "",
        amount: 0,
        dueDate: new Date().toISOString().slice(0, 10) || "",
        discount: 0,
        note: "",
      });
      setSelectedBulkClass(null);
      setBulkStudents([]);
      setSelectedBulkRows(emptySelectionModel());
      await refresh();
    } catch (bulkError) {
      snackbar.showError(
        bulkError instanceof Error
          ? bulkError.message
          : "Tạo hóa đơn hàng loạt thất bại",
      );
    } finally {
      setBulkSubmitting(false);
    }
  }, [bulkData, refresh, selectedBulkRows, snackbar]);

  const columns: GridColDef<StudentFee>[] = useMemo(
    () => [
      { field: "month", headerName: "Tháng", width: 110 },
      {
        field: "student",
        headerName: "Học viên",
        minWidth: 220,
        flex: 1,
        renderCell: (params) =>
          params.row.student
            ? `${params.row.student.code} - ${params.row.student.fullName}`
            : params.row.studentId,
      },
      {
        field: "class",
        headerName: "Lớp",
        minWidth: 220,
        flex: 1,
        renderCell: (params) =>
          params.row.class
            ? `${params.row.class.code} - ${params.row.class.name}`
            : params.row.classId,
      },
      {
        field: "amount",
        headerName: "Số tiền",
        width: 150,
        align: "right",
        headerAlign: "right",
        renderCell: (params) => `${formatCurrency(params.row.amount)} VND`,
      },
      {
        field: "dueDate",
        headerName: "Hạn thanh toán",
        width: 130,
        renderCell: (params) => formatDate(params.row.dueDate),
      },
      {
        field: "status",
        headerName: "Trạng thái",
        flex: 1,
        align: "center",
        headerAlign: "center",
        renderCell: (params) => (
          <Chip
            label={getStatusLabel(params.row.status)}
            size="small"
            color={getStatusColor(params.row.status)}
            variant="outlined"
          />
        ),
      },
      {
        field: "actions",
        headerName: "Thao tác",
        width: 140,
        sortable: false,
        filterable: false,
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
            <GridActionsCellItem
              icon={<EditIcon />}
              label="Sửa"
              onClick={() => handleEdit(params.row)}
            />
            <GridActionsCellItem
              icon={<DeleteIcon />}
              label="Xóa"
              disabled={!canDelete}
              onClick={() => handleDelete(params.row.id)}
            />
          </Stack>
        ),
      },
    ],
    [canDelete, handleDelete, handleEdit],
  );

  const bulkStudentColumns: GridColDef<BulkStudentRow>[] = useMemo(
    () => [
      {
        field: "studentCode",
        headerName: "Mã học viên",
        width: 140,
      },
      {
        field: "studentName",
        headerName: "Học viên",
        flex: 1,
        minWidth: 220,
      },
    ],
    [],
  );

  const hasRows = (fees?.items.length || 0) > 0;

  return (
    <>
      <Stack spacing={2.5}>
        <Paper
          elevation={0}
          sx={{
            p: 3,
            borderRadius: 3,
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <Stack spacing={3}>
            {/* Header */}
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
            >
              <Box>
                <Typography variant="h6" fontWeight={700}>
                  Quản lý học phí
                </Typography>

                <Typography variant="body2" color="text.secondary">
                  Quản lý hóa đơn và thanh toán học viên
                </Typography>
              </Box>

              <Stack direction="row" spacing={1}>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={handleCreate}
                >
                  Tạo hóa đơn
                </Button>

                <Button
                  variant="text"
                  startIcon={<ReceiptLongIcon />}
                  onClick={() => setShowBulkDialog(true)}
                >
                  Hàng loạt
                </Button>
              </Stack>
            </Stack>

            <Divider />

            {/* Filters */}
            <Stack
              direction={{ xs: "column", lg: "row" }}
              spacing={2}
              alignItems="center"
            >
              <TextField
                label="Tìm kiếm"
                placeholder="Mã/tên học viên, mã/tên lớp, tháng"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPageNumber(1);
                }}
                fullWidth
                InputProps={{
                  startAdornment: <SearchIcon fontSize="small" />,
                }}
              />
              <TextField
                select
                label="Trạng thái"
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  setPageNumber(1);
                }}
                sx={{ width: 500 }}
              >
                <MenuItem value="">Tất cả</MenuItem>
                <MenuItem value="unpaid">Chưa thanh toán</MenuItem>
                <MenuItem value="partial">Thanh toán một phần</MenuItem>
                <MenuItem value="paid">Đã thanh toán</MenuItem>
              </TextField>

              <DatePicker
                label="Kỳ học phí"
                views={["year", "month"]}
                format="YYYY-MM"
                value={monthFilter ? dayjs(monthFilter) : null}
                onChange={(value: Dayjs | null) => {
                  setMonthFilter(value ? value.format("YYYY-MM") : "");
                  setPageNumber(1);
                }}
              />
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
          {error ? (
            <Box p={3}>
              <Alert severity="error">{error}</Alert>
            </Box>
          ) : !isLoading && !hasRows ? (
            <EmptyState
              title="Chưa có học phí"
              description="Không tìm thấy dữ liệu phù hợp với bộ lọc hiện tại."
            />
          ) : (
            <BaseTable
              rows={fees?.items || []}
              columns={columns}
              isLoading={isLoading}
              totalRows={fees?.total || 0}
              page={page}
              pageSize={pageSize}
              onPageChange={setPageNumber}
              onPageSizeChange={setPageSize}
            />
          )}
        </Paper>
      </Stack>

      {showForm && (
        <StudentFeeForm
          initialData={editingFee || undefined}
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false);
            void refresh();
          }}
        />
      )}

      <Dialog
        open={showBulkDialog}
        onClose={() => {
          if (bulkSubmitting) return;
          setShowBulkDialog(false);
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Tạo hóa đơn hàng loạt</DialogTitle>
        <DialogContent sx={{ mt: 1 }}>
          <Stack spacing={2}>
            <MasterSelectField
              label="Lớp"
              required
              value={selectedBulkClass}
              onOpen={classDialog.onOpen}
              error={!bulkData.classId ? "Vui lòng chọn lớp" : undefined}
              codeLabel="Mã lớp"
              nameLabel="Tên lớp"
            />

            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label="Tháng"
                type="month"
                value={bulkData.month}
                onChange={(event) =>
                  setBulkData((current) => ({
                    ...current,
                    month: event.target.value,
                  }))
                }
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="Số tiền"
                type="number"
                value={bulkData.amount}
                onChange={(event) =>
                  setBulkData((current) => ({
                    ...current,
                    amount: Number(event.target.value),
                  }))
                }
                fullWidth
              />
            </Stack>

            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label="Hạn thanh toán"
                type="date"
                value={bulkData.dueDate}
                onChange={(event) =>
                  setBulkData((current) => ({
                    ...current,
                    dueDate: event.target.value,
                  }))
                }
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="Giảm giá"
                type="number"
                value={bulkData.discount}
                onChange={(event) =>
                  setBulkData((current) => ({
                    ...current,
                    discount: Number(event.target.value),
                  }))
                }
                fullWidth
              />
            </Stack>

            <TextField
              label="Ghi chú"
              value={bulkData.note}
              onChange={(event) =>
                setBulkData((current) => ({
                  ...current,
                  note: event.target.value,
                }))
              }
              multiline
              rows={2}
              fullWidth
            />

            <Typography variant="subtitle2" fontWeight={700}>
              Chọn học viên tạo hóa đơn
            </Typography>

            {bulkStudentsError ? (
              <Alert severity="error">{bulkStudentsError}</Alert>
            ) : bulkStudentsLoading ? (
              <Box py={6} display="flex" justifyContent="center">
                <CircularProgress />
              </Box>
            ) : bulkData.classId && bulkStudents.length === 0 ? (
              <Alert severity="info">
                Lớp hiện không có học viên nào để tạo học phí.
              </Alert>
            ) : (
              <Box sx={{ height: 360 }}>
                <DataGrid
                  rows={bulkStudents}
                  columns={bulkStudentColumns}
                  checkboxSelection
                  disableRowSelectionOnClick
                  rowSelectionModel={selectedBulkRows}
                  onRowSelectionModelChange={(model) =>
                    setSelectedBulkRows(model)
                  }
                  pageSizeOptions={[5, 10, 20]}
                  initialState={{
                    pagination: {
                      paginationModel: {
                        page: 0,
                        pageSize: 5,
                      },
                    },
                  }}
                />
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setShowBulkDialog(false)}
            disabled={bulkSubmitting}
          >
            Hủy
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleBulkCreate()}
            disabled={
              bulkSubmitting ||
              selectedBulkRows.ids.size === 0 ||
              !bulkData.classId ||
              bulkStudentsLoading
            }
            startIcon={
              bulkSubmitting ? <CircularProgress size={18} /> : undefined
            }
          >
            {bulkSubmitting ? "Đang tạo..." : "Tạo hóa đơn hàng loạt"}
          </Button>
        </DialogActions>
      </Dialog>

      <ClassSelectDialog
        open={classDialog.open}
        onClose={classDialog.onClose}
        onSelect={(item: ClassItem) => {
          setSelectedBulkClass({
            id: item.id,
            code: item.code,
            name: item.name,
          });
          setBulkData((current) => ({ ...current, classId: item.id }));
          classDialog.onClose();
        }}
      />

      {snackbar.Snackbar}
    </>
  );
}
