"use client";

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
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import PaymentIcon from "@mui/icons-material/Payment";
import GroupIcon from "@mui/icons-material/Group";
import ReceiptIcon from "@mui/icons-material/Receipt";
import AssignmentIcon from "@mui/icons-material/Assignment";
import { unwrapApiResponse } from "@/lib/api-client";
import Link from "next/link";

interface DashboardStats {
  totalFeeAmount: number;
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
                {typeof value === "number" ? value.toLocaleString() : value}
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
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadStats = async () => {
      try {
        setLoading(true);
        const statsRes = await fetch("/api/dashboard/stats");
        const result = await unwrapApiResponse<DashboardStats>(statsRes);
        setStats(result);
      } catch {
        setError("Lỗi khi tải dữ liệu");
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, []);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box mb={4}>
        <Typography variant="h4" component="h1" gutterBottom>
          Trang chủ quản lý
        </Typography>
        <Typography color="text.secondary">
          Tổng quan thông tin tài chính và hoạt động
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
            title="Tổng doanh thu"
            value={
              stats?.totalRevenue
                ? `${(stats.totalRevenue / 1000000).toFixed(1)}M`
                : "0"
            }
            subtitle="Tổng thanh toán đã thu"
            loading={loading}
            color="success"
          />
        </Box>

        <Box>
          <StatCard
            icon={<PaymentIcon />}
            title="Nợ học phí"
            value={
              stats?.totalDebt
                ? `${(stats.totalDebt / 1000000).toFixed(1)}M`
                : "0"
            }
            subtitle="Chưa thanh toán"
            loading={loading}
            color="error"
          />
        </Box>

        <Box>
          <StatCard
            icon={<ReceiptIcon />}
            title="Đã thu"
            value={
              stats?.totalFeeAmount
                ? `${(stats.totalFeeAmount / 1000000).toFixed(1)}M`
                : "0"
            }
            subtitle="Tổng học phí sau giảm giá"
            loading={loading}
            color="info"
          />
        </Box>

        <Box>
          <StatCard
            icon={<AssignmentIcon />}
            title="Lương giáo viên"
            value={
              stats?.totalPayroll
                ? `${(stats.totalPayroll / 1000000).toFixed(1)}M`
                : "0"
            }
            subtitle="Tổng chi trả"
            loading={loading}
            color="warning"
          />
        </Box>

        <Box>
          <StatCard
            icon={<GroupIcon />}
            title="Lớp hoạt động"
            value={stats?.activeClasses || 0}
            subtitle="Số lớp đang mở"
            loading={loading}
            color="primary"
          />
        </Box>

        {/* Quick Links */}
        <Box sx={{ gridColumn: "1 / -1" }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Mục nhanh
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ flex: "1 0 auto" }}
                >
                  Quản lý:{" "}
                  <Link href="/admin/student-fees" style={{ color: "#1976d2" }}>
                    Hóa đơn
                  </Link>
                  {" | "}
                  <Link href="/admin/payments" style={{ color: "#1976d2" }}>
                    Thanh toán
                  </Link>
                  {" | "}
                  <Link href="/admin/teacher-payroll" style={{ color: "#1976d2" }}>
                    Lương
                  </Link>
                  {" | "}
                  <Link href="/admin/reports" style={{ color: "#1976d2" }}>
                    Báo cáo
                  </Link>
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Container>
  );
}
