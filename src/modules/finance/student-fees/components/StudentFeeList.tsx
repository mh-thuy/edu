"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import type { GridColDef, GridRenderCellParams } from "@mui/x-data-grid";
import VisibilityIcon from "@mui/icons-material/Visibility";
import PaymentIcon from "@mui/icons-material/Payment";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import DescriptionIcon from "@mui/icons-material/Description";
import type { RoleCode } from "@/constants/roles";
import { BaseTable } from "@/components/shared/tables/BaseTable";
import { EmptyState } from "@/components/shared/tables/EmptyState";
import { useList } from "@/hooks/useList";
import { useSnackbar } from "@/hooks/useSnackbar";
import { useDisclosure } from "@/hooks/useDisclosure";
import { MasterSelectField, type MasterSelectValue } from "@/components/shared/forms/MasterSelectField";
import { StudentSelectDialog } from "@/components/shared/dialogs/StudentSelectDialog";
import { ClassSelectDialog } from "@/components/shared/dialogs/ClassSelectDialog";
import { extractApiErrorMessage, unwrapApiResponse } from "@/lib/api-client";
import { useRouter } from "next/navigation";
import { DatePicker } from "@mui/x-date-pickers";
import dayjs, { type Dayjs } from "dayjs";

type TuitionStatus = "UNPAID" | "PARTIAL" | "PAID" | "OVERDUE";

interface StudentFeeItem {
  id: string;
  feeNumber?: string;
  studentId: string;
  classId: string;
  month: string;
  amount: number;
  discount: number;
  finalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  dueDate: string | null;
  status: "UNPAID" | "PARTIAL" | "PAID";
  displayStatus?: TuitionStatus;
  student?: {
    code: string;
    fullName: string;
  } | null;
  class?: {
    code: string;
    name: string;
  } | null;
}

interface TuitionSummary {
  totalRevenue: number;
  paidRevenue: number;
  outstandingRevenue: number;
  overdueRevenue: number;
  totalStudentsUnpaid: number;
}

type StudentFeeListProps = {
  role: RoleCode;
};

const statusOptions: Array<{ value: string; label: string }> = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "UNPAID", label: "Chưa thanh toán" },
  { value: "PARTIAL", label: "Thanh toán một phần" },
  { value: "PAID", label: "Đã thanh toán" },
  { value: "OVERDUE", label: "Quá hạn" },
];

const formatCurrency = (value: number) =>
  `${new Intl.NumberFormat("vi-VN").format(value)} ₫`;

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString("vi-VN") : "-";

const getStatusLabel = (status: TuitionStatus) => {
  switch (status) {
    case "PAID":
      return "Đã thanh toán";
    case "PARTIAL":
      return "Thanh toán một phần";
    case "OVERDUE":
      return "Quá hạn";
    default:
      return "Chưa thanh toán";
  }
};

const getStatusColor = (status: TuitionStatus) => {
  switch (status) {
    case "PAID":
      return "success";
    case "PARTIAL":
      return "warning";
    case "OVERDUE":
      return "error";
    default:
      return "default";
  }
};

const toTuitionStatus = (fee: StudentFeeItem): TuitionStatus => {
  if (fee.displayStatus) {
    return fee.displayStatus;
  }
  return fee.status;
};

