"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useCallback, useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from "@mui/material";
import { GridActionsCellItem, GridColDef } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import VisibilityIcon from "@mui/icons-material/Visibility";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PaymentIcon from "@mui/icons-material/Payment";
import { useTranslation } from "react-i18next";

import { BaseTable } from "@/components/BaseTable";
import { useList } from "@/hooks/useList";
import { useSnackbar } from "@/hooks/useSnackbar";

interface PayrollItem {
  id: string;
  classId: string;
  classCode: string;
  studentCount: number;
  revenue: number;
  fee: number;
  salary: number;
}

interface TeacherPayroll {
  id: string;
  teacherId: string;
  month: string;
  totalRevenue: number;
  centerFee: number;
  salaryAmount: number;
  status: "draft" | "approved" | "paid";
  approvedAt?: string;
  paidAt?: string;
  items?: PayrollItem[];
  createdAt: string;
  updatedAt: string;
}

interface Teacher {
  id: string;
  name: string;
  code: string;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case "paid":
      return "success";
    case "approved":
      return "info";
    case "draft":
      return "warning";
    default:
      return "default";
  }
};

const getStatusLabel = (status: string, t: (key: string) => string) => {
  const labels: Record<string, string> = {
    draft: t("finance:draft"),
    approved: t("finance:approved"),
    paid: t("finance:paidStatus"),
  };
  return labels[status] || status;
};

