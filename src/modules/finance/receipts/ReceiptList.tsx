"use client";

import { useEffect, useState } from "react";
import { Alert, Box, Button, CircularProgress, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableHead, TablePagination, TableRow, TextField, Typography } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import type { RoleCode } from "@/constants/roles";
import { extractApiErrorMessage, unwrapApiResponse } from "@/lib/api-client";
import { ReceiptDetailDialog } from "./ReceiptDetailDialog";

type Receipt = { id: string; receiptNo: string; issuedAt: string; amount: number; status: "ACTIVE" | "CANCELLED"; payment: { paymentNo: string; paymentMethod: string; tuitionFee: { feeNo: string; student: { code: string; fullName: string }; class: { name: string } } } };
type ReceiptResult = { items: Receipt[]; total: number; page: number; pageSize: number; pages: number };
const money = (value: number) => `${new Intl.NumberFormat("vi-VN").format(value)} VND`;
const statusLabels = { ACTIVE: "Đang hiệu lực", CANCELLED: "Đã hủy" } as const;

export function ReceiptList({ role }: { role: RoleCode }) {
  void role;
  const [items, setItems] = useState<Receipt[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({ page: String(page + 1), pageSize: String(pageSize) });
      if (search.trim()) params.set("search", search.trim());
      if (status) params.set("status", status);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      void fetch(`/api/receipts?${params}`, { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không thể tải biên lai"));
          return unwrapApiResponse<ReceiptResult>(response);
        })
        .then((result) => { setItems(result.items); setTotal(result.total); })
        .catch((reason: unknown) => { if ((reason as { name?: string })?.name !== "AbortError") setError(reason instanceof Error ? reason.message : "Không thể tải biên lai"); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [page, pageSize, search, status, dateFrom, dateTo, refreshKey]);

  function resetFilters() {
    setSearch("");
    setStatus("");
    setDateFrom("");
    setDateTo("");
    setPage(0);
  }

  return (
    <Stack spacing={2.5}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", md: "center" }} gap={1}>
        <BoxTitle />
        <Button variant="outlined" startIcon={<RefreshOutlinedIcon />} onClick={() => setRefreshKey((value) => value + 1)}>
          Làm mới
        </Button>
      </Stack>
      <Paper sx={{ p: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} flexWrap="wrap" useFlexGap>
          <TextField value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} placeholder="Tìm số biên lai, mã học viên, họ tên hoặc mã học phí" InputProps={{ startAdornment: <SearchIcon fontSize="small" sx={{ mr: 1, color: "text.secondary" }} /> }} sx={{ flex: 1 }} />
          <TextField select label="Trạng thái" value={status} onChange={(event) => { setStatus(event.target.value); setPage(0); }} sx={{ minWidth: 180 }}>
            <MenuItem value="">Tất cả trạng thái</MenuItem>
            <MenuItem value="ACTIVE">Đang hiệu lực</MenuItem>
            <MenuItem value="CANCELLED">Đã hủy</MenuItem>
          </TextField>
          <TextField type="date" label="Từ ngày" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); setPage(0); }} InputLabelProps={{ shrink: true }} />
          <TextField type="date" label="Đến ngày" value={dateTo} onChange={(event) => { setDateTo(event.target.value); setPage(0); }} InputLabelProps={{ shrink: true }} />
          <Button variant="text" onClick={resetFilters} disabled={!search && !status && !dateFrom && !dateTo}>Xóa bộ lọc</Button>
        </Stack>
      </Paper>
      {error && <Alert severity="error">{error}</Alert>}
      <Paper sx={{ overflow: "hidden" }}>
        <Table sx={{ minWidth: 820 }}>
          <TableHead><TableRow><TableCell>Số biên lai</TableCell><TableCell>Học viên</TableCell><TableCell>Khoản thu</TableCell><TableCell>Ngày phát hành</TableCell><TableCell>Trạng thái</TableCell><TableCell align="right">Số tiền</TableCell><TableCell /></TableRow></TableHead>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={7}><Stack alignItems="center" sx={{ py: 5 }}><CircularProgress size={28} /><Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Đang tải biên lai...</Typography></Stack></TableCell></TableRow>}
            {!loading && items.map((item) => <TableRow key={item.id} hover><TableCell><Button size="small" onClick={() => setDetailId(item.id)}>{item.receiptNo}</Button></TableCell><TableCell>{item.payment.tuitionFee.student.code} — {item.payment.tuitionFee.student.fullName}</TableCell><TableCell>{item.payment.tuitionFee.feeNo}</TableCell><TableCell>{new Date(item.issuedAt).toLocaleDateString("vi-VN")}</TableCell><TableCell>{statusLabels[item.status]}</TableCell><TableCell align="right">{money(Number(item.amount))}</TableCell><TableCell><Stack direction="row" spacing={0.5}><Button size="small" href={`/api/tuition-receipts/${item.id}/pdf`}>Tải PDF</Button><Button size="small" startIcon={<PrintOutlinedIcon />} href={`/api/tuition-receipts/${item.id}/pdf?inline=1`} target="_blank" rel="noopener noreferrer">In</Button></Stack></TableCell></TableRow>)}
            {!loading && !items.length && <TableRow><TableCell colSpan={7}><Typography sx={{ p: 5 }} textAlign="center" color="text.secondary">Không tìm thấy biên lai phù hợp</Typography></TableCell></TableRow>}
          </TableBody>
        </Table>
        <TablePagination component="div" count={total} page={page} rowsPerPage={pageSize} onPageChange={(_, nextPage) => setPage(nextPage)} onRowsPerPageChange={(event) => { setPageSize(Number(event.target.value)); setPage(0); }} rowsPerPageOptions={[10, 20, 50, 100]} labelRowsPerPage="Số dòng/trang" labelDisplayedRows={({ from, to, count }) => `${from}–${to} trên ${count !== -1 ? count : `hơn ${to}`}`} />
      </Paper>
      {detailId && <ReceiptDetailDialog id={detailId} onClose={() => setDetailId(null)} />}
    </Stack>
  );
}

function BoxTitle() {
  return <Box><Typography variant="h5" fontWeight={700}>Biên lai học phí</Typography><Typography variant="body2" color="text.secondary">Tra cứu, xem chi tiết và tải lại biên lai đã phát hành</Typography></Box>;
}
