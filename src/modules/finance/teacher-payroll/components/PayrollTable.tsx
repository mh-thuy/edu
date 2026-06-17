"use client";

import { useMemo, type ReactElement } from "react";
import { Box, Chip, type ChipProps } from "@mui/material";
import {
  GridActionsCellItem,
  type GridColDef,
  type GridRenderCellParams,
} from "@mui/x-data-grid";
import VisibilityIcon from "@mui/icons-material/Visibility";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PaymentIcon from "@mui/icons-material/Payment";
import { BaseTable } from "@/components/BaseTable";
import {
  PayrollStatus,
  type TeacherPayrollDto,
} from "@/modules/payroll/services/payroll.types";
import { formatCurrency } from "@/modules/finance/teacher-payroll/payroll.types";

interface PayrollTableProps {
  rows: TeacherPayrollDto[];
  totalRows: number;
  isLoading: boolean;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onView: (payroll: TeacherPayrollDto) => void;
  onApprove: (id: string) => void;
  onMarkPaid: (id: string) => void;
  approvingPayrollId?: string | null;
  payingPayrollId?: string | null;
}

const statusLabelMap: Record<PayrollStatus, string> = {
  [PayrollStatus.DRAFT]: "Draft",
  [PayrollStatus.APPROVED]: "Approved",
  [PayrollStatus.PAID]: "Paid",
};

const statusColorMap: Record<PayrollStatus, NonNullable<ChipProps["color"]>> = {
  [PayrollStatus.DRAFT]: "warning",
  [PayrollStatus.APPROVED]: "info",
  [PayrollStatus.PAID]: "success",
};

function renderAmountCell(
  value: number,
  tone: "positive" | "negative" | "neutral",
): ReactElement {
  const color =
    tone === "positive"
      ? "success.main"
      : tone === "negative"
        ? "error.main"
        : "text.primary";

  return (
    <Box sx={{ fontWeight: 600, color, width: "100%", textAlign: "right" }}>
      {formatCurrency(value)}
    </Box>
  );
}

export function PayrollTable({
  rows,
  totalRows,
  isLoading,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onView,
  onApprove,
  onMarkPaid,
  approvingPayrollId,
  payingPayrollId,
}: PayrollTableProps): ReactElement {
  const columns: GridColDef<TeacherPayrollDto>[] = useMemo(
    () => [
      {
        field: "id",
        headerName: "Code",
        width: 120,
        renderCell: ({ row }: GridRenderCellParams<TeacherPayrollDto>) =>
          row.id.slice(0, 8).toUpperCase(),
      },
      {
        field: "teacher",
        headerName: "Teacher",
        minWidth: 220,
        flex: 1,
        valueGetter: (_value, row) =>
          row.teacher?.user?.fullName
            ? `${row.teacher.user.fullName} (${row.teacher.code})`
            : (row.teacher?.code ?? row.teacherId),
      },
      {
        field: "month",
        headerName: "Month",
        width: 120,
      },
      {
        field: "totalRevenue",
        headerName: "Revenue",
        width: 170,
        align: "right",
        headerAlign: "right",
        renderCell: ({ row }: GridRenderCellParams<TeacherPayrollDto>) =>
          renderAmountCell(row.totalRevenue, "positive"),
      },
      {
        field: "centerFee",
        headerName: "Center Fee",
        width: 170,
        align: "right",
        headerAlign: "right",
        renderCell: ({ row }: GridRenderCellParams<TeacherPayrollDto>) =>
          renderAmountCell(row.centerFee, "negative"),
      },
      {
        field: "salaryAmount",
        headerName: "Salary",
        width: 170,
        align: "right",
        headerAlign: "right",
        renderCell: ({ row }: GridRenderCellParams<TeacherPayrollDto>) =>
          renderAmountCell(row.salaryAmount, "neutral"),
      },
      {
        field: "status",
        headerName: "Status",
        width: 130,
        align: "center",
        headerAlign: "center",
        renderCell: ({ value }) => {
          const status = value as PayrollStatus;
          return (
            <Box
              sx={{
                width: "100%",
                display: "flex",
                justifyContent: "center",
              }}
            >
              <Chip
                label={statusLabelMap[status] ?? status}
                color={statusColorMap[status] ?? "default"}
                size="small"
                sx={{ minWidth: 90, fontWeight: 600 }}
              />
            </Box>
          );
        },
      },
      {
        field: "actions",
        type: "actions",
        width: 120,
        getActions: ({ row }) => {
          const actions = [
            <GridActionsCellItem
              key="view"
              icon={<VisibilityIcon />}
              label="View"
              onClick={() => onView(row)}
            />,
          ];

          if (row.status === PayrollStatus.DRAFT) {
            actions.push(
              <GridActionsCellItem
                key="approve"
                icon={<CheckCircleIcon />}
                label="Approve"
                onClick={() => onApprove(row.id)}
                disabled={
                  approvingPayrollId === row.id || Boolean(payingPayrollId)
                }
              />,
            );
          }

          if (row.status === PayrollStatus.APPROVED) {
            actions.push(
              <GridActionsCellItem
                key="mark-paid"
                icon={<PaymentIcon />}
                label="Mark Paid"
                onClick={() => onMarkPaid(row.id)}
                disabled={
                  payingPayrollId === row.id || Boolean(approvingPayrollId)
                }
              />,
            );
          }

          return actions;
        },
      },
    ],
    [approvingPayrollId, onApprove, onMarkPaid, onView, payingPayrollId],
  );

  return (
    <BaseTable
      rows={rows}
      columns={columns}
      isLoading={isLoading}
      totalRows={totalRows}
      page={page}
      pageSize={pageSize}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
    />
  );
}
