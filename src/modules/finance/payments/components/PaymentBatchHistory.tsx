"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
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
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import FilterAltOutlinedIcon from "@mui/icons-material/FilterAltOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import Link from "next/link";
import { extractApiErrorMessage, unwrapApiResponse } from "@/lib/api-client";
import {
  MasterSelectField,
  type MasterSelectValue,
} from "@/components/shared/forms/MasterSelectField";
import {
  StudentSelectDialog,
  type StudentItem,
} from "@/components/shared/dialogs/StudentSelectDialog";
import { useDisclosure } from "@/hooks/useDisclosure";
import { ConfirmDialog } from "@/components/shared/dialogs/ConfirmDialog";
import { AppTextField } from "@/components/shared/forms/AppTextField";
import { useSnackbar } from "@/hooks/useSnackbar";

type Batch = {
  id: string;
  batchNo: string;
  totalAmount: number;
  paymentMethod: string;
  status: string;
  paymentDate?: string | null;
  createdAt: string;
  student: { code: string; fullName: string };
  receipt?: { id: string } | null;
  allocations: Array<{
    amount: number;
    tuitionFee: { feeNo: string; class?: { name: string } | null };
  }>;
};

const money = (value: number) =>
  `${new Intl.NumberFormat("vi-VN").format(value)} VND`;
const statusLabels: Record<string, string> = {
  PENDING: "Chờ chuyển khoản / đối soát",
  SUCCESS: "Đã thanh toán",
  FAILED: "Thất bại",
  CANCELLED: "Đã hủy",
};
const statusColors: Record<
  string,
  "warning" | "success" | "error" | "default"
> = {
  PENDING: "warning",
  SUCCESS: "success",
  FAILED: "error",
  CANCELLED: "default",
};

