"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { RoleCode } from "@/constants/roles";
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
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  DataGrid,
  type GridColDef,
  type GridRowId,
  type GridRowSelectionModel,
} from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import QrCode2Icon from "@mui/icons-material/QrCode2";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import SearchIcon from "@mui/icons-material/Search";
import SendIcon from "@mui/icons-material/Send";
import VisibilityIcon from "@mui/icons-material/Visibility";

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

type StudentFeeStatus = "UNPAID" | "PARTIAL" | "PAID";

interface StudentFee {
  id: string;
  studentId: string;
  classId: string;
  month?: string;
  billingYear: string;
  billingMonth: string;
  amount: number;
  finalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
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
  activeQr?: {
    id: string;
    amount: number;
    status: "ACTIVE" | "INACTIVE" | "EXPIRED" | "CANCELLED";
    qrImageUrl?: string | null;
  } | null;
  latestNotice?: {
    id: string;
    status: "DRAFT" | "GENERATED" | "PRINTED" | "SENT" | "CANCELLED";
    pdfUrl?: string | null;
  } | null;
  flowStatus?: {
    tuitionFee: "GENERATED";
    qr: "PENDING" | "GENERATED" | "FAILED";
    temporaryInvoice: "PENDING" | "GENERATED" | "SENT" | "FAILED";
    paymentNotice: "PENDING" | "GENERATED" | "SENT" | "FAILED";
  };
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
    PAID: "Đã thanh toán",
    PARTIAL: "Thanh toán một phần",
    UNPAID: "Chưa thanh toán",
  };
  return labels[status];
};

const getStatusColor = (
  status: StudentFeeStatus,
): "success" | "warning" | "error" => {
  switch (status) {
    case "PAID":
      return "success";
    case "PARTIAL":
      return "warning";
    case "UNPAID":
      return "error";
  }
};

type FlowStatus = "PENDING" | "GENERATED" | "SENT" | "FAILED";

const getFlowStatusLabel = (status: FlowStatus): string => {
  switch (status) {
    case "GENERATED":
      return "Generated";
    case "SENT":
      return "Sent";
    case "FAILED":
      return "Failed";
    default:
      return "Pending";
  }
};

const getFlowStatusColor = (
  status: FlowStatus,
): "default" | "success" | "warning" | "error" => {
  switch (status) {
    case "GENERATED":
      return "success";
    case "SENT":
      return "warning";
    case "FAILED":
      return "error";
    default:
      return "default";
  }
};

const emptySelectionModel = (): GridRowSelectionModel => ({
  type: "include",
  ids: new Set<GridRowId>(),
});

type StudentFeeListProps = {
  role: RoleCode;
};

