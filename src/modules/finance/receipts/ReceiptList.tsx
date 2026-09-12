"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Chip,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import FilterAltOutlinedIcon from "@mui/icons-material/FilterAltOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import { extractApiErrorMessage, unwrapApiResponse } from "@/lib/api-client";
import { ReceiptDetailDialog } from "./ReceiptDetailDialog";
import { DatePickerField } from "@/components/shared/forms/DatePickerField";
import { AppTextField } from "@/components/shared/forms/AppTextField";

type Receipt = {
  id: string;
  receiptNo: string;
  issuedAt: string;
  amount: number;
  status: "ACTIVE" | "CANCELLED";
  payment: {
    paymentNo: string;
    paymentMethod: string;
    tuitionFee: {
      feeNo: string;
      student: { code: string; fullName: string };
      class: { name: string };
      items: Array<{
        itemName: string;
        classSubject: { subject: { name: string } } | null;
      }>;
    };
  };
};
type ReceiptResult = {
  items: Receipt[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
};
const money = (value: number) =>
  `${new Intl.NumberFormat("vi-VN").format(value)} ₫`;
const statusLabels = { ACTIVE: "Đang hiệu lực", CANCELLED: "Đã hủy" } as const;

export function ReceiptList() {
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
    const hasInvalidDateRange = dateFrom && dateTo && dateFrom > dateTo;
    if (hasInvalidDateRange) {
      setItems([]);
      setTotal(0);
      setLoading(false);
      setError("Ngày bắt đầu phải trước hoặc bằng ngày kết thúc");
      return () => controller.abort();
    }
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({
        page: String(page + 1),
        pageSize: String(pageSize),
      });
      if (search.trim()) params.set("search", search.trim());
      if (status) params.set("status", status);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      void fetch(`/api/receipts?${params}`, { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok)
            throw new Error(
              await extractApiErrorMessage(response, "Không thể tải biên lai"),
            );
          return unwrapApiResponse<ReceiptResult>(response);
        })
        .then((result) => {
          setItems(result.items);
          setTotal(result.total);
        })
        .catch((reason: unknown) => {
          if ((reason as { name?: string })?.name !== "AbortError")
            setError(
              reason instanceof Error
                ? reason.message
                : "Không thể tải biên lai",
            );
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [page, pageSize, search, status, dateFrom, dateTo, refreshKey]);

  function resetFilters() {
    setSearch("");
    setStatus("");
    setDateFrom("");
    setDateTo("");
    setPage(0);
  }

  return (
    <Stack spacing={{ xs: 2, md: 3 }}>
      <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", md: "center" }}
        gap={1}
      >
        <BoxTitle />
        <Button
          variant="outlined"
          startIcon={<RefreshOutlinedIcon />}
          onClick={() => setRefreshKey((value) => value + 1)}
        >
          Làm mới
        </Button>
      </Stack>
      </Paper>
      <Paper sx={{ p: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
          <FilterAltOutlinedIcon color="action" fontSize="small" />
          <Box>
            <Typography fontWeight={700}>Bộ lọc tra cứu</Typography>
            <Typography variant="body2" color="text.secondary">Kết hợp mã, trạng thái hoặc khoảng ngày phát hành.</Typography>
          </Box>
        </Stack>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} flexWrap="wrap" useFlexGap>
          <AppTextField
            fullWidth
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(0);
            }}
            placeholder="Tìm số biên lai, mã học viên, họ tên hoặc mã học phí"
            InputProps={{
              startAdornment: (
                <SearchIcon
                  fontSize="small"
                  sx={{ mr: 1, color: "text.secondary" }}
                />
              ),
            }}
            sx={{ flex: 1 }}
          />
          <AppTextField
            select
            label="Trạng thái"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(0);
            }}
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="">Tất cả trạng thái</MenuItem>
            <MenuItem value="ACTIVE">Đang hiệu lực</MenuItem>
            <MenuItem value="CANCELLED">Đã hủy</MenuItem>
          </AppTextField>
          <DatePickerField
            label="Từ ngày"
            value={dateFrom}
            onChange={(value) => {
              setDateFrom(value);
              setPage(0);
            }}
            textFieldProps={{
              error: Boolean(dateFrom && dateTo && dateFrom > dateTo),
            }}
          />
          <DatePickerField
            label="Đến ngày"
            value={dateTo}
            onChange={(value) => {
              setDateTo(value);
              setPage(0);
            }}
            textFieldProps={{
              error: Boolean(dateFrom && dateTo && dateFrom > dateTo),
              helperText: dateFrom && dateTo && dateFrom > dateTo
                ? "Ngày bắt đầu phải trước hoặc bằng ngày kết thúc"
                : undefined,
            }}
          />
          <Button
            variant="outlined"
            onClick={resetFilters}
            disabled={!search && !status && !dateFrom && !dateTo}
          >
            Xóa bộ lọc
          </Button>
        </Stack>
      </Paper>
      {error && (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => setRefreshKey((value) => value + 1)}>
              Thử lại
            </Button>
          }
        >
          {error}
        </Alert>
      )}
      <Paper elevation={0} sx={{ overflow: "hidden", border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} gap={1} sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>Danh sách biên lai</Typography>
            <Typography variant="body2" color="text.secondary">{total} biên lai trong kết quả hiện tại</Typography>
          </Box>
          {status && <Chip size="small" variant="outlined" label={statusLabels[status as keyof typeof statusLabels]} />}
        </Stack>
        <Box sx={{ overflowX: "auto" }}>
        <Table sx={{ minWidth: 1000 }}>
          <TableHead>
            <TableRow>
              <TableCell>Số biên lai</TableCell>
              <TableCell>Học viên</TableCell>
              <TableCell>Khoản thu</TableCell>
              <TableCell>Môn đã đăng ký</TableCell>
              <TableCell>Ngày phát hành</TableCell>
              <TableCell>Trạng thái</TableCell>
              <TableCell align="right">Số tiền</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={8}>
                  <Stack alignItems="center" sx={{ py: 5 }}>
                    <CircularProgress size={28} />
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 1 }}
                    >
                      Đang tải biên lai...
                    </Typography>
                  </Stack>
                </TableCell>
              </TableRow>
            )}
            {!loading &&
              items.map((item) => (
                <TableRow key={item.id} hover>
                  <TableCell>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => setDetailId(item.id)}
                    >
                      {item.receiptNo}
                    </Button>
                  </TableCell>
                  <TableCell>
                    {item.payment.tuitionFee.student.code} —{" "}
                    {item.payment.tuitionFee.student.fullName}
                  </TableCell>
                  <TableCell>{item.payment.tuitionFee.feeNo}</TableCell>
                  <TableCell>
                    {item.payment.tuitionFee.items
                      .map((feeItem) => feeItem.classSubject?.subject.name || feeItem.itemName)
                      .join(", ") || "-"}
                  </TableCell>
                  <TableCell>
                    {new Date(item.issuedAt).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}
                  </TableCell>
                  <TableCell><Chip size="small" color={item.status === "ACTIVE" ? "success" : "default"} label={statusLabels[item.status]} /></TableCell>
                  <TableCell align="right">
                    {money(Number(item.amount))}
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5}>
                      {item.status === "ACTIVE" ? (
                        <>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<DownloadOutlinedIcon />}
                            href={`/api/tuition-receipts/${item.id}/pdf`}
                          >
                            Tải PDF
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<PrintOutlinedIcon />}
                            href={`/api/tuition-receipts/${item.id}/pdf?inline=1`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            In
                          </Button>
                        </>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          Đã hủy
                        </Typography>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            {!loading && !items.length && (
              <TableRow>
                <TableCell colSpan={8}>
                  <Typography
                    sx={{ p: 5 }}
                    textAlign="center"
                    color="text.secondary"
                  >
                    Không tìm thấy biên lai phù hợp
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        </Box>
        <TablePagination
          component="div"
          count={total}
          page={page}
          rowsPerPage={pageSize}
          onPageChange={(_, nextPage) => setPage(nextPage)}
          onRowsPerPageChange={(event) => {
            setPageSize(Number(event.target.value));
            setPage(0);
          }}
          rowsPerPageOptions={[10, 20, 50, 100]}
          labelRowsPerPage="Số dòng/trang"
          labelDisplayedRows={({ from, to, count }) =>
            `${from}–${to} trên ${count !== -1 ? count : `hơn ${to}`}`
          }
        />
      </Paper>
      {detailId && (
        <ReceiptDetailDialog
          id={detailId}
          onClose={() => setDetailId(null)}
          onCancelled={() => setRefreshKey((value) => value + 1)}
        />
      )}
    </Stack>
  );
}

function BoxTitle() {
  return (
    <Stack direction="row" spacing={1.5} alignItems="center">
      <Box sx={{ width: 44, height: 44, borderRadius: 2, display: "grid", placeItems: "center", bgcolor: "primary.main", color: "primary.contrastText" }}>
        <ReceiptLongOutlinedIcon />
      </Box>
      <Box>
        <Typography variant="h5" fontWeight={700}>Biên lai học phí</Typography>
        <Typography variant="body2" color="text.secondary">Tra cứu, xem chi tiết và tải lại biên lai đã phát hành.</Typography>
      </Box>
    </Stack>
  );
}