export function PaymentBatchHistory() {
  const [items, setItems] = useState<Batch[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [studentCode, setStudentCode] = useState("");
  const [pendingStudentCode, setPendingStudentCode] = useState("");
  const [student, setStudent] = useState<MasterSelectValue | null>(null);
  const [status, setStatus] = useState("");
  const [pendingStatus, setPendingStatus] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancelTarget, setCancelTarget] = useState<Batch | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cashTarget, setCashTarget] = useState<Batch | null>(null);
  const [convertingCash, setConvertingCash] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelReasonError, setCancelReasonError] = useState("");
  const { showSuccess, Snackbar } = useSnackbar();
  const studentDialog = useDisclosure();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({
      page: String(page + 1),
      pageSize: String(pageSize),
    });
    if (studentCode.trim()) params.set("studentCode", studentCode.trim());
    if (status) params.set("status", status);

    try {
      const response = await fetch(`/api/payment-batches?${params}`);
      if (!response.ok) {
        throw new Error(
          await extractApiErrorMessage(
            response,
            "Không thể tải lịch sử thu học phí",
          ),
        );
      }
      const result = await unwrapApiResponse<{ items: Batch[]; total: number }>(
        response,
      );
      setItems(result.items);
      setTotal(result.total);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Không thể tải lịch sử thu học phí",
      );
    } finally {
      setLoading(false);
    }
  }, [studentCode, status, page, pageSize]);

  useEffect(() => {
    void load();
  }, [load]);

  function clearSearch() {
    const hasSearchState = Boolean(
      studentCode || status || pendingStudentCode || pendingStatus || page !== 0,
    );
    setStudent(null);
    setStudentCode("");
    setPendingStudentCode("");
    setStatus("");
    setPendingStatus("");
    setPage(0);
    if (!hasSearchState) return;
  }

  function applySearch() {
    setStudentCode(pendingStudentCode);
    setStatus(pendingStatus);
    setPage(0);
  }

  async function cancelBatch() {
    if (!cancelTarget) return;
    const reason = cancelReason.trim();
    if (!reason) {
      setCancelReasonError("Lý do hủy là bắt buộc");
      return;
    }
    setCancelReasonError("");
    setCancelling(true);
    try {
      const response = await fetch(
        `/api/payment-batches/${cancelTarget.id}/cancel`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        },
      );
      if (!response.ok)
        throw new Error(
          await extractApiErrorMessage(
            response,
            "Không thể hủy đợt thanh toán",
          ),
        );
      setCancelTarget(null);
      await load();
      showSuccess("Đã hủy đợt thanh toán");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Không thể hủy đợt thanh toán",
      );
    } finally {
      setCancelling(false);
    }
  }

  async function convertToCash() {
    if (!cashTarget) return;
    setConvertingCash(true);
    try {
      const response = await fetch(`/api/payment-batches/${cashTarget.id}/cash`, {
        method: "POST",
      });
      if (!response.ok)
        throw new Error(
          await extractApiErrorMessage(response, "Không thể chuyển sang tiền mặt"),
        );
      setCashTarget(null);
      setExpanded(null);
      await load();
      showSuccess("Đã chuyển đợt thanh toán sang tiền mặt và phát hành biên lai");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không thể chuyển sang tiền mặt",
      );
    } finally {
      setConvertingCash(false);
    }
  }

  return (
    <Stack spacing={{ xs: 2, md: 3 }}>
      <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ md: "center" }} gap={2}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box sx={{ width: 44, height: 44, borderRadius: 2, display: "grid", placeItems: "center", bgcolor: "primary.main", color: "primary.contrastText" }}>
              <ReceiptLongOutlinedIcon />
            </Box>
            <Box>
              <Typography variant="h5" fontWeight={700}>Giao dịch thu học phí</Typography>
              <Typography variant="body2" color="text.secondary">Theo dõi thanh toán, đối soát chuyển khoản và biên lai.</Typography>
            </Box>
          </Stack>
          <Button variant="outlined" startIcon={<RefreshOutlinedIcon />} onClick={() => void load()} disabled={loading}>Làm mới</Button>
        </Stack>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
          <FilterAltOutlinedIcon color="action" fontSize="small" />
          <Typography variant="subtitle1" fontWeight={700}>Bộ lọc tra cứu</Typography>
        </Stack>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          alignItems={{ xs: "stretch", sm: "center" }}
        >
          <MasterSelectField
            label="Học viên"
            value={student}
            onOpen={studentDialog.onOpen}
            size="small"
            codeLabel="Mã học sinh"
            nameLabel="Họ tên"
            sx={{ flex: 1, minWidth: 260 }}
          />
          <AppTextField
            size="small"
            select
            label="Trạng thái"
            value={status}
            onChange={(event) => setPendingStatus(event.target.value)}
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="">Tất cả trạng thái</MenuItem>
            <MenuItem value="SUCCESS">Đã thanh toán</MenuItem>
            <MenuItem value="PENDING">Chờ chuyển khoản / đối soát</MenuItem>
            <MenuItem value="FAILED">Thất bại</MenuItem>
            <MenuItem value="CANCELLED">Đã hủy</MenuItem>
          </AppTextField>
          <Button variant="contained" onClick={applySearch}>
            Tìm kiếm
          </Button>
          <Button
            variant="outlined"
            onClick={clearSearch}
            disabled={!studentCode && !status && !pendingStudentCode && !pendingStatus && page === 0}
          >
            Xóa tìm kiếm
          </Button>
        </Stack>
      </Paper>

      {error && <Alert severity="error">{error}</Alert>}

      <Paper sx={{ overflow: "hidden" }}>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} gap={1} sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>Danh sách đợt thanh toán</Typography>
            <Typography variant="body2" color="text.secondary">{total} giao dịch</Typography>
          </Box>
          <Chip size="small" label={status ? statusLabels[status] : "Tất cả trạng thái"} variant="outlined" />
        </Stack>
        <Box sx={{ overflowX: "auto" }}>
        <Table sx={{ minWidth: 1040 }} size="small">
          <TableHead>
            <TableRow>
              <TableCell>Mã đợt thanh toán</TableCell>
              <TableCell>Học viên</TableCell>
              <TableCell align="center">Số khoản</TableCell>
              <TableCell align="right">Số tiền</TableCell>
              <TableCell>Phương thức</TableCell>
              <TableCell>Trạng thái</TableCell>
              <TableCell>Ngày tạo</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {!loading &&
              items.map((batch) => (
                <Fragment key={batch.id}>
                  <TableRow
                    key={batch.id}
                    hover
                    sx={{
                      bgcolor:
                        batch.status === "PENDING"
                          ? "warning.light"
                          : batch.status === "SUCCESS"
                            ? "success.light"
                            : undefined,
                    }}
                  >
                    <TableCell>
                      <Button
                        component={Link}
                        href={`/admin/tuition-fees/payment-history/${batch.id}`}
                        size="small"
                        variant="outlined"
                      >
                        {batch.batchNo}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Typography fontWeight={600}>
                        {batch.student.fullName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {batch.student.code}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">{batch.allocations.length}</TableCell>
                    <TableCell align="right">
                      <Typography fontWeight={700}>
                        {money(Number(batch.totalAmount))}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {batch.paymentMethod === "BANK_TRANSFER"
                        ? "Chuyển khoản / VietQR"
                        : batch.paymentMethod === "CASH"
                          ? "Tiền mặt"
                          : "Phương thức cũ"}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        color={statusColors[batch.status] || "default"}
                        label={statusLabels[batch.status] || batch.status}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {new Date(batch.createdAt).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}
                      </Typography>
                      {batch.status === "SUCCESS" && batch.paymentDate && (
                        <Typography variant="caption" color="text.secondary">
                          Thu: {new Date(batch.paymentDate).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<ExpandMoreIcon />}
                        onClick={() =>
                          setExpanded(expanded === batch.id ? null : batch.id)
                        }
                      >
                        {expanded === batch.id ? "Thu gọn" : "Xem khoản phí"}
                      </Button>
                    </TableCell>
                  </TableRow>
                  <TableRow key={`${batch.id}-detail`}>
                    <TableCell colSpan={8} sx={{ p: 0, border: 0 }}>
                      <Collapse in={expanded === batch.id}>
                        <Box sx={{ p: 2, bgcolor: "action.hover" }}>
                          <Stack
                            direction={{ xs: "column", sm: "row" }}
                            justifyContent="space-between"
                            gap={1}
                            sx={{ mb: 1 }}
                          >
                            <Typography variant="subtitle2">
                              Các khoản học phí trong đợt
                            </Typography>
                            <Typography variant="subtitle2" color="primary.main">
                              Tổng: {money(Number(batch.totalAmount))}
                            </Typography>
                          </Stack>
                          {batch.allocations.map((allocation) => (
                            <Stack
                              key={allocation.tuitionFee.feeNo}
                              direction="row"
                              justifyContent="space-between"
                            >
                              <Typography variant="body2">
                                {allocation.tuitionFee.feeNo} ·{" "}
                                {allocation.tuitionFee.class?.name ||
                                  "Chưa có lớp"}
                              </Typography>
                              <Typography variant="body2">
                                {money(Number(allocation.amount))}
                              </Typography>
                            </Stack>
                          ))}
                          {batch.receipt && batch.status === "SUCCESS" ? (
                            <Button
                              size="small"
                              sx={{ mt: 1 }}
                              variant="outlined"
                              href={`/api/payment-batch-receipts/${batch.receipt.id}/pdf`}
                            >
                              Xuất biên lai
                            </Button>
                          ) : batch.status === "PENDING" ? (
                            <Stack
                              direction={{ xs: "column", sm: "row" }}
                              spacing={1}
                              sx={{ mt: 1 }}
                            >
                              <Button
                                size="small"
                                variant="outlined"
                                href={`/api/payment-batches/${batch.id}/notice/pdf`}
                              >
                                Tải thông báo PDF
                              </Button>
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<PrintOutlinedIcon />}
                                component="a"
                                href={`/api/payment-batches/${batch.id}/notice/pdf?inline=1`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                Mở để in
                              </Button>
                              <Button
                                size="small"
                                color="warning"
                                variant="outlined"
                                onClick={() => setCashTarget(batch)}
                              >
                                Chuyển sang tiền mặt
                              </Button>
                              <Button
                                size="small"
                                color="error"
                                variant="outlined"
                                onClick={() => {
                                  setCancelReason("");
                                  setCancelReasonError("");
                                  setCancelTarget(batch);
                                }}
                              >
                                Hủy đợt thanh toán
                              </Button>
                            </Stack>
                          ) : null}
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </Fragment>
              ))}
            {!loading && !items.length && (
              <TableRow>
                <TableCell colSpan={8}>
                  <Typography sx={{ p: 3 }} color="text.secondary">
                    Chưa có dữ liệu
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {loading && (
              <TableRow>
                <TableCell colSpan={8}>
                  <Typography sx={{ p: 3 }} textAlign="center">
                    Đang tải...
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

      <StudentSelectDialog
        open={studentDialog.open}
        onClose={studentDialog.onClose}
        onSelect={(item: StudentItem) => {
          setStudent({ id: item.id, code: item.code, name: item.fullName });
          setPendingStudentCode(item.code);
          studentDialog.onClose();
        }}
      />
      <ConfirmDialog
        open={!!cancelTarget}
        title="Hủy đợt chuyển khoản"
        message={
          cancelTarget
            ? `Hủy đợt ${cancelTarget.batchNo}? Các khoản học phí sẽ được giải phóng để thu tiền mặt.`
            : ""
        }
        confirmLabel="Hủy đợt thanh toán"
        cancelLabel="Quay lại"
        content={
          <AppTextField
            autoFocus
            fullWidth
            multiline
            minRows={3}
            label="Lý do hủy"
            value={cancelReason}
            onChange={(event) => {
              setCancelReason(event.target.value);
              if (event.target.value.trim()) setCancelReasonError("");
            }}
            error={Boolean(cancelReasonError)}
            helperText={cancelReasonError || "Tối đa 500 ký tự"}
            inputProps={{ maxLength: 500 }}
            sx={{ mt: 2 }}
          />
        }
        onConfirm={() => void cancelBatch()}
        onCancel={() => setCancelTarget(null)}
        isLoading={cancelling}
      />
      <ConfirmDialog
        open={!!cashTarget}
        title="Chuyển sang thanh toán tiền mặt"
        message={
          cashTarget
            ? `Xác nhận đã nhận ${money(Number(cashTarget.totalAmount))} tiền mặt từ ${cashTarget.student.fullName}? Hệ thống sẽ hoàn tất thanh toán và phát hành biên lai.`
            : ""
        }
        confirmLabel="Xác nhận tiền mặt"
        cancelLabel="Quay lại"
        onConfirm={() => void convertToCash()}
        onCancel={() => setCashTarget(null)}
        isLoading={convertingCash}
      />
      {Snackbar}
    </Stack>
  );
}
