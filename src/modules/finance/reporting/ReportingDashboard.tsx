"use client";

/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */

import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  Card,
  Stack,
  TextField,
  Typography,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tabs,
  Tab,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";

import { useSnackbar } from "@/hooks/useSnackbar";

interface ReportData {
  totalRevenue: number;
  paymentCount: number;
  methodSummary: Record<string, number>;
  payments?: Array<{
    id: string;
    amount: number;
    method: string;
    paymentDate: string;
  }>;
}

interface DebtReportData {
  totalDebt: number;
  unpaidCount: number;
  partialCount: number;
  overdueCount: number;
  fees?: Array<{
    id: string;
    studentId: string;
    amount: number;
    outstanding: number;
    status: string;
  }>;
}

interface TeacherReportData {
  teacherId: string;
  totalSalary: number;
  totalRevenue: number;
  paidCount: number;
  approvedCount: number;
  payrolls?: Array<{
    id: string;
    month: string;
    salaryAmount: number;
    status: string;
  }>;
}

export function ReportingDashboard() {
  const snackbar = useSnackbar();
  const [activeTab, setActiveTab] = useState(0);
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [loading, setLoading] = useState(false);
  const [revenueReport, setRevenueReport] = useState<ReportData | null>(null);
  const [debtReport, setDebtReport] = useState<DebtReportData | null>(null);
  const [teacherReports, setTeacherReports] = useState<TeacherReportData[]>([]);

  // Initialize date range to current month
  useEffect(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    setDateStart(firstDay.toISOString().split("T")[0] || "");
    setDateEnd(lastDay.toISOString().split("T")[0] || "");
  }, []);

  const loadRevenueReport = async () => {
    if (!dateStart || !dateEnd) {
      snackbar.showError("Vui lòng chọn khoảng thời gian");
      return;
    }

    try {
      setLoading(true);
      const query = new URLSearchParams({
        startDate: dateStart,
        endDate: dateEnd,
      }).toString();
      const response = await fetch(`/api/payments?${query}`);
      if (!response.ok) throw new Error("Failed to load revenue report");
      const result = await response.json();
      setRevenueReport(result);
    } catch (err) {
      snackbar.showError("Tải báo cáo doanh thu thất bại");
    } finally {
      setLoading(false);
    }
  };

  const loadDebtReport = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/student-fees?status=unpaid,partial");
      if (!response.ok) throw new Error("Failed to load debt report");
      const result = await response.json();
      // Calculate summary
      const debtData: DebtReportData = {
        totalDebt: result.data.reduce(
          (sum: number, fee: any) => sum + (fee.outstanding || 0),
          0
        ),
        unpaidCount: result.data.filter(
          (fee: any) => fee.status === "unpaid"
        ).length,
        partialCount: result.data.filter(
          (fee: any) => fee.status === "partial"
        ).length,
        overdueCount: result.data.filter(
          (fee: any) =>
            new Date(fee.dueDate) < new Date() && fee.status !== "paid"
        ).length,
        fees: result.data,
      };
      setDebtReport(debtData);
    } catch (err) {
      snackbar.showError("Tải báo cáo nợ thất bại");
    } finally {
      setLoading(false);
    }
  };

  const loadTeacherReport = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/teacher-payroll");
      if (!response.ok) throw new Error("Failed to load teacher report");
      const result = await response.json();
      // Group by teacher
      const grouped = new Map<string, any>();
      (result.data || []).forEach((payroll: any) => {
        const existing = grouped.get(payroll.teacherId) || {
          teacherId: payroll.teacherId,
          totalSalary: 0,
          totalRevenue: 0,
          paidCount: 0,
          approvedCount: 0,
          payrolls: [],
        };
        existing.totalSalary += payroll.salaryAmount;
        existing.totalRevenue += payroll.totalRevenue;
        if (payroll.status === "paid") existing.paidCount++;
        if (payroll.status === "approved") existing.approvedCount++;
        (existing.payrolls as any[]).push(payroll);
        grouped.set(payroll.teacherId, existing);
      });
      setTeacherReports(Array.from(grouped.values()));
    } catch (err) {
      snackbar.showError("Tải báo cáo giáo viên thất bại");
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = (data: any[], filename: string) => {
    const csv = [
      Object.keys(data[0]).join(","),
      ...data.map((row) =>
        Object.values(row)
          .map((val) => `"${val}"`)
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
  };

  return (
    <Card>
      <Box p={2}>
        {/* Date Filters */}
        <Stack direction="row" spacing={2} mb={3}>
          <TextField
            type="date"
            label="Từ ngày"
            value={dateStart}
            onChange={(e) => setDateStart(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 150 }}
          />
          <TextField
            type="date"
            label="Đến ngày"
            value={dateEnd}
            onChange={(e) => setDateEnd(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 150 }}
          />
        </Stack>

        {/* Tabs */}
        <Box sx={{ mb: 2 }}>
          <Tabs
            value={activeTab}
            onChange={(e, newValue) => setActiveTab(newValue)}
          >
            <Tab label="Doanh thu" onClick={loadRevenueReport} />
            <Tab label="Nợ học phí" onClick={loadDebtReport} />
            <Tab label="Lương giáo viên" onClick={loadTeacherReport} />
          </Tabs>
        </Box>

        {loading && (
          <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {/* Revenue Report Tab */}
        {activeTab === 0 && revenueReport && (
          <Box>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "1fr 1fr" },
                gap: 2,
                mb: 3,
              }}
            >
              <Box>
                <Card sx={{ p: 2, backgroundColor: "#e3f2fd" }}>
                  <Typography color="text.secondary" variant="caption">
                    Tổng doanh thu
                  </Typography>
                  <Typography variant="h6">
                    {revenueReport.totalRevenue?.toLocaleString()} VND
                  </Typography>
                </Card>
              </Box>
              <Box>
                <Card sx={{ p: 2, backgroundColor: "#f3e5f5" }}>
                  <Typography color="text.secondary" variant="caption">
                    Số giao dịch
                  </Typography>
                  <Typography variant="h6">
                    {revenueReport.paymentCount}
                  </Typography>
                </Card>
              </Box>
            </Box>

            {revenueReport.methodSummary && (
              <Box>
                <Typography variant="subtitle2" mb={2}>
                  Doanh thu theo phương thức
                </Typography>
                <TableContainer component={Paper}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
                        <TableCell>Phương thức</TableCell>
                        <TableCell align="right">Số tiền (VND)</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {Object.entries(revenueReport.methodSummary).map(
                        ([method, amount]) => (
                          <TableRow key={method}>
                            <TableCell>{method}</TableCell>
                            <TableCell align="right">
                              {Number(amount).toLocaleString()}
                            </TableCell>
                          </TableRow>
                        )
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}

            <Button
              startIcon={<DownloadIcon />}
              onClick={() =>
                exportToCSV(
                  revenueReport.payments || [],
                  "revenue-report.csv"
                )
              }
              sx={{ mt: 2 }}
            >
              Xuất CSV
            </Button>
          </Box>
        )}

        {/* Debt Report Tab */}
        {activeTab === 1 && debtReport && (
          <Box>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "1fr 1fr 1fr" },
                gap: 2,
                mb: 3,
              }}
            >
              <Box>
                <Card sx={{ p: 2, backgroundColor: "#ffe0e0" }}>
                  <Typography color="text.secondary" variant="caption">
                    Tổng nợ
                  </Typography>
                  <Typography variant="h6" color="error">
                    {debtReport.totalDebt?.toLocaleString()} VND
                  </Typography>
                </Card>
              </Box>
              <Box>
                <Card sx={{ p: 2, backgroundColor: "#fff3e0" }}>
                  <Typography color="text.secondary" variant="caption">
                    Chưa thanh toán
                  </Typography>
                  <Typography variant="h6">
                    {debtReport.unpaidCount}
                  </Typography>
                </Card>
              </Box>
              <Box>
                <Card sx={{ p: 2, backgroundColor: "#fff9c4" }}>
                  <Typography color="text.secondary" variant="caption">
                    Quá hạn
                  </Typography>
                  <Typography variant="h6">
                    {debtReport.overdueCount}
                  </Typography>
                </Card>
              </Box>
            </Box>

            <Button
              startIcon={<DownloadIcon />}
              onClick={() =>
                exportToCSV(
                  debtReport.fees || [],
                  "debt-report.csv"
                )
              }
              sx={{ mt: 2 }}
            >
              Xuất CSV
            </Button>
          </Box>
        )}

        {/* Teacher Report Tab */}
        {activeTab === 2 && (
          <Box>
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
                    <TableCell>Giáo viên</TableCell>
                    <TableCell align="right">Tổng lương</TableCell>
                    <TableCell align="right">Tổng doanh thu</TableCell>
                    <TableCell align="right">Đã thanh toán</TableCell>
                    <TableCell align="right">Chờ duyệt</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {teacherReports.map((report) => (
                    <TableRow key={report.teacherId}>
                      <TableCell>{report.teacherId}</TableCell>
                      <TableCell align="right">
                        {report.totalSalary.toLocaleString()} VND
                      </TableCell>
                      <TableCell align="right">
                        {report.totalRevenue.toLocaleString()} VND
                      </TableCell>
                      <TableCell align="right">
                        {report.paidCount}
                      </TableCell>
                      <TableCell align="right">
                        {report.approvedCount}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <Button
              startIcon={<DownloadIcon />}
              onClick={() =>
                exportToCSV(
                  teacherReports.map((r) => ({
                    "Giáo viên": r.teacherId,
                    "Tổng lương": r.totalSalary,
                    "Tổng doanh thu": r.totalRevenue,
                    "Đã thanh toán": r.paidCount,
                    "Chờ duyệt": r.approvedCount,
                  })),
                  "teacher-report.csv"
                )
              }
              sx={{ mt: 2 }}
            >
              Xuất CSV
            </Button>
          </Box>
        )}
      </Box>
    </Card>
  );
}