export function StudentFeeList({ role }: StudentFeeListProps) {
  const canDelete = role === "ADMIN";
  const snackbar = useSnackbar();
  const classDialog = useDisclosure();

  const [searchInput, setSearchInput] = useState("");
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

  // Flow menu anchor: tracks which row's menu is open + the anchor element.
  const [flowMenuAnchor, setFlowMenuAnchor] = useState<HTMLElement | null>(
    null,
  );
  const [flowMenuRow, setFlowMenuRow] = useState<StudentFee | null>(null);

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

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
    }, 300);

    return () => {
      window.clearTimeout(timer);
    };
  }, [searchInput]);

  useEffect(() => {
    setPageNumber(1);
  }, [search, setPageNumber]);

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

      const result =
        await unwrapApiResponse<BulkClassStudentApiItem[]>(response);
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
    setEditingFee({
      ...row,
      month: `${row.billingYear}-${String(row.billingMonth).padStart(2, "0")}`,
    });
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
          throw new Error(
            await extractApiErrorMessage(response, "Failed to delete"),
          );
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
          await extractApiErrorMessage(
            response,
            "Tạo hóa đơn hàng loạt thất bại",
          ),
        );
      }
      const data = await unwrapApiResponse<{
        created: number;
        skipped: number;
      }>(response);

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

  const handleFlowAction = useCallback(
    async (
      id: string,
      action:
        | "generate-qr"
        | "generate-notice"
        | "send-notice"
        | "generate-all",
      successMessage: string,
    ) => {
      try {
        const response = await fetch(`/api/student-fees/${id}/${action}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body:
            action === "send-notice"
              ? JSON.stringify({ sendMethod: "MANUAL" })
              : "{}",
        });

        if (!response.ok) {
          throw new Error(
            await extractApiErrorMessage(response, "Thao tác thất bại"),
          );
        }

        snackbar.showSuccess(successMessage);
        await refresh();
      } catch (actionError) {
        snackbar.showError(
          actionError instanceof Error
            ? actionError.message
            : "Thao tác thất bại",
        );
      }
    },
    [refresh, snackbar],
  );

  const handleOpenQr = useCallback(
    (url?: string | null) => {
      if (!url) {
        snackbar.showError("Chưa có ảnh QR để xem");
        return;
      }

      window.open(url, "_blank", "noopener,noreferrer");
    },
    [snackbar],
  );

  const handleExportPdf = useCallback(
    async (id: string) => {
      try {
        const response = await fetch(
          `/api/student-fees/${id}/export-notice-pdf`,
          { method: "POST" },
        );

        if (!response.ok) {
          throw new Error(
            await extractApiErrorMessage(response, "Xuất PDF thất bại"),
          );
        }

        const result = await unwrapApiResponse<{ pdfUrl: string }>(response);
        window.open(result.pdfUrl, "_blank", "noopener,noreferrer");
        snackbar.showSuccess("Đã xuất PDF bill tạm");
        await refresh();
      } catch (exportError) {
        snackbar.showError(
          exportError instanceof Error
            ? exportError.message
            : "Xuất PDF thất bại",
        );
      }
    },
    [refresh, snackbar],
  );

  // ---- Flow menu open/close ----
  const handleOpenFlowMenu = useCallback(
    (event: React.MouseEvent<HTMLElement>, row: StudentFee) => {
      setFlowMenuAnchor(event.currentTarget);
      setFlowMenuRow(row);
    },
    [],
  );

  const handleCloseFlowMenu = useCallback(() => {
    setFlowMenuAnchor(null);
    setFlowMenuRow(null);
  }, []);

  // Wraps a flow action so the menu closes before the request fires —
  // avoids the menu staying open while the row data refreshes underneath it.
  const runFlowMenuAction = useCallback(
    (action: () => void | Promise<void>) => {
      handleCloseFlowMenu();
      void action();
    },
    [handleCloseFlowMenu],
  );

  const columns: GridColDef<StudentFee>[] = useMemo(
    () => [
      {
        field: "billingMonth",
        headerName: "Tháng",
        width: 110,
        renderCell: (params) =>
          `${params.row.billingYear}-${params.row.billingMonth}`,
      },
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
        headerName: "Học phí gốc",
        width: 150,
        align: "right",
        headerAlign: "right",
        renderCell: (params) => `${formatCurrency(params.row.amount)} VND`,
      },
      {
        field: "finalAmount",
        headerName: "Cần thu",
        width: 150,
        align: "right",
        headerAlign: "right",
        renderCell: (params) => `${formatCurrency(params.row.finalAmount)} VND`,
      },
      {
        field: "outstandingAmount",
        headerName: "Còn nợ",
        width: 150,
        align: "right",
        headerAlign: "right",
        renderCell: (params) =>
          `${formatCurrency(params.row.outstandingAmount)} VND`,
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
        field: "qrStatus",
        headerName: "QR",
        width: 120,
        renderCell: (params) => (
          <Chip
            label={getFlowStatusLabel(params.row.flowStatus?.qr ?? "PENDING")}
            size="small"
            color={getFlowStatusColor(params.row.flowStatus?.qr ?? "PENDING")}
            variant="outlined"
          />
        ),
      },
      {
        field: "temporaryInvoiceStatus",
        headerName: "Bill tạm",
        width: 130,
        renderCell: (params) => (
          <Chip
            label={getFlowStatusLabel(
              params.row.flowStatus?.temporaryInvoice ?? "PENDING",
            )}
            size="small"
            color={getFlowStatusColor(
              params.row.flowStatus?.temporaryInvoice ?? "PENDING",
            )}
            variant="outlined"
          />
        ),
      },
      {
        field: "paymentNoticeStatus",
        headerName: "Notice",
        width: 120,
        renderCell: (params) => (
          <Chip
            label={getFlowStatusLabel(
              params.row.flowStatus?.paymentNotice ?? "PENDING",
            )}
            size="small"
            color={getFlowStatusColor(
              params.row.flowStatus?.paymentNotice ?? "PENDING",
            )}
            variant="outlined"
          />
        ),
      },
      {
        field: "actions",
        headerName: "Thao tác",
        width: 160,
        sortable: false,
        filterable: false,
        align: "center",
        headerAlign: "center",
        renderCell: (params) => (
          <Stack
            direction="row"
            spacing={0.5}
            alignItems="center"
            justifyContent="center"
            sx={{ width: "100%", height: "100%" }}
          >
            <Tooltip title="Quy trình QR / Bill / Notice">
              <IconButton
                size="small"
                onClick={(event) => handleOpenFlowMenu(event, params.row)}
              >
                <AutoAwesomeIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            <Tooltip title="Sửa">
              <IconButton size="small" onClick={() => handleEdit(params.row)}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            <Tooltip title={canDelete ? "Xóa" : "Bạn không có quyền xóa"}>
              <span>
                <IconButton
                  size="small"
                  disabled={!canDelete}
                  onClick={() => handleDelete(params.row.id)}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        ),
      },
    ],
    [canDelete, handleDelete, handleEdit, handleOpenFlowMenu],
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
  const hasActiveQr = Boolean(flowMenuRow?.activeQr?.qrImageUrl);

  return (
    <>
      <Stack spacing={2.5}>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2, sm: 3 }, // Thu nhỏ padding trên mobile để tăng diện tích hiển thị
            borderRadius: 3,
            border: "1px solid",
            borderColor: "divider",
            bgcolor: "background.paper",
          }}
        >
          <Stack spacing={3}>
            {/* Header Section */}
            <Stack
              direction={{ xs: "column", sm: "row" }} // Mobile xếp dọc, Desktop xếp ngang
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", sm: "center" }} // Căn lề trái trên mobile
              spacing={2}
            >
              <Box>
                <Typography
                  variant="h6"
                  fontWeight={700}
                  color="text.primary"
                  gutterBottom
                >
                  Quản lý học phí
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Quản lý hóa đơn và thanh toán học viên
                </Typography>
              </Box>

              {/* Button Group */}
              <Stack
                direction="row"
                spacing={1.5}
                width={{ xs: "100%", sm: "auto" }} // Mobile chiếm hết chiều rộng
              >
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={handleCreate}
                  fullWidth={{ xs: true, sm: false }} // Mobile giãn full width
                  sx={{ py: 1, px: 2 }} // Tăng độ dày nút bấm một chút cho dễ tương tác
                >
                  Tạo hóa đơn
                </Button>

                <Button
                  variant="outlined" // Đổi từ 'text' sang 'outlined' để nút "Hàng loạt" có ranh giới rõ ràng hơn
                  color="secondary"
                  startIcon={<ReceiptLongIcon />}
                  onClick={() => setShowBulkDialog(true)}
                  fullWidth={{ xs: true, sm: false }}
                  sx={{ py: 1, px: 2 }}
                >
                  Hàng loạt
                </Button>
              </Stack>
            </Stack>

            <Divider />

            {/* Filters Section */}
            <Stack
              direction={{ xs: "column", md: "row" }} // Chuyển sang hàng ngang từ màn hình md thay vì lg để tránh bị chật
              spacing={2}
              alignItems="center"
              width="100%"
            >
              {/* Ô tìm kiếm */}
              <TextField
                label="Tìm kiếm"
                placeholder="Mã/tên học viên, mã/tên lớp..."
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                fullWidth
                slotProps={{
                  input: {
                    startAdornment: (
                      <SearchIcon
                        fontSize="small"
                        sx={{ mr: 1, color: "text.secondary" }} // Thêm khoảng cách và màu nhẹ cho icon
                      />
                    ),
                  },
                }}
              />

              {/* Ô trạng thái */}
              <TextField
                select
                label="Trạng thái"
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  setPageNumber(1);
                }}
                fullWidth
                sx={{
                  minWidth: { xs: "100%", md: 200 },
                  maxWidth: { xs: "100%", md: 300 }, // Thay vì gán cứng 500px gây vỡ layout mobile
                }}
              >
                <MenuItem value="">Tất cả trạng thái</MenuItem>
                <MenuItem value="unpaid">Chưa thanh toán</MenuItem>
                <MenuItem value="partial">Thanh toán một phần</MenuItem>
                <MenuItem value="paid">Đã thanh toán</MenuItem>
              </TextField>

              {/* Ô Kỳ học phí */}
              <DatePicker
                label="Kỳ học phí"
                views={["year", "month"]}
                format="YYYY-MM"
                value={monthFilter ? dayjs(monthFilter) : null}
                onChange={(value: Dayjs | null) => {
                  setMonthFilter(value ? value.format("YYYY-MM") : "");
                  setPageNumber(1);
                }}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    sx: {
                      minWidth: { xs: "100%", md: 180 },
                      maxWidth: { xs: "100%", md: 240 },
                    },
                  },
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

      {/* Flow actions menu — grouped QR / Invoice / Notice steps for one row */}
      <Menu
        anchorEl={flowMenuAnchor}
        open={Boolean(flowMenuAnchor)}
        onClose={handleCloseFlowMenu}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <MenuItem
          disabled={!flowMenuRow}
          onClick={() =>
            flowMenuRow &&
            runFlowMenuAction(() =>
              handleFlowAction(
                flowMenuRow.id,
                "generate-qr",
                "Đã tạo QR thanh toán",
              ),
            )
          }
        >
          <ListItemIcon>
            <QrCode2Icon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Tạo QR thanh toán"
            secondary={
              flowMenuRow
                ? getFlowStatusLabel(flowMenuRow.flowStatus?.qr ?? "PENDING")
                : undefined
            }
          />
        </MenuItem>

        <MenuItem
          disabled={!hasActiveQr}
          onClick={() =>
            runFlowMenuAction(() =>
              handleOpenQr(flowMenuRow?.activeQr?.qrImageUrl),
            )
          }
        >
          <ListItemIcon>
            <VisibilityIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Xem QR" />
        </MenuItem>

        <Divider />

        <MenuItem
          disabled={!flowMenuRow}
          onClick={() =>
            flowMenuRow &&
            runFlowMenuAction(() =>
              handleFlowAction(
                flowMenuRow.id,
                "generate-notice",
                "Đã tạo bill tạm",
              ),
            )
          }
        >
          <ListItemIcon>
            <ReceiptLongIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Tạo bill tạm"
            secondary={
              flowMenuRow
                ? getFlowStatusLabel(
                    flowMenuRow.flowStatus?.temporaryInvoice ?? "PENDING",
                  )
                : undefined
            }
          />
        </MenuItem>

        <MenuItem
          disabled={!flowMenuRow}
          onClick={() =>
            flowMenuRow &&
            runFlowMenuAction(() => handleExportPdf(flowMenuRow.id))
          }
        >
          <ListItemIcon>
            <PictureAsPdfIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Xuất PDF bill tạm" />
        </MenuItem>

        <Divider />

        <MenuItem
          disabled={!flowMenuRow}
          onClick={() =>
            flowMenuRow &&
            runFlowMenuAction(() =>
              handleFlowAction(
                flowMenuRow.id,
                "send-notice",
                "Đã gửi thông báo học phí",
              ),
            )
          }
        >
          <ListItemIcon>
            <SendIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Gửi thông báo học phí"
            secondary={
              flowMenuRow
                ? getFlowStatusLabel(
                    flowMenuRow.flowStatus?.paymentNotice ?? "PENDING",
                  )
                : undefined
            }
          />
        </MenuItem>

        <Divider />

        <MenuItem
          disabled={!flowMenuRow}
          onClick={() =>
            flowMenuRow &&
            runFlowMenuAction(() =>
              handleFlowAction(
                flowMenuRow.id,
                "generate-all",
                "Đã hoàn tất full flow học phí",
              ),
            )
          }
        >
          <ListItemIcon>
            <AutoAwesomeIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Chạy toàn bộ quy trình" />
        </MenuItem>
      </Menu>

      {showForm && (
        <StudentFeeForm
          initialData={
            editingFee?.month
              ? {
                  id: editingFee.id,
                  studentId: editingFee.studentId,
                  classId: editingFee.classId,
                  month: editingFee.month,
                  amount: editingFee.amount,
                  discount: editingFee.discount,
                  dueDate: editingFee.dueDate,
                  status: editingFee.status,
                  student: editingFee.student,
                  class: editingFee.class,
                }
              : undefined
          }
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
