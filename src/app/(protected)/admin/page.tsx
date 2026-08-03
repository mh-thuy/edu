"use client";

import { useCallback, useEffect, useState } from "react";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import AddCardIcon from "@mui/icons-material/AddCard";
import GroupIcon from "@mui/icons-material/Group";
import PaymentIcon from "@mui/icons-material/Payment";
import ReceiptIcon from "@mui/icons-material/Receipt";
import SchoolIcon from "@mui/icons-material/School";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { Alert, Box, Button, Card, CardContent, Container, Skeleton, Stack, TextField, Typography } from "@mui/material";
import Link from "next/link";
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
  unmatchedTransactions: number;
}

const money = (value: number) => `${new Intl.NumberFormat("vi-VN").format(Number(value))} VND`;

function StatCard({ icon, title, value, subtitle, loading, color = "primary" }: { icon: React.ReactNode; title: string; value: string; subtitle: string; loading: boolean; color?: string }) {
  return <Card><CardContent><Stack direction="row" spacing={2} alignItems="flex-start"><Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", width: 48, height: 48, borderRadius: 2, bgcolor: `${color}.light`, color: `${color}.main` }}>{icon}</Box><Box flex={1}><Typography variant="caption" color="text.secondary">{title}</Typography>{loading ? <Skeleton width="80%" height={32} /> : <Typography variant="h6" fontWeight="bold">{value}</Typography>}<Typography variant="caption" color="text.secondary">{subtitle}</Typography></Box></Stack></CardContent></Card>;
}

function QuickLink({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  return <Button component={Link} href={href} variant="outlined" startIcon={icon}>{label}</Button>;
}

export default function AdminPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      const response = await fetch(`/api/dashboard/stats?${params}`);
      if (!response.ok) throw new Error("Không thể tải dữ liệu dashboard");
      setStats(await unwrapApiResponse<DashboardStats>(response));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể tải dữ liệu dashboard");
    } finally { setLoading(false); }
  }, [dateFrom, dateTo]);

  useEffect(() => { void loadStats(); }, [loadStats]);

  return <Container maxWidth="xl" sx={{ py: 4 }}>
    <Stack spacing={3}>
      <Box><Typography variant="h4" component="h1" gutterBottom>Dashboard quản lý</Typography><Typography color="text.secondary">Tổng quan tài chính, học phí và các công việc cần xử lý.</Typography></Box>
      <Card><CardContent><Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ xs: "stretch", md: "center" }}><Typography fontWeight={700} sx={{ mr: "auto" }}>Bộ lọc doanh thu</Typography><TextField size="small" type="date" label="Từ ngày" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} InputLabelProps={{ shrink: true }} /><TextField size="small" type="date" label="Đến ngày" value={dateTo} onChange={(event) => setDateTo(event.target.value)} InputLabelProps={{ shrink: true }} /><Button variant="contained" onClick={() => void loadStats()}>Áp dụng</Button><Button variant="outlined" onClick={() => { setDateFrom(""); setDateTo(""); }}>Xóa lọc</Button></Stack></CardContent></Card>
      {error && <Alert severity="error">{error}</Alert>}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "repeat(4, 1fr)" }, gap: 2 }}>
        <StatCard icon={<TrendingUpIcon />} title="Đã thu" value={money(stats?.totalCollected || 0)} subtitle="Payment thành công" loading={loading} color="success" />
        <StatCard icon={<PaymentIcon />} title="Còn nợ" value={money(stats?.totalDebt || 0)} subtitle="Chưa thanh toán / quá hạn" loading={loading} color="error" />
        <StatCard icon={<ReceiptIcon />} title="Tổng phải thu" value={money(stats?.totalFeeAmount || 0)} subtitle="Không gồm miễn/hủy" loading={loading} color="info" />
        <StatCard icon={<SchoolIcon />} title="Lớp hoạt động" value={String(stats?.activeClasses || 0)} subtitle="Số lớp đang mở" loading={loading} color="primary" />
        <StatCard icon={<GroupIcon />} title="Học viên hoạt động" value={String(stats?.activeStudents || 0)} subtitle="Đang theo học" loading={loading} color="primary" />
        <StatCard icon={<WarningAmberIcon />} title="Học phí quá hạn" value={String(stats?.overdueFees || 0)} subtitle="Khoản cần nhắc thu" loading={loading} color="warning" />
        <StatCard icon={<AccountBalanceWalletIcon />} title="Batch chờ đối soát" value={String(stats?.pendingBatches || 0)} subtitle="Chuyển khoản đang chờ" loading={loading} color="warning" />
        <StatCard icon={<AccountBalanceIcon />} title="Giao dịch chưa khớp" value={String(stats?.unmatchedTransactions || 0)} subtitle="Cần kiểm tra ngân hàng" loading={loading} color="error" />
      </Box>
      <Card><CardContent><Typography variant="h6" gutterBottom>Công việc cần xử lý</Typography><Stack direction={{ xs: "column", sm: "row" }} spacing={1} flexWrap="wrap" useFlexGap><QuickLink href="/admin/bank-reconciliation" label={`Đối soát ngân hàng (${stats?.unmatchedTransactions || 0})`} icon={<AccountBalanceIcon />} /><QuickLink href="/admin/tuition-fees/payment-history" label={`Batch chờ xử lý (${stats?.pendingBatches || 0})`} icon={<PaymentIcon />} /><QuickLink href="/admin/tuition-fees" label={`Học phí quá hạn (${stats?.overdueFees || 0})`} icon={<WarningAmberIcon />} /></Stack></CardContent></Card>
      <Card><CardContent><Typography variant="h6" gutterBottom>Thao tác nhanh</Typography><Stack direction={{ xs: "column", sm: "row" }} spacing={1} flexWrap="wrap" useFlexGap><QuickLink href="/admin/tuition-fees/new" label="Tạo học phí" icon={<AddCardIcon />} /><QuickLink href="/admin/tuition-fees/payment" label="Thu học phí" icon={<PaymentIcon />} /><QuickLink href="/admin/bank-reconciliation" label="Import sao kê" icon={<AccountBalanceIcon />} /><QuickLink href="/admin/receipts" label="Xem biên lai" icon={<ReceiptIcon />} /></Stack></CardContent></Card>
    </Stack>
  </Container>;
}
