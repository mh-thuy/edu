"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Chip,
  Collapse,
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
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import ExpandMoreOutlinedIcon from "@mui/icons-material/ExpandMoreOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import FilterAltOutlinedIcon from "@mui/icons-material/FilterAltOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
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
  const [showDateFilters, setShowDateFilters] = useState(false);

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
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ md: "flex-end" }} gap={2}>
        <BoxTitle />
        <Button
          variant="outlined"
          startIcon={<RefreshOutlinedIcon />}
          onClick={() => setRefreshKey((value) => value + 1)}
          disabled={loading}
        >
          Làm mới
        </Button>
      </Stack>
      <Paper sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} gap={1.25} sx={{ mb: 1.5 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <FilterAltOutlinedIcon color="primary" fontSize="small" />
            <Box>
              <Typography fontWeight={800}>Tra cứu biên lai</Typography>
              <Typography variant="caption" color="text.secondary">Tìm nhanh theo mã biên lai, học viên hoặc trạng thái</Typography>
            </Box>
          </Stack>
          <Button
            size="small"
            variant="text"
            color="inherit"
            startIcon={<TuneOutlinedIcon />}
            endIcon={<ExpandMoreOutlinedIcon sx={{ transform: showDateFilters ? "rotate(180deg)" : "none", transition: "transform 180ms ease" }} />}
            onClick={() => setShowDateFilters((current) => !current)}
            sx={{ color: "text.secondary", alignSelf: { xs: "flex-start", sm: "center" } }}
          >
            Lọc theo ngày phát hành
          </Button>
        </Stack>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.25} alignItems={{ md: "center" }}>
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
          <Button
            variant="outlined"
            onClick={resetFilters}
            disabled={!search && !status && !dateFrom && !dateTo}
          >
            Xóa bộ lọc
          </Button>
        </Stack>
        <Collapse in={showDateFilters}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} sx={{ pt: 1.5 }}>
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
          </Stack>
        </Collapse>
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
      <Paper sx={{ overflow: "hidden" }}>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} gap={1.25} sx={{ p: { xs: 2, md: 2.5 }, borderBottom: 1, borderColor: "divider" }}>
          <Box>
            <Typography variant="h6" fontWeight={800}>Danh sách biên lai</Typography>
            <Typography variant="body2" color="text.secondary">{total} biên lai trong kết quả hiện tại</Typography>
          </Box>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {status && <Chip size="small" color={status === "ACTIVE" ? "success" : "default"} variant="outlined" label={statusLabels[status as keyof typeof statusLabels]} />}
            {dateFrom && <Chip size="small" variant="outlined" icon={<CalendarMonthOutlinedIcon />} label={`Từ ${dateFrom}`} />}
            {dateTo && <Chip size="small" variant="outlined" icon={<CalendarMonthOutlinedIcon />} label={`Đến ${dateTo}`} />}
          </Stack>
        </Stack>
        <Box sx={{ overflowX: "auto" }}>
        <Table sx={{ minWidth: 860 }}>
          <TableHead>
            <TableRow>
              <TableCell>Biên lai</TableCell>
              <TableCell>Người nộp</TableCell>
              <TableCell>Nội dung thu</TableCell>
              <TableCell>Phát hành</TableCell>
              <TableCell>Trạng thái</TableCell>
              <TableCell align="right">Số tiền</TableCell>
              <TableCell align="right">Thao tác</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={7}>
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
                  <TableCell sx={{ minWidth: 155 }}>
                    <Button
                      size="small"
                      variant="text"
                      startIcon={<VisibilityOutlinedIcon />}
                      onClick={() => setDetailId(item.id)}
                      sx={{ p: 0, minWidth: 0, justifyContent: "flex-start", fontWeight: 800 }}
                    >
                      {item.receiptNo}
                    </Button>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75 }}>
                      Payment {item.payment.paymentNo}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ minWidth: 180 }}>
                    <Typography variant="body2" fontWeight={700}>{item.payment.tuitionFee.student.fullName}</Typography>
                    <Typography variant="caption" color="text.secondary">{item.payment.tuitionFee.student.code} · {item.payment.tuitionFee.class.name}</Typography>
                  </TableCell>
                  <TableCell sx={{ minWidth: 220 }}>
                    <Typography variant="body2" fontWeight={600}>{item.payment.tuitionFee.feeNo}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.payment.tuitionFee.items.map((feeItem) => feeItem.classSubject?.subject.name || feeItem.itemName).join(", ") || "-"}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ minWidth: 120 }}>
                    {new Date(item.issuedAt).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}
                  </TableCell>
                  <TableCell sx={{ minWidth: 130 }}><Chip size="small" color={item.status === "ACTIVE" ? "success" : "default"} label={statusLabels[item.status]} /></TableCell>
                  <TableCell align="right" sx={{ minWidth: 140 }}>
                    <Typography fontWeight={800}>{money(Number(item.amount))}</Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ minWidth: 165 }}>
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      <Button size="small" variant="outlined" onClick={() => setDetailId(item.id)}>Chi tiết</Button>
                      {item.status === "ACTIVE" ? (
                        <>
                          <Button
                            size="small"
                            variant="contained"
                            startIcon={<DownloadOutlinedIcon />}
                            href={`/api/tuition-receipts/${item.id}/pdf`}
                            sx={{ whiteSpace: "nowrap" }}
                          >
                            PDF
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
                <TableCell colSpan={7}>
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
    <Stack direction="row" spacing={1.5} alignItems="flex-start">
      <Box sx={{ width: 48, height: 48, flexShrink: 0, borderRadius: 2.5, display: "grid", placeItems: "center", bgcolor: "primary.light", color: "primary.dark" }}>
        <ReceiptLongOutlinedIcon />
      </Box>
      <Box>
        <Typography variant="h4" fontWeight={800} letterSpacing="-0.02em">Biên lai học phí</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Tra cứu, xem chi tiết và tải lại biên lai đã phát hành.</Typography>
      </Box>
    </Stack>
  );
}
