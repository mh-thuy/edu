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
  TextField,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
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
  const [student, setStudent] = useState<MasterSelectValue | null>(null);
  const [status, setStatus] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancelTarget, setCancelTarget] = useState<Batch | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cashTarget, setCashTarget] = useState<Batch | null>(null);
  const [convertingCash, setConvertingCash] = useState(false);
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
    const shouldReloadImmediately = !studentCode && !status;
    setStudent(null);
    setStudentCode("");
    setStatus("");
    setPage(0);
    if (shouldReloadImmediately) void load();
  }

  async function cancelBatch() {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      const response = await fetch(
        `/api/payment-batches/${cancelTarget.id}/cancel`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reason: "Khách hàng chuyển sang thanh toán tiền mặt",
          }),
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
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không thể chuyển sang tiền mặt",
      );
    } finally {
      setConvertingCash(false);
    }
  }

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h4" fontWeight={700}>
          Giao dịch thu học phí
        </Typography>
        <Typography color="text.secondary">
          Theo dõi các đợt thanh toán, đối soát chuyển khoản và biên lai.
        </Typography>
      </Box>

      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
          Bộ lọc tra cứu
        </Typography>
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
          <TextField
            size="small"
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
            <MenuItem value="SUCCESS">Đã thanh toán</MenuItem>
            <MenuItem value="PENDING">Chờ chuyển khoản / đối soát</MenuItem>
            <MenuItem value="FAILED">Thất bại</MenuItem>
            <MenuItem value="CANCELLED">Đã hủy</MenuItem>
          </TextField>
          <Button variant="contained" onClick={() => void load()}>
            Tìm kiếm
          </Button>
          <Button
            variant="text"
            onClick={clearSearch}
            disabled={!studentCode && !status}
          >
            Xóa tìm kiếm
          </Button>
        </Stack>
      </Paper>

      {error && <Alert severity="error">{error}</Alert>}

      <Paper sx={{ overflowX: "auto" }}>
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
                          : "Khác"}
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
                        {new Date(batch.createdAt).toLocaleDateString("vi-VN")}
                      </Typography>
                      {batch.paymentDate && (
                        <Typography variant="caption" color="text.secondary">
                          Thu: {new Date(batch.paymentDate).toLocaleDateString("vi-VN")}
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
                          {batch.receipt ? (
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
                                onClick={() => setCancelTarget(batch)}
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
          setStudentCode(item.code);
          setPage(0);
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
    </Stack>
  );
}