export function PayrollList() {
  const { t } = useTranslation(["finance", "common"]);
  const snackbar = useSnackbar();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loadingTeachers, setLoadingTeachers] = useState(false);
  const [showCalculateDialog, setShowCalculateDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [selectedPayroll, setSelectedPayroll] = useState<TeacherPayroll | null>(
    null
  );
  const [calculateData, setCalculateData] = useState({
    teacherId: "",
    month: new Date().toISOString().slice(0, 7),
  });

  const { data: payrolls, isLoading, error, refresh, page, limit, setPageNumber, setPageSize } = useList<TeacherPayroll>(
    "/api/teacher-payroll"
  );

  // Load teachers for calculation
  React.useEffect(() => {
    const loadTeachers = async () => {
      try {
        setLoadingTeachers(true);
        const response = await fetch("/api/teachers");
        if (!response.ok) throw new Error("Failed to load teachers");
        const result = await response.json();
        setTeachers(result.data || []);
      } catch {
        snackbar.showError("Failed to load teachers");
      } finally {
        setLoadingTeachers(false);
      }
    };
    loadTeachers();
  }, [snackbar]);

  const handleCalculatePayroll = useCallback(async () => {
    if (!calculateData.teacherId) {
      snackbar.showError("Vui lòng chọn giáo viên");
      return;
    }

    try {
      const response = await fetch("/api/teacher-payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(calculateData),
      });
      if (!response.ok) throw new Error("Failed to calculate payroll");
      snackbar.showSuccess("Tính lương thành công");
      setShowCalculateDialog(false);
      setCalculateData({
        teacherId: "",
        month: new Date().toISOString().slice(0, 7),
      });
      refresh();
    } catch {
        snackbar.showError(t("finance:calculatePayrollError"));
      }
    }, [calculateData, refresh, snackbar, t]);
  const handleApprovePayroll = useCallback(
    async (payrollId: string) => {
      if (!confirm(t("finance:confirmApprovePayroll"))) return;

      try {
        const response = await fetch(
          `/api/teacher-payroll/${payrollId}/approve`,
          { method: "POST" }
        );
        if (!response.ok) throw new Error("Failed to approve payroll");
        snackbar.showSuccess(t("finance:approvePayrollSuccess"));
        refresh();
      } catch {
        snackbar.showError(t("finance:approvePayrollError"));
      }
    },
    [refresh, snackbar, t]
  );

  const handleMarkAsPaid = useCallback(
    async (payrollId: string) => {
      if (!confirm(t("finance:confirmMarkAsPaid")))
        return;

      try {
        const response = await fetch(
          `/api/teacher-payroll/${payrollId}/mark-paid`,
          { method: "POST" }
        );
        if (!response.ok) throw new Error("Failed to mark as paid");
        snackbar.showSuccess(t("finance:markPaidSuccess"));
        refresh();
      } catch {
        snackbar.showError(t("finance:markPaidError"));
      }
    },
    [refresh, snackbar, t]
  );

  const columns: GridColDef[] = useMemo(
    () => [
      { field: "id", headerName: "ID", width: 100 },
      {
        field: "teacherId",
        headerName: t("finance:selectTeacher"),
        width: 150,
      },
      {
        field: "month",
        headerName: t("finance:selectMonth"),
        width: 120,
      },
      {
        field: "totalRevenue",
        headerName: t("finance:totalRevenue"),
        width: 150,
        valueGetter: (params: any) => `${(params.row?.totalRevenue || 0).toLocaleString()} VND`,
      },
      {
        field: "centerFee",
        headerName: t("finance:centerFee"),
        width: 150,
        valueGetter: (params: any) => `${(params.row?.centerFee || 0).toLocaleString()} VND`,
      },
      {
        field: "salaryAmount",
        headerName: t("finance:salary"),
        width: 150,
        valueGetter: (params: any) => `${(params.row?.salaryAmount || 0).toLocaleString()} VND`,
      },
      {
        field: "status",
        headerName: t("finance:status"),
        width: 120,
        renderCell: (params) => (
          <Chip
            label={getStatusLabel(params.value, t)}
            size="small"
            color={getStatusColor(params.value) as any}
          />
        ),
      },
      {
        field: "actions",
        type: "actions",
        width: 200,
        getActions: (params) => {
          const payroll = params.row as TeacherPayroll;
          const actions = [
            <GridActionsCellItem
              key="view"
              icon={<VisibilityIcon />}
              label={t("finance:view")}
              onClick={() => {
                setSelectedPayroll(payroll);
                setShowDetailsDialog(true);
              }}
            />,
          ];

          if (payroll.status === "draft") {
            actions.push(
              <GridActionsCellItem
                key="approve"
                icon={<CheckCircleIcon />}
                label={t("finance:approve")}
                onClick={() => handleApprovePayroll(payroll.id)}
              />
            );
          }

          if (payroll.status === "approved") {
            actions.push(
              <GridActionsCellItem
                key="pay"
                icon={<PaymentIcon />}
                label={t("finance:markAsPaid")}
                onClick={() => handleMarkAsPaid(payroll.id)}
              />
            );
          }

          return actions as any[];
        },
      },
    ],
    [handleApprovePayroll, handleMarkAsPaid, t]
  );

  return (
    <>
      <Card>
        <Box p={2}>
          <Stack direction="row" spacing={2} mb={2}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setShowCalculateDialog(true)}
            >
              Tính lương
            </Button>
          </Stack>

          {error && (
            <Typography color="error" mb={2}>
              {error}
            </Typography>
          )}

          <BaseTable
            rows={payrolls?.items || []}
            columns={columns}
            isLoading={isLoading}
            totalRows={payrolls?.total || 0}
            page={page - 1}
            pageSize={limit}
            onPageChange={(newPage) => setPageNumber(newPage + 1)}
            onPageSizeChange={setPageSize}
          />
        </Box>
      </Card>

      {/* Calculate Payroll Dialog */}
      <Dialog
        open={showCalculateDialog}
        onClose={() => setShowCalculateDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t("calculatePayroll")}</DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Stack spacing={2}>
            <TextField
              select
              label={t("selectTeacher")}
              value={calculateData.teacherId}
              onChange={(e) =>
                setCalculateData({
                  ...calculateData,
                  teacherId: e.target.value,
                })
              }
              fullWidth
              disabled={loadingTeachers}
              slotProps={{
                select: {
                  native: true,
                },
              }}
            >
              <option value="">{t("chooseTeacher")}</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.name} ({teacher.code})
                </option>
              ))}
            </TextField>

            <TextField
              type="month"
              label={t("calculatePayrollMonth")}
              value={calculateData.month}
              onChange={(e) =>
                setCalculateData({
                  ...calculateData,
                  month: e.target.value,
                })
              }
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCalculateDialog(false)}>{t("common:cancel")}</Button>
          <Button
            onClick={handleCalculatePayroll}
            variant="contained"
            disabled={!calculateData.teacherId}
          >
            {t("finance:calculate")}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Payroll Details Dialog */}
      {showDetailsDialog && selectedPayroll && (
        <Dialog open maxWidth="md" fullWidth>
          <DialogTitle>
            {t("finance:payrollDetails")} {selectedPayroll.teacherId} ({selectedPayroll.month})
          </DialogTitle>
          <DialogContent sx={{ mt: 2 }}>
            <Stack spacing={2}>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 2,
                }}
              >
                <Typography variant="body2">
                  <strong>{t("finance:status")}:</strong> {getStatusLabel(selectedPayroll.status, t)}
                </Typography>
                <Typography variant="body2">
                  <strong>{t("finance:totalRevenue")}:</strong>{" "}
                  {selectedPayroll.totalRevenue.toLocaleString()} VND
                </Typography>
                <Typography variant="body2">
                  <strong>{t("finance:centerFee")}:</strong>{" "}
                  {selectedPayroll.centerFee.toLocaleString()} VND
                </Typography>
                <Typography variant="body2">
                  <strong>{t("finance:salary")}:</strong>{" "}
                  {selectedPayroll.salaryAmount.toLocaleString()} VND
                </Typography>
              </Box>

              {selectedPayroll.items && selectedPayroll.items.length > 0 && (
                <>
                  <Typography variant="subtitle2" sx={{ mt: 2 }}>
                    {t("finance:breakdownByClass")}
                  </Typography>
                  <TableContainer component={Paper}>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
                          <TableCell>{t("finance:classCode")}</TableCell>
                          <TableCell align="right">{t("finance:studentCount")}</TableCell>
                          <TableCell align="right">{t("finance:revenue")}</TableCell>
                          <TableCell align="right">{t("finance:fee")}</TableCell>
                          <TableCell align="right">{t("finance:salary")}</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {selectedPayroll.items.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>{item.classCode}</TableCell>
                            <TableCell align="right">
                              {item.studentCount}
                            </TableCell>
                            <TableCell align="right">
                              {item.revenue.toLocaleString()} VND
                            </TableCell>
                            <TableCell align="right">
                              {item.fee.toLocaleString()} VND
                            </TableCell>
                            <TableCell align="right">
                              {item.salary.toLocaleString()} VND
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </>
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowDetailsDialog(false)}>{t("common:close")}</Button>
          </DialogActions>
        </Dialog>
      )}
    </>
  );
}
