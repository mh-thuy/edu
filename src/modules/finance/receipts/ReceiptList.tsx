"use client";

import React, { useMemo, useCallback, useState } from "react";
import type { Role } from "@prisma/client";
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  GridActionsCellItem,
  GridColDef,
  GridRenderCellParams,
} from "@mui/x-data-grid";
import PrintIcon from "@mui/icons-material/Print";
import VisibilityIcon from "@mui/icons-material/Visibility";
import DeleteIcon from "@mui/icons-material/Delete";
import SearchIcon from "@mui/icons-material/Search";
import { DatePicker } from "@mui/x-date-pickers";
import dayjs from "dayjs";

import { BaseTable } from "@/components/shared/tables/BaseTable";
import { EmptyState } from "@/components/shared/tables/EmptyState";
import { useList } from "@/hooks/useList";
import { useSnackbar } from "@/hooks/useSnackbar";
import { useApiCall } from "@/hooks/useApiCall";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type PaymentMethod = "cash" | "transfer" | "wallet";

interface Receipt {
  id: string;
  paymentId: string;
  receiptNumber: string;
  issueDate: string;
  printedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  payment: {
    amount: number;
    method: PaymentMethod;
    paymentDate: string;
    notes?: string | null;
    studentFee: {
      studentId: string;
      classId: string;
      month: string;
      student: {
        code: string;
        fullName: string;
      };
      class: {
        code: string;
        name: string;
      };
    };
  };
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount);
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const formatDateTime = (dateString: string) => {
  return new Date(dateString).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getMethodLabel = (method: PaymentMethod) => {
  const labels: Record<PaymentMethod, string> = {
    cash: "Tiền mặt",
    transfer: "Chuyển khoản",
    wallet: "Ví điện tử",
  };
  return labels[method] || method;
};

type ReceiptListProps = {
  role: Role;
};

export function ReceiptList({ role }: ReceiptListProps) {
  const canDelete = role === "ADMIN";
  const snackbar = useSnackbar();
  const { showSuccess, showError } = snackbar;

  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Search and filter states
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [isPrintedFilter, setIsPrintedFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState<dayjs.Dayjs | null>(null);
  const [endDate, setEndDate] = useState<dayjs.Dayjs | null>(null);

  const {
    data: receipts,
    isLoading,
    error,
    refresh,
    page,
    pageSize,
    setPageNumber,
    setPageSize,
  } = useList<Receipt>("/api/receipts", {
    search,
    ...(isPrintedFilter !== "all" && { isPrinted: isPrintedFilter }),
    ...(startDate && { startDate: startDate.format("YYYY-MM-DD") }),
    ...(endDate && { endDate: endDate.format("YYYY-MM-DD") }),
  });

  const { execute: markPrinted, isLoading: marking } = useApiCall();
  const { execute: deleteReceipt, isLoading: deleting } = useApiCall();

  const handleSearch = useCallback(() => {
    setSearch(searchInput);
    setPageNumber(1);
  }, [searchInput, setPageNumber]);

  const handleClearFilters = useCallback(() => {
    setSearchInput("");
    setSearch("");
    setIsPrintedFilter("all");
    setStartDate(null);
    setEndDate(null);
    setPageNumber(1);
  }, [setPageNumber]);

  const handlePreview = (receipt: Receipt) => {
    setSelectedReceipt(receipt);
    setShowPreview(true);
  };

  const handlePrint = useCallback(
    async (receipt: Receipt) => {
      try {
        await markPrinted(`/api/receipts/${receipt.id}/print`, {
          method: "POST",
        });
        showSuccess?.("Đã đánh dấu phiếu thu là đã in");
        refresh();

        window.print();
      } catch (error) {
        showError?.(
          error instanceof Error ? error.message : "Không thể in phiếu thu",
        );
      }
    },
    [markPrinted, showSuccess, showError, refresh],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteReceipt(`/api/receipts/${id}`, {
          method: "DELETE",
        });
        showSuccess?.("Đã xóa phiếu thu");
        refresh();
        setDeleteId(null);
      } catch (error) {
        showError?.(
          error instanceof Error ? error.message : "Không thể xóa phiếu thu",
        );
      }
    },
    [deleteReceipt, showSuccess, showError, refresh],
  );

  const columns: GridColDef[] = useMemo(
    () => [
      {
        field: "receiptNumber",
        headerName: "Số phiếu",
        flex: 1,
        align: "center",
        headerAlign: "center",
        renderCell: ({ row }: GridRenderCellParams<Receipt>) => (
          <Box
            sx={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Typography
              variant="body2"
              sx={{
                fontWeight: 600,
                color: "primary.main",
              }}
            >
              {row.receiptNumber}
            </Typography>
          </Box>
        ),
      },
      {
        field: "student",
        headerName: "Học viên",
        width: 200,
        valueGetter: (params: string, row: Receipt) =>
          `${row.payment.studentFee.student.code} - ${row.payment.studentFee.student.fullName}`,
      },
      {
        field: "class",
        headerName: "Lớp",
        width: 180,
        valueGetter: (params: string, row: Receipt) =>
          row.payment.studentFee.class.name,
      },
      {
        field: "month",
        headerName: "Tháng học",
        width: 120,
        align: "center",
        headerAlign: "center",
        valueGetter: (params: string, row: Receipt) =>
          row.payment.studentFee.month,
      },
      {
        field: "amount",
        headerName: "Số tiền",
        flex: 1,
        align: "right",
        headerAlign: "right",
        renderCell: (params) => (
          <Box
            sx={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
            }}
          >
            <Typography
              variant="body2"
              sx={{
                fontWeight: 600,
                color: "success.main",
              }}
            >
              {formatCurrency(params.row.payment.amount)}
            </Typography>
          </Box>
        ),
      },
      {
        field: "paymentDate",
        headerName: "Ngày thu",
        width: 120,
        align: "center",
        headerAlign: "center",
        valueGetter: (params: string, row: Receipt) =>
          formatDate(row.payment.paymentDate),
      },
      {
        field: "method",
        headerName: "Phương thức",
        width: 140,
        align: "center",
        headerAlign: "center",
        renderCell: (params: GridRenderCellParams<Receipt>) => (
          <Chip
            label={getMethodLabel(params.row.payment.method)}
            size="small"
            color="default"
            variant="outlined"
          />
        ),
      },
      {
        field: "printedAt",
        headerName: "Trạng thái",
        width: 130,
        align: "center",
        headerAlign: "center",
        renderCell: (params: GridRenderCellParams<Receipt>) => (
          <Chip
            label={params.row.printedAt ? "Đã in" : "Chưa in"}
            size="small"
            color={params.row.printedAt ? "success" : "warning"}
          />
        ),
      },
      {
        field: "actions",
        type: "actions",
        headerName: "Thao tác",
        width: 150,
        getActions: (params) => [
          <GridActionsCellItem
            key="preview"
            icon={<VisibilityIcon />}
            label="Xem"
            onClick={() => handlePreview(params.row as Receipt)}
          />,
          <GridActionsCellItem
            key="print"
            icon={<PrintIcon />}
            label="In"
            onClick={() => handlePrint(params.row as Receipt)}
            disabled={marking}
          />,
          <GridActionsCellItem
            key="delete"
            icon={<DeleteIcon />}
            label="Xóa"
            onClick={() => setDeleteId(params.row.id)}
            disabled={!!(params.row as Receipt).printedAt || !canDelete || deleting}
          />,
        ],
      },
    ],
    [canDelete, deleting, handlePrint, marking],
  );

  return (
    <>
      <Card>
        <Box p={3}>
          <Stack spacing={3}>
            <Typography variant="h5" fontWeight="bold">
              Quản lý phiếu thu
            </Typography>

            {error && (
              <Alert severity="error" onClose={() => refresh()}>
                {error}
              </Alert>
            )}

            <Paper sx={{ p: 2 }}>
              <Stack spacing={2}>
                <Stack direction="row" spacing={2}>
                  <TextField
                    placeholder="Tìm mã biên lai, học viên, lớp..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSearch();
                    }}
                    size="small"
                    sx={{ flex: 1 }}
                    InputProps={{
                      startAdornment: (
                        <SearchIcon
                          sx={{
                            mr: 1,
                            color: "text.secondary",
                          }}
                        />
                      ),
                    }}
                  />
                  <Button
                    variant="contained"
                    onClick={handleSearch}
                    startIcon={<SearchIcon />}
                  >
                    Tìm kiếm
                  </Button>
                </Stack>

                <Stack direction="row" spacing={2} flexWrap="wrap">
                  <TextField
                    select
                    label="Trạng thái in"
                    value={isPrintedFilter}
                    onChange={(e) => {
                      setIsPrintedFilter(e.target.value);
                      setPageNumber(1);
                    }}
                    size="small"
                    sx={{ minWidth: 150 }}
                  >
                    <MenuItem value="all">Tất cả</MenuItem>
                    <MenuItem value="true">Đã in</MenuItem>
                    <MenuItem value="false">Chưa in</MenuItem>
                  </TextField>

                  <DatePicker
                    label="Từ ngày"
                    value={startDate}
                    onChange={(newValue) => {
                      setStartDate(newValue);
                      setPageNumber(1);
                    }}
                    slotProps={{
                      textField: { size: "small", sx: { minWidth: 150 } },
                    }}
                  />

                  <DatePicker
                    label="Đến ngày"
                    value={endDate}
                    onChange={(newValue) => {
                      setEndDate(newValue);
                      setPageNumber(1);
                    }}
                    slotProps={{
                      textField: { size: "small", sx: { minWidth: 150 } },
                    }}
                  />

                  <Button variant="outlined" onClick={handleClearFilters}>
                    Xóa bộ lọc
                  </Button>
                </Stack>
              </Stack>
            </Paper>

            {receipts?.items.length === 0 && !isLoading ? (
              <EmptyState
                title="Chưa có phiếu thu"
                description="Phiếu thu sẽ được tạo tự động khi có thanh toán"
              />
            ) : (
              <BaseTable
                rows={receipts?.items || []}
                columns={columns}
                isLoading={isLoading}
                totalRows={receipts?.total || 0}
                page={page}
                pageSize={pageSize}
                onPageChange={setPageNumber}
                onPageSizeChange={setPageSize}
              />
            )}
          </Stack>
        </Box>
      </Card>

      {showPreview && selectedReceipt && (
        <Dialog
          open
          maxWidth="md"
          fullWidth
          onClose={() => setShowPreview(false)}
        >
          <DialogTitle>
            <Typography variant="h6" fontWeight="bold">
              Phiếu thu - {selectedReceipt.receiptNumber}
            </Typography>
          </DialogTitle>
          <DialogContent>
            <Box
              sx={{
                p: 4,
                backgroundColor: "#ffffff",
                border: "2px solid #e0e0e0",
                borderRadius: 2,
              }}
            >
              <Box sx={{ textAlign: "center", mb: 4 }}>
                <Typography variant="h4" fontWeight="bold" color="primary">
                  PHIẾU THU
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 1 }}
                >
                  Số: {selectedReceipt.receiptNumber}
                </Typography>
              </Box>

              <Stack spacing={2.5}>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "200px 1fr",
                    gap: 2,
                  }}
                >
                  <Typography fontWeight="bold">Mã học viên:</Typography>
                  <Typography>
                    {selectedReceipt.payment.studentFee.student.code}
                  </Typography>

                  <Typography fontWeight="bold">Tên học viên:</Typography>
                  <Typography fontWeight="bold" color="primary">
                    {selectedReceipt.payment.studentFee.student.fullName}
                  </Typography>

                  <Typography fontWeight="bold">Lớp học:</Typography>
                  <Typography>
                    {selectedReceipt.payment.studentFee.class.name}
                  </Typography>

                  <Typography fontWeight="bold">Tháng học phí:</Typography>
                  <Typography>
                    {selectedReceipt.payment.studentFee.month}
                  </Typography>

                  <Typography fontWeight="bold">Số tiền đã thu:</Typography>
                  <Typography
                    variant="h6"
                    color="success.main"
                    fontWeight="bold"
                  >
                    {formatCurrency(selectedReceipt.payment.amount)}
                  </Typography>

                  <Typography fontWeight="bold">Ngày thu:</Typography>
                  <Typography>
                    {formatDate(selectedReceipt.payment.paymentDate)}
                  </Typography>

                  <Typography fontWeight="bold">
                    Phương thức thanh toán:
                  </Typography>
                  <Typography>
                    {getMethodLabel(selectedReceipt.payment.method)}
                  </Typography>

                  {selectedReceipt.payment.notes && (
                    <>
                      <Typography fontWeight="bold">Ghi chú:</Typography>
                      <Typography>{selectedReceipt.payment.notes}</Typography>
                    </>
                  )}
                </Box>

                <Box
                  sx={{
                    mt: 3,
                    pt: 3,
                    borderTop: "1px solid #e0e0e0",
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    Ngày phát hành: {formatDateTime(selectedReceipt.issueDate)}
                  </Typography>
                  {selectedReceipt.printedAt && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      display="block"
                    >
                      Đã in lúc: {formatDateTime(selectedReceipt.printedAt)}
                    </Typography>
                  )}
                </Box>
              </Stack>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowPreview(false)}>Đóng</Button>
            <Button
              variant="contained"
              startIcon={<PrintIcon />}
              onClick={() => {
                handlePrint(selectedReceipt);
                setShowPreview(false);
              }}
              disabled={marking}
            >
              In phiếu
            </Button>
          </DialogActions>
        </Dialog>
      )}

      <ConfirmDialog
        open={!!deleteId}
        title="Xóa phiếu thu"
        message="Bạn có chắc chắn muốn xóa phiếu thu này? Chỉ có thể xóa phiếu thu chưa in."
        onConfirm={() => deleteId && handleDelete(deleteId)}
        onCancel={() => setDeleteId(null)}
        isLoading={deleting}
      />
    </>
  );
}
