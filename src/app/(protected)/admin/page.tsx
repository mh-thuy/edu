"use client";

import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import GroupIcon from "@mui/icons-material/Group";
import PaymentIcon from "@mui/icons-material/Payment";
import ReceiptIcon from "@mui/icons-material/Receipt";
import SchoolIcon from "@mui/icons-material/School";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { DatePickerField } from "@/components/shared/forms/DatePickerField";
import { unwrapApiResponse } from "@/lib/api-client";

interface DashboardStats {
  totalFeeAmount: number;
  totalRevenue: number;
  totalDebt: number;
  totalCollected: number;
  activeClasses: number;
  activeStudents: number;
  overdueFees: number;
  pendingBatches: number;
}

type StatCardProps = {
  icon: React.ReactNode;
  title: string;
  value: string;
  subtitle: string;
  loading: boolean;
  color?: "primary" | "success" | "warning" | "error" | "info";
};

const money = (value: number) =>
  `${new Intl.NumberFormat("vi-VN").format(Number(value))} ₫`;

function StatCard({
  icon,
  title,
  value,
  subtitle,
  loading,
  color = "primary",
}: StatCardProps) {
  return (
    <Card sx={{ height: "100%" }}>
      <CardContent sx={{ height: "100%" }}>
        <Stack direction="row" spacing={1.75} alignItems="flex-start">
          <Box
            sx={{
              width: 44,
              height: 44,
              flexShrink: 0,
              borderRadius: 2.5,
              display: "grid",
              placeItems: "center",
              bgcolor: `${color}.light`,
              color: `${color}.main`,
            }}
          >
            {icon}
          </Box>
          <Box minWidth={0} flex={1}>
            <Typography variant="body2" color="text.secondary" noWrap>
              {title}
            </Typography>
            {loading ? (
              <Skeleton width="80%" height={34} />
            ) : (
              <Typography variant="h6" fontWeight={800} noWrap sx={{ mt: 0.25 }}>
                {value}
              </Typography>
            )}
            <Typography variant="caption" color="text.secondary" noWrap>
              {subtitle}
            </Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

function QuickLink({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  return (
    <Button
      component={Link}
      href={href}
      variant="outlined"
      endIcon={<ArrowForwardIcon fontSize="small" />}
      startIcon={icon}
      sx={{ justifyContent: "space-between" }}
    >
      {label}
    </Button>
  );
}

export default function AdminPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      const response = await fetch(`/api/dashboard/stats?${params}`);

      if (!response.ok) throw new Error("Không thể tải dữ liệu dashboard");
      setStats(await unwrapApiResponse<DashboardStats>(response));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Không thể tải dữ liệu dashboard",
      );
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const clearFilters = () => {
    setDateFrom("");
    setDateTo("");
  };

  return (
    <Stack spacing={{ xs: 2.5, md: 3 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        alignItems={{ xs: "stretch", sm: "flex-end" }}
        justifyContent="space-between"
      >
        <Box>
          <Typography variant="h4" component="h1" fontWeight={800} sx={{ mt: 0.25 }}>
            Dashboard
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            Theo dõi tài chính, học phí và công việc cần xử lý.
          </Typography>
        </Box>
      </Stack>

      <Card>
        <CardContent>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1.5}
            alignItems={{ xs: "stretch", md: "center" }}
          >
            <Box sx={{ mr: { md: "auto" } }}>
              <Typography fontWeight={700}>Bộ lọc doanh thu</Typography>
              <Typography variant="caption" color="text.secondary">
                Khoảng thời gian chỉ áp dụng cho số đã thu; công nợ và số lượng là số hiện tại
              </Typography>
            </Box>
            <DatePickerField label="Từ ngày" value={dateFrom} onChange={setDateFrom} textFieldProps={{ size: "small" }} />
            <DatePickerField label="Đến ngày" value={dateTo} onChange={setDateTo} textFieldProps={{ size: "small" }} />
            <Stack direction="row" spacing={1}>
              <Button variant="contained" onClick={() => void loadStats()}>
                Áp dụng
              </Button>
              <Button variant="outlined" onClick={clearFilters} disabled={!dateFrom && !dateTo}>
                Xóa lọc
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {error && <Alert severity="error">{error}</Alert>}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, minmax(0, 1fr))",
            lg: "repeat(4, minmax(0, 1fr))",
          },
          gap: 2,
        }}
      >
        <StatCard icon={<TrendingUpIcon />} title="Đã thu" value={money(stats?.totalCollected ?? 0)} subtitle="Payment thành công" loading={loading} color="success" />
        <StatCard icon={<PaymentIcon />} title="Còn nợ" value={money(stats?.totalDebt ?? 0)} subtitle="Hiện tại · chưa thanh toán / quá hạn" loading={loading} color="error" />
        <StatCard icon={<ReceiptIcon />} title="Tổng phải thu" value={money(stats?.totalFeeAmount ?? 0)} subtitle="Không gồm miễn / hủy" loading={loading} color="info" />
        <StatCard icon={<SchoolIcon />} title="Lớp hoạt động" value={String(stats?.activeClasses ?? 0)} subtitle="Số lớp đang mở" loading={loading} />
        <StatCard icon={<GroupIcon />} title="Học viên hoạt động" value={String(stats?.activeStudents ?? 0)} subtitle="Đang theo học" loading={loading} />
        <StatCard icon={<WarningAmberIcon />} title="Học phí quá hạn" value={String(stats?.overdueFees ?? 0)} subtitle="Khoản cần nhắc thu" loading={loading} color="warning" />
        <StatCard icon={<AccountBalanceWalletIcon />} title="Batch chờ đối soát" value={String(stats?.pendingBatches ?? 0)} subtitle="Chuyển khoản đang chờ" loading={loading} color="warning" />
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "1.15fr 0.85fr" },
          gap: 2,
        }}
      >
        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight={800}>
              Công việc cần xử lý
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
              Truy cập nhanh các nghiệp vụ đang chờ hoàn tất.
            </Typography>
            <Stack spacing={1}>
              <QuickLink href="/admin/bank-reconciliation" label="Đối soát ngân hàng" icon={<AccountBalanceIcon />} />
              <QuickLink href="/admin/tuition-fees/payment-history" label={`Batch chờ xử lý (${stats?.pendingBatches ?? 0})`} icon={<PaymentIcon />} />
              <QuickLink href="/admin/tuition-fees" label={`Học phí quá hạn (${stats?.overdueFees ?? 0})`} icon={<WarningAmberIcon />} />
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight={800}>
              Thao tác nhanh
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
              Bắt đầu một nghiệp vụ thường dùng.
            </Typography>
            <Stack spacing={1}>
              <QuickLink href="/admin/tuition-fees/payment" label="Thu học phí" icon={<PaymentIcon />} />
              <QuickLink href="/admin/bank-reconciliation" label="Import sao kê" icon={<AccountBalanceIcon />} />
              <QuickLink href="/admin/receipts" label="Xem biên lai" icon={<ReceiptIcon />} />
            </Stack>
          </CardContent>
        </Card>
      </Box>
    </Stack>
  );
}
