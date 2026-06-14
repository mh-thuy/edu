"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useState } from "react";
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Stack,
  Skeleton,
  Alert,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import PaymentIcon from "@mui/icons-material/Payment";
import GroupIcon from "@mui/icons-material/Group";
import ReceiptIcon from "@mui/icons-material/Receipt";
import AssignmentIcon from "@mui/icons-material/Assignment";


interface DashboardStats {
  totalRevenue: number;
  totalDebt: number;
  totalCollected: number;
  totalPayroll: number;
  activeClasses: number;
}

interface StatCardProps {
  icon: React.ReactNode;
  title: string;
  value: string | number;
  subtitle?: string;
  loading?: boolean;
  color?: string;
}

function StatCard({
  icon,
  title,
  value,
  subtitle,
  loading,
  color = "primary",
}: StatCardProps) {
  return (
    <Card>
      <CardContent>
        <Stack direction="row" spacing={2} alignItems="flex-start">
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 56,
              height: 56,
              borderRadius: 2,
              backgroundColor: `${color}.light`,
              color: `${color}.main`,
            }}
          >
            {icon}
          </Box>
          <Box flex={1}>
            <Typography variant="caption" color="text.secondary">
              {title}
            </Typography>
            {loading ? (
              <Skeleton width="80%" height={32} />
            ) : (
              <Typography variant="h6" fontWeight="bold">
                {typeof value === "number"
                  ? value.toLocaleString()
                  : value}
              </Typography>
            )}
            {subtitle && (
              <Typography variant="caption" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function AdminPage() {
  const { t } = useTranslation("dashboard");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadStats = async () => {
      try {
        setLoading(true);
        // Load revenue
        const paymentsRes = await fetch("/api/payments");
        const payments = await paymentsRes.json();

        // Load fees for debt
        const feesRes = await fetch("/api/student-fees");
        const fees = await feesRes.json();

        // Load payroll
        const payrollRes = await fetch("/api/teacher-payroll");
        const payrolls = await payrollRes.json();

        // Load classes
        const classesRes = await fetch("/api/classes");
        const classes = await classesRes.json();

        // Calculate totals
        const totalRevenue =
          payments.data?.reduce(
            (sum: number, p: any) => sum + (p.amount || 0),
            0
          ) || 0;

        const totalDebt =
          fees.data?.reduce(
            (sum: number, f: any) => sum + (f.outstanding || 0),
            0
          ) || 0;

        const totalCollected =
          fees.data
            ?.filter((f: any) => f.status === "paid")
            .reduce(
              (sum: number, f: any) => sum + (f.amount || 0),
              0
            ) || 0;

        const totalPayroll =
          payrolls.data?.reduce(
            (sum: number, p: any) => sum + (p.salaryAmount || 0),
            0
          ) || 0;

        const activeClasses = classes.data?.length || 0;

        setStats({
          totalRevenue,
          totalDebt,
          totalCollected,
          totalPayroll,
          activeClasses,
        });
      } catch {
        setError(t("errorLoadingData"));
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, [t]);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box mb={4}>
        <Typography variant="h4" component="h1" gutterBottom>
          {t("adminDashboard")}
        </Typography>
        <Typography color="text.secondary">
          {t("financialAndActivityOverview")}
        </Typography>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            sm: "1fr 1fr",
            md: "1fr 1fr 1fr",
          },
          gap: 3,
          mb: 4,
        }}
      >
        {/* Financial Stats */}
        <Box>
          <StatCard
            icon={<TrendingUpIcon />}
            title={t("totalTuition")}
            value={stats?.totalRevenue ? `${(stats.totalRevenue / 1000000).toFixed(1)}M` : "0"}
            subtitle={t("allPayments")}
            loading={loading}
            color="success"
          />
        </Box>

        <Box>
          <StatCard
            icon={<PaymentIcon />}
            title={t("totalStudentDebt")}
            value={stats?.totalDebt ? `${(stats.totalDebt / 1000000).toFixed(1)}M` : "0"}
            subtitle={t("unpaid")}
            loading={loading}
            color="error"
          />
        </Box>

        <Box>
          <StatCard
            icon={<ReceiptIcon />}
            title={t("totalCollected")}
            value={stats?.totalCollected ? `${(stats.totalCollected / 1000000).toFixed(1)}M` : "0"}
            subtitle={t("paidInvoices")}
            loading={loading}
            color="info"
          />
        </Box>

        <Box>
          <StatCard
            icon={<AssignmentIcon />}
            title={t("teacherPayroll")}
            value={stats?.totalPayroll ? `${(stats.totalPayroll / 1000000).toFixed(1)}M` : "0"}
            subtitle={t("totalExpended")}
            loading={loading}
            color="warning"
          />
        </Box>

        <Box>
          <StatCard
            icon={<GroupIcon />}
            title={t("activeClasses")}
            value={stats?.activeClasses || 0}
            subtitle={t("classesOpened")}
            loading={loading}
            color="primary"
          />
        </Box>

        {/* Quick Links */}
        <Box sx={{ gridColumn: "1 / -1" }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {t("quickLinks")}
              </Typography>
              <Stack
                direction="row"
                spacing={1}
                flexWrap="wrap"
                useFlexGap
              >
                <Typography variant="caption" color="text.secondary" sx={{flex: '1 0 auto'}}>
                  {t("manage")}:{" "}
                  <a href="/admin/student-fees" style={{ color: "#1976d2" }}>
                    {t("invoices")}
                  </a>
                  {" | "}
                  <a href="/admin/payments" style={{ color: "#1976d2" }}>
                    {t("payments")}
                  </a>
                  {" | "}
                  <a href="/admin/teacher-payroll" style={{ color: "#1976d2" }}>
                    {t("salary")}
                  </a>
                  {" | "}
                  <a href="/admin/reports" style={{ color: "#1976d2" }}>
                    {t("reports")}
                  </a>
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Container>
  );
}