export function StudentFeeList({ role }: StudentFeeListProps) {
  const router = useRouter();
  const snackbar = useSnackbar();
  const studentDialog = useDisclosure();
  const classDialog = useDisclosure();
  void role;

  const [selectedStudent, setSelectedStudent] = useState<MasterSelectValue | null>(null);
  const [selectedClass, setSelectedClass] = useState<MasterSelectValue | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [overdueFilter, setOverdueFilter] = useState("");
  const [summary, setSummary] = useState<TuitionSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  const filters = useMemo(
    () => ({
      studentId: selectedStudent?.id || undefined,
      classId: selectedClass?.id || undefined,
      status: statusFilter || undefined,
      month: monthFilter || undefined,
      overdue: overdueFilter || undefined,
      pageSize: 10,
    }),
    [selectedStudent?.id, selectedClass?.id, statusFilter, monthFilter, overdueFilter],
  );

  const {
    data: fees,
    isLoading,
    error,
    refresh,
    page,
    pageSize,
    setPageNumber,
    setPageSize,
  } = useList<StudentFeeItem>("/api/student-fees", filters);

  useEffect(() => {
    const loadSummary = async () => {
      try {
        setLoadingSummary(true);
        const params = new URLSearchParams();
        if (filters.studentId) params.set("studentId", filters.studentId);
        if (filters.classId) params.set("classId", filters.classId);
        if (filters.status) params.set("status", filters.status);
        if (filters.month) params.set("month", filters.month);
        if (filters.overdue) params.set("overdue", filters.overdue);

        const response = await fetch(`/api/student-fees/summary?${params.toString()}`);
        if (!response.ok) {
          throw new Error(
            await extractApiErrorMessage(response, "Không tải được tổng hợp học phí"),
          );
        }
        const data = await unwrapApiResponse<TuitionSummary>(response);
        setSummary(data);
      } catch (loadError) {
        snackbar.showError(
          loadError instanceof Error
            ? loadError.message
            : "Không tải được tổng hợp học phí",
        );
      } finally {
        setLoadingSummary(false);
      }
    };

    void loadSummary();
  }, [filters, snackbar]);

  const rows = fees?.items || [];

  const columns = useMemo<GridColDef<StudentFeeItem>[]>(
    () => [
      {
        field: "feeNumber",
        headerName: "Fee No",
        minWidth: 220,
        flex: 1,
        renderCell: ({ row }: GridRenderCellParams<StudentFeeItem>) =>
          row.feeNumber ?? row.id,
      },
      {
        field: "student",
        headerName: "Student",
        minWidth: 220,
        flex: 1,
        renderCell: ({ row }: GridRenderCellParams<StudentFeeItem>) =>
          row.student ? `${row.student.code} - ${row.student.fullName}` : row.studentId,
      },
      {
        field: "class",
        headerName: "Class",
        minWidth: 220,
        flex: 1,
        renderCell: ({ row }: GridRenderCellParams<StudentFeeItem>) =>
          row.class ? `${row.class.code} - ${row.class.name}` : row.classId,
      },
      { field: "month", headerName: "Billing Month", width: 130 },
      {
        field: "amount",
        headerName: "Amount",
        width: 130,
        align: "right",
        headerAlign: "right",
        renderCell: ({ row }: GridRenderCellParams<StudentFeeItem>) =>
          formatCurrency(row.amount),
      },
      {
        field: "discount",
        headerName: "Discount",
        width: 130,
        align: "right",
        headerAlign: "right",
        renderCell: ({ row }: GridRenderCellParams<StudentFeeItem>) =>
          formatCurrency(row.discount),
      },
      {
        field: "finalAmount",
        headerName: "Final Amount",
        width: 140,
        align: "right",
        headerAlign: "right",
        renderCell: ({ row }: GridRenderCellParams<StudentFeeItem>) =>
          formatCurrency(row.finalAmount),
      },
      {
        field: "paidAmount",
        headerName: "Paid Amount",
        width: 140,
        align: "right",
        headerAlign: "right",
        renderCell: ({ row }: GridRenderCellParams<StudentFeeItem>) =>
          formatCurrency(row.paidAmount),
      },
      {
        field: "outstandingAmount",
        headerName: "Outstanding Amount",
        width: 160,
        align: "right",
        headerAlign: "right",
        renderCell: ({ row }: GridRenderCellParams<StudentFeeItem>) =>
          formatCurrency(row.outstandingAmount),
      },
      {
        field: "dueDate",
        headerName: "Due Date",
        width: 130,
        renderCell: ({ row }: GridRenderCellParams<StudentFeeItem>) =>
          formatDate(row.dueDate),
      },
      {
        field: "displayStatus",
        headerName: "Status",
        width: 160,
        align: "center",
        headerAlign: "center",
        renderCell: ({ row }: GridRenderCellParams<StudentFeeItem>) => {
          const status = toTuitionStatus(row);
          return (
            <Chip
              label={getStatusLabel(status)}
              color={getStatusColor(status)}
              size="small"
              variant="outlined"
            />
          );
        },
      },
      {
        field: "actions",
        headerName: "Actions",
        width: 460,
        sortable: false,
        filterable: false,
        renderCell: ({ row }: GridRenderCellParams<StudentFeeItem>) => (
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              startIcon={<VisibilityIcon />}
              onClick={() => router.push(`/admin/student-fees/${row.id}`)}
            >
              View Detail
            </Button>
            <Button
              size="small"
              startIcon={<PaymentIcon />}
              onClick={() => router.push(`/admin/student-fees/${row.id}?focus=payment`)}
            >
              Create Payment
            </Button>
            <Button
              size="small"
              startIcon={<DescriptionIcon />}
              onClick={() => router.push(`/admin/student-fees/${row.id}?focus=temporary-bill`)}
            >
              Generate Temporary Bill
            </Button>
            <Button
              size="small"
              startIcon={<ReceiptLongIcon />}
              onClick={() => router.push(`/admin/student-fees/${row.id}?focus=receipt`)}
            >
              Generate Receipt
            </Button>
          </Stack>
        ),
      },
    ],
    [router],
  );

  return (
    <>
      <Stack spacing={2.5}>
        <Paper
          elevation={0}
          sx={{ p: 2.5, borderRadius: 3, border: "1px solid", borderColor: "divider" }}
        >
          <Stack spacing={2}>
            <Typography variant="h6" fontWeight={700}>
              Quản lý học phí
            </Typography>
            <Stack
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(5, 1fr)" },
                gap: 1.5,
              }}
            >
              <Card sx={{ p: 1.5 }}>
                <Typography variant="caption" color="text.secondary">
                  Total Revenue
                </Typography>
                <Typography variant="h6">
                  {loadingSummary ? "..." : formatCurrency(summary?.totalRevenue || 0)}
                </Typography>
              </Card>
              <Card sx={{ p: 1.5 }}>
                <Typography variant="caption" color="text.secondary">
                  Paid Revenue
                </Typography>
                <Typography variant="h6">
                  {loadingSummary ? "..." : formatCurrency(summary?.paidRevenue || 0)}
                </Typography>
              </Card>
              <Card sx={{ p: 1.5 }}>
                <Typography variant="caption" color="text.secondary">
                  Outstanding Revenue
                </Typography>
                <Typography variant="h6">
                  {loadingSummary
                    ? "..."
                    : formatCurrency(summary?.outstandingRevenue || 0)}
                </Typography>
              </Card>
              <Card sx={{ p: 1.5 }}>
                <Typography variant="caption" color="text.secondary">
                  Overdue Revenue
                </Typography>
                <Typography variant="h6" color="error.main">
                  {loadingSummary ? "..." : formatCurrency(summary?.overdueRevenue || 0)}
                </Typography>
              </Card>
              <Card sx={{ p: 1.5 }}>
                <Typography variant="caption" color="text.secondary">
                  Total Students Unpaid
                </Typography>
                <Typography variant="h6">{summary?.totalStudentsUnpaid || 0}</Typography>
              </Card>
            </Stack>
          </Stack>
        </Paper>

        <Paper
          elevation={0}
          sx={{ p: 2.5, borderRadius: 3, border: "1px solid", borderColor: "divider" }}
        >
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <MasterSelectField
              label="Student"
              value={selectedStudent}
              onOpen={studentDialog.onOpen}
              size="small"
            />
            <MasterSelectField
              label="Class"
              value={selectedClass}
              onOpen={classDialog.onOpen}
              size="small"
            />
            <DatePicker
              label="Billing Month"
              views={["year", "month"]}
              format="YYYY-MM"
              value={monthFilter ? dayjs(monthFilter) : null}
              onChange={(value: Dayjs | null) => {
                setMonthFilter(value ? value.format("YYYY-MM") : "");
                setPageNumber(1);
              }}
              slotProps={{ textField: { size: "small", fullWidth: true } }}
            />
            <Box sx={{ minWidth: 180 }}>
              <Typography variant="caption" color="text.secondary">
                Status
              </Typography>
              <Box
                component="select"
                value={statusFilter}
                onChange={(event: React.ChangeEvent<HTMLSelectElement>) => {
                  setStatusFilter(event.target.value);
                  setPageNumber(1);
                }}
                style={{
                  width: "100%",
                  height: 40,
                  borderRadius: 8,
                  border: "1px solid #d0d5dd",
                  padding: "0 12px",
                  marginTop: 4,
                }}
              >
                {statusOptions.map((option) => (
                  <option value={option.value} key={option.value}>
                    {option.label}
                  </option>
                ))}
              </Box>
            </Box>
            <Box sx={{ minWidth: 140 }}>
              <Typography variant="caption" color="text.secondary">
                Overdue
              </Typography>
              <Box
                component="select"
                value={overdueFilter}
                onChange={(event: React.ChangeEvent<HTMLSelectElement>) => {
                  setOverdueFilter(event.target.value);
                  setPageNumber(1);
                }}
                style={{
                  width: "100%",
                  height: 40,
                  borderRadius: 8,
                  border: "1px solid #d0d5dd",
                  padding: "0 12px",
                  marginTop: 4,
                }}
              >
                <option value="">Tất cả</option>
                <option value="true">Quá hạn</option>
                <option value="false">Không quá hạn</option>
              </Box>
            </Box>
            <Button
              variant="outlined"
              onClick={() => {
                setSelectedStudent(null);
                setSelectedClass(null);
                setStatusFilter("");
                setMonthFilter("");
                setOverdueFilter("");
                setPageNumber(1);
                void refresh();
              }}
            >
              Làm mới
            </Button>
          </Stack>
        </Paper>

        <Paper
          elevation={0}
          sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", overflow: "hidden" }}
        >
          {error ? (
            <Box p={3}>
              <Alert severity="error">{error}</Alert>
            </Box>
          ) : !isLoading && rows.length === 0 ? (
            <EmptyState
              title="Chưa có khoản học phí"
              description="Không tìm thấy dữ liệu phù hợp với bộ lọc hiện tại."
            />
          ) : (
            <BaseTable
              rows={rows}
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

      <StudentSelectDialog
        open={studentDialog.open}
        onClose={studentDialog.onClose}
        onSelect={(item) => {
          setSelectedStudent({ id: item.id, code: item.code, name: item.fullName });
          setPageNumber(1);
          studentDialog.onClose();
        }}
      />
      <ClassSelectDialog
        open={classDialog.open}
        onClose={classDialog.onClose}
        onSelect={(item) => {
          setSelectedClass({ id: item.id, code: item.code, name: item.name });
          setPageNumber(1);
          classDialog.onClose();
        }}
      />

      {snackbar.Snackbar}
    </>
  );
}
