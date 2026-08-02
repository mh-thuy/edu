"use client";

import React, { useCallback, useMemo, useState } from "react";
import type { RoleCode } from "@/constants/roles";
import {
  Alert,
  Box,
  Button,
  Chip,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import {
  GridActionsCellItem,
  type GridColDef,
  type GridRenderCellParams,
} from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ReceiptIcon from "@mui/icons-material/Receipt";
import SearchIcon from "@mui/icons-material/Search";

import { BaseTable } from "@/components/shared/tables/BaseTable";
import { EmptyState } from "@/components/shared/tables/EmptyState";
import { useList } from "@/hooks/useList";
import { useSnackbar } from "@/hooks/useSnackbar";

import { PaymentForm } from "./PaymentForm";
import { DatePicker } from "@mui/x-date-pickers";
import dayjs from "dayjs";
import { extractApiErrorMessage, unwrapApiResponse } from "@/lib/api-client";

type PaymentMethod = "CASH" | "TRANSFER" | "WALLET";
type PaymentStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "FAILED" | "REFUNDED";

interface Payment {
  id: string;
  studentFeeId: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  paymentDate: string;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  receipts?: Array<{
    id: string;
    receiptNumber: string;
  }>;
  studentFee?: {
    id: string;
    month: string;
    amount: number;
    student?: {
      code: string;
      fullName: string;
    } | null;
    class?: {
      code: string;
      name: string;
    } | null;
    payments?: Array<{
      id: string;
      amount: number;
    }>;
  } | null;
}

interface RegisteredStudentFee {
  id: string;
  studentId: string;
  billingYear: number;
  billingMonth: number;
  amount: number;
  finalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  status: "UNPAID" | "PARTIAL" | "PAID" | "CANCELLED";
  student?: { code: string; fullName: string } | null;
  class?: { code: string; name: string } | null;
  flowStatus?: {
    qr: "PENDING" | "GENERATED" | "FAILED";
    temporaryInvoice: "PENDING" | "GENERATED" | "SENT" | "FAILED";
  };
}

const formatCurrency = (value: number): string =>
  `${new Intl.NumberFormat("vi-VN").format(value)} VND`;

const formatDate = (value: string): string =>
  new Date(value).toLocaleDateString("vi-VN");

const getMethodLabel = (method: PaymentMethod): string => {
  const labels: Record<PaymentMethod, string> = {
    CASH: "Tiền mặt",
    TRANSFER: "Chuyển khoản",
    WALLET: "Ví điện tử",
  };

  return labels[method];
};

type PaymentListProps = {
  role: RoleCode;
};

export function PaymentList({ role }: PaymentListProps) {
  void role;
  const { showError, showSuccess, Snackbar } = useSnackbar();
  const [showForm, setShowForm] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [search, setSearch] = useState("");
  const [filterMethod, setFilterMethod] = useState<string>("");
  const [filterDateStart, setFilterDateStart] = useState<string>("");
  const [filterDateEnd, setFilterDateEnd] = useState<string>("");
  const [feeSearch, setFeeSearch] = useState("");
  const [activeView, setActiveView] = useState<"fees" | "payments">("fees");

  const {
    data: payments,
    isLoading,
    error,
    refresh,
    page,
    pageSize,
    setPageNumber,
    setPageSize,
  } = useList<Payment>("/api/payments", {
    pageSize: 10,
    search: search || undefined,
    method: filterMethod || undefined,
    startDate: filterDateStart || undefined,
    endDate: filterDateEnd || undefined,
  });

  const {
    data: registeredFees,
    isLoading: isFeesLoading,
    error: feesError,
    page: feesPage,
    pageSize: feesPageSize,
    setPageNumber: setFeesPage,
    setPageSize: setFeesPageSize,
  } = useList<RegisteredStudentFee>("/api/student-fees", {
    pageSize: 100,
    search: feeSearch || undefined,
  });

  const handleGenerateReceipt = useCallback(
    async (paymentId: string) => {
      try {
        const response = await fetch(`/api/payments/${paymentId}/receipt`, {
          method: "POST",
        });

        if (!response.ok) {
          throw new Error(
            await extractApiErrorMessage(response, "Failed to generate receipt"),
          );
        }
        const result = await unwrapApiResponse<{ receiptNumber?: string }>(response);

        showSuccess(`Tạo phiếu thu thành công: ${result.receiptNumber}`);
        await refresh();
      } catch (error) {
        showError(
          error instanceof Error ? error.message : "Tạo phiếu thu thất bại",
        );
      }
    },
    [refresh, showError, showSuccess],
  );

  const handleConfirmPayment = useCallback(
    async (paymentId: string) => {
      try {
        const response = await fetch(`/api/payments/${paymentId}/confirm`, {
          method: "POST",
        });

        if (!response.ok) {
          throw new Error(
            await extractApiErrorMessage(response, "Failed to confirm payment"),
          );
        }

        const result = await unwrapApiResponse<Payment>(response);
        showSuccess(
          result.receipts?.[0]?.receiptNumber
            ? `Xác nhận thanh toán và tạo phiếu thu ${result.receipts[0].receiptNumber}`
            : "Xác nhận thanh toán thành công",
        );
        await refresh();
      } catch (error) {
        showError(
          error instanceof Error ? error.message : "Xác nhận thanh toán thất bại",
        );
      }
    },
    [refresh, showError, showSuccess],
  );

  const columns: GridColDef<Payment>[] = useMemo(
    () => [
      {
        field: "student",
        headerName: "Học viên",
        minWidth: 220,
        flex: 1,
        renderCell: ({ row }: GridRenderCellParams<Payment>) =>
          row.studentFee?.student
            ? `${row.studentFee.student.code} - ${row.studentFee.student.fullName}`
            : row.studentFeeId,
      },
      {
        field: "class",
        headerName: "Lớp",
        minWidth: 220,
        flex: 1,
        renderCell: ({ row }: GridRenderCellParams<Payment>) =>
          row.studentFee?.class
            ? `${row.studentFee.class.code} - ${row.studentFee.class.name}`
            : "-",
      },
      {
        field: "month",
        headerName: "Tháng học phí",
        width: 120,
        renderCell: ({ row }: GridRenderCellParams<Payment>) =>
          row.studentFee?.month || "-",
      },
      {
        field: "amount",
        headerName: "Số tiền",
        width: 150,
        align: "right",
        headerAlign: "right",
        renderCell: ({ row }: GridRenderCellParams<Payment>) =>
          formatCurrency(row.amount),
      },
      {
        field: "method",
        headerName: "Phương thức",
        width: 150,
        align: "center",
        headerAlign: "center",
        renderCell: ({ row }: GridRenderCellParams<Payment>) => (
          <Box
            sx={{
              width: "100%",
              height: "100%",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Chip
              label={getMethodLabel(row.method)}
              size="small"
              variant="outlined"
            />
          </Box>
        ),
      },
      {
        field: "paymentDate",
        headerName: "Ngày thanh toán",
        width: 140,
        renderCell: ({ row }: GridRenderCellParams<Payment>) =>
          formatDate(row.paymentDate),
      },
      {
        field: "status",
        headerName: "Trạng thái",
        width: 130,
        align: "center",
        headerAlign: "center",
        renderCell: ({ row }) => (
          <Chip
            label={
              row.status === "CONFIRMED"
                ? "Đã xác nhận"
                : row.status === "PENDING"
                  ? "Chờ xác nhận"
                  : row.status === "CANCELLED"
                    ? "Đã hủy"
                    : row.status === "REFUNDED"
                      ? "Đã hoàn tiền"
                      : "Thất bại"
            }
            size="small"
            color={row.status === "CONFIRMED" ? "success" : "warning"}
            variant="outlined"
          />
        ),
      },
      {
        field: "receipt",
        headerName: "Phiếu thu",
        width: 170,
        align: "center",
        headerAlign: "center",
        renderCell: ({ row }: GridRenderCellParams<Payment>) => {
          const receipt = row.receipts?.[0];

          return (
            <Box
              sx={{
                width: "100%",
                height: "100%",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Chip
                label={receipt?.receiptNumber ?? "Chưa phát hành"}
                size="small"
                color={receipt ? "success" : "default"}
                variant={receipt ? "filled" : "outlined"}
              />
            </Box>
          );
        },
      },
      {
        field: "notes",
        headerName: "Ghi chú",
        minWidth: 180,
        flex: 1,
        renderCell: ({ row }: GridRenderCellParams<Payment>) =>
          row.notes || "-",
      },
      {
        field: "actions",
        type: "actions",
        width: 140,
        getActions: (params) => {
          const row = params.row as Payment;
          const hasReceipt = (row.receipts?.length || 0) > 0;
          const isPending = row.status === "PENDING";

          return [
            <GridActionsCellItem
              key="confirm"
              icon={<CheckCircleIcon />}
              label="Xác nhận"
              disabled={!isPending}
              onClick={() => void handleConfirmPayment(row.id)}
            />,
            <GridActionsCellItem
              key="edit"
              icon={<EditIcon />}
              label="Sửa"
              disabled={hasReceipt}
              onClick={() => {
                setEditingPayment(row);
                setShowForm(true);
              }}
            />,
            <GridActionsCellItem
              key="receipt"
              icon={<ReceiptIcon />}
              label="Phiếu thu"
              disabled={hasReceipt}
              onClick={() => void handleGenerateReceipt(row.id)}
            />,
          ];
        },
      },
    ],
    [handleConfirmPayment, handleGenerateReceipt],
  );

  const feeColumns: GridColDef<RegisteredStudentFee>[] = useMemo(
    () => [
      {
        field: "student",
        headerName: "Học viên",
        minWidth: 220,
        flex: 1,
        renderCell: ({ row }) =>
          row.student ? `${row.student.code} - ${row.student.fullName}` : "-",
      },
      {
        field: "class",
        headerName: "Lớp",
        minWidth: 200,
        flex: 1,
        renderCell: ({ row }) =>
          row.class ? `${row.class.code} - ${row.class.name}` : "-",
      },
      {
        field: "month",
        headerName: "Kỳ học phí",
        width: 120,
        renderCell: ({ row }) =>
          `${row.billingYear}-${String(row.billingMonth).padStart(2, "0")}`,
      },
      {
        field: "outstandingAmount",
        headerName: "Còn nợ",
        width: 140,
        align: "right",
        headerAlign: "right",
        renderCell: ({ row }) => formatCurrency(row.outstandingAmount),
      },
      {
        field: "status",
        headerName: "Trạng thái",
        width: 140,
        align: "center",
        headerAlign: "center",
        renderCell: ({ row }) => (
          <Chip
            label={
              row.status === "PAID"
                ? "Đã thanh toán"
                : row.status === "PARTIAL"
                  ? "Một phần"
                  : row.status === "CANCELLED"
                    ? "Đã hủy"
                    : "Chưa thanh toán"
            }
            size="small"
            color={row.status === "PAID" ? "success" : "warning"}
            variant="outlined"
          />
        ),
      },
      {
        field: "paymentPackage",
        headerName: "Bộ thanh toán",
        width: 150,
        align: "center",
        headerAlign: "center",
        renderCell: ({ row }) => {
          const qrReady = row.flowStatus?.qr === "GENERATED";
          const noticeReady =
            row.flowStatus?.temporaryInvoice === "GENERATED" ||
            row.flowStatus?.temporaryInvoice === "SENT";
          const ready = qrReady && noticeReady;
          const partial = qrReady || noticeReady;

          return (
            <Chip
              size="small"
              label={ready ? "Đã tạo" : partial ? "Chưa đủ" : "Chưa tạo"}
              color={ready ? "success" : partial ? "warning" : "default"}
              variant="outlined"
            />
          );
        },
      },
    ],
    [],
  );

  const hasRows = (payments?.items.length || 0) > 0;
  const hasPaymentFilters = Boolean(
    search || filterMethod || filterDateStart || filterDateEnd,
  );

  return (
    <>
      <Stack spacing={2.5}>
        <Paper
          elevation={0}
          sx={{
            p: 2.5,
            borderRadius: 3,
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <Stack spacing={2}>
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={2}
              alignItems={{ xs: "stretch", md: "center" }}
              justifyContent="space-between"
            >
              <Typography variant="h6" fontWeight={700}>
                Thanh toán học phí
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => {
                  setEditingPayment(null);
                  setShowForm(true);
                }}
              >
                Ghi nhận thanh toán
              </Button>
            </Stack>

            <Tabs
              value={activeView}
              onChange={(_, value: "fees" | "payments") => setActiveView(value)}
              variant="scrollable"
              allowScrollButtonsMobile
            >
              <Tab
                value="fees"
                label={`Cần thu (${registeredFees?.total ?? 0})`}
              />
              <Tab
                value="payments"
                label={`Lịch sử giao dịch (${payments?.total ?? 0})`}
              />
            </Tabs>

            {activeView === "payments" && (
              <Stack spacing={1.5}>
                <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                  <TextField
                    label="Tìm giao dịch"
                    placeholder="Học viên, lớp, tháng, ghi chú"
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
                    label="Phương thức"
                    value={filterMethod}
                    onChange={(event) => {
                      setFilterMethod(event.target.value);
                      setPageNumber(1);
                    }}
                    sx={{ width: { xs: "100%", md: 220 } }}
                  >
                    <MenuItem value="">Tất cả</MenuItem>
                    <MenuItem value="cash">Tiền mặt</MenuItem>
                    <MenuItem value="transfer">Chuyển khoản</MenuItem>
                    <MenuItem value="wallet">Ví điện tử</MenuItem>
                  </TextField>

                  <DatePicker
                    label="Từ ngày"
                    format="DD/MM/YYYY"
                    value={filterDateStart ? dayjs(filterDateStart) : null}
                    onChange={(value) => {
                      setFilterDateStart(value ? value.format("YYYY-MM-DD") : "");
                      setPageNumber(1);
                    }}
                  />

                  <DatePicker
                    label="Đến ngày"
                    format="DD/MM/YYYY"
                    value={filterDateEnd ? dayjs(filterDateEnd) : null}
                    onChange={(value) => {
                      setFilterDateEnd(value ? value.format("YYYY-MM-DD") : "");
                      setPageNumber(1);
                    }}
                    minDate={filterDateStart ? dayjs(filterDateStart) : undefined}
                  />
                </Stack>
                <Box display="flex" justifyContent="flex-end">
                  <Button
                    size="small"
                    onClick={() => {
                      setSearch("");
                      setFilterMethod("");
                      setFilterDateStart("");
                      setFilterDateEnd("");
                      setPageNumber(1);
                    }}
                    disabled={!hasPaymentFilters}
                  >
                    Xóa bộ lọc
                  </Button>
                </Box>
              </Stack>
            )}
          </Stack>
        </Paper>

        {activeView === "fees" && <Paper
          elevation={0}
          sx={{
            borderRadius: 3,
            border: "1px solid",
            borderColor: "divider",
            overflow: "hidden",
          }}
        >
            <Stack spacing={2} sx={{ p: 2.5 }}>
            <Box>
              <Typography variant="h6" fontWeight={700}>
                Học phí cần thu
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Chọn một dòng để tạo trọn bộ QR, bill tạm và PDF cho toàn bộ học phí còn nợ của học viên.
              </Typography>
            </Box>
            <TextField
              label="Tìm học phí"
              placeholder="Mã/tên học viên, mã/tên lớp, tháng"
              value={feeSearch}
              onChange={(event) => {
                setFeeSearch(event.target.value);
                setFeesPage(1);
              }}
              fullWidth
            />
            <Box display="flex" justifyContent="flex-end">
              <Button
                size="small"
                onClick={() => {
                  setFeeSearch("");
                  setFeesPage(1);
                }}
                disabled={!feeSearch}
              >
                Xóa tìm kiếm
              </Button>
            </Box>
          </Stack>
          {feesError ? (
            <Box p={3}>
              <Alert severity="error">{feesError}</Alert>
            </Box>
          ) : (
            <BaseTable
              rows={registeredFees?.items || []}
              columns={feeColumns}
              isLoading={isFeesLoading}
              totalRows={registeredFees?.total || 0}
              page={feesPage}
              pageSize={feesPageSize}
              onPageChange={setFeesPage}
              onPageSizeChange={setFeesPageSize}
            />
          )}
        </Paper>}

        {activeView === "payments" && <Paper
          elevation={0}
          sx={{
            borderRadius: 3,
            border: "1px solid",
            borderColor: "divider",
            overflow: "hidden",
          }}
          >
          <Stack spacing={0.5} sx={{ p: 2.5, pb: 1 }}>
            <Typography variant="h6" fontWeight={700}>
              Lịch sử giao dịch
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Xác nhận các khoản đang chờ và in phiếu thu từ giao dịch đã ghi nhận.
            </Typography>
          </Stack>
          {error ? (
            <Box p={3}>
              <Alert severity="error">{error}</Alert>
            </Box>
          ) : !isLoading && !hasRows ? (
            <EmptyState
              title="Chưa có thanh toán"
              description="Không tìm thấy dữ liệu phù hợp với bộ lọc hiện tại."
            />
          ) : (
            <BaseTable
              rows={payments?.items || []}
              columns={columns}
              isLoading={isLoading}
              totalRows={payments?.total || 0}
              page={page}
              pageSize={pageSize}
              onPageChange={setPageNumber}
              onPageSizeChange={setPageSize}
            />
          )}
        </Paper>}
      </Stack>

      {showForm && (
        <PaymentForm
          initialData={editingPayment || undefined}
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false);
            setEditingPayment(null);
            void refresh();
          }}
        />
      )}

      {Snackbar}
    </>
  );
}
