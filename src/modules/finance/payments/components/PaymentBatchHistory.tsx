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
  PENDING: "Chờ đối soát",
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
  const studentDialog = useDisclosure();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ page: String(page + 1), pageSize: String(pageSize) });
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
      const result = await unwrapApiResponse<{ items: Batch[]; total: number }>(response);
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

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h4" fontWeight={700}>
          Lịch sử thu học phí
        </Typography>
        <Typography color="text.secondary">
          Tra cứu các lần thanh toán gộp và biên lai tổng.
        </Typography>
      </Box>

      <Paper sx={{ p: 2 }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1}
          alignItems="center"
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
            onChange={(event) => { setStatus(event.target.value); setPage(0); }}
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="">Tất cả</MenuItem>
            <MenuItem value="SUCCESS">Đã thanh toán</MenuItem>
            <MenuItem value="PENDING">Chờ đối soát</MenuItem>
            <MenuItem value="CANCELLED">Đã hủy</MenuItem>
          </TextField>
          <Button variant="contained" onClick={() => void load()}>
            Tìm kiếm
          </Button>
          <Button variant="outlined" onClick={clearSearch}>
            Xóa tìm kiếm
          </Button>
        </Stack>
      </Paper>

      {error && <Alert severity="error">{error}</Alert>}

      <Paper sx={{ overflow: "hidden" }}>
        <Table sx={{ minWidth: 900 }} size="small">
          <TableHead>
            <TableRow>
              <TableCell>Mã batch</TableCell>
              <TableCell>Học sinh</TableCell>
              <TableCell>Số khoản</TableCell>
              <TableCell align="right">Tổng tiền</TableCell>
              <TableCell>Phương thức</TableCell>
              <TableCell>Ngày tạo</TableCell>
              <TableCell>Trạng thái</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {!loading &&
              items.map((batch) => (
                <Fragment key={batch.id}>
                  <TableRow key={batch.id} hover>
                    <TableCell>
                      <strong>{batch.batchNo}</strong>
                    </TableCell>
                    <TableCell>
                      {batch.student.code}
                      <br />
                      <Typography variant="caption">
                        {batch.student.fullName}
                      </Typography>
                    </TableCell>
                    <TableCell>{batch.allocations.length}</TableCell>
                    <TableCell align="right">
                      {money(Number(batch.totalAmount))}
                    </TableCell>
                    <TableCell>
                      {batch.paymentMethod === "BANK_TRANSFER"
                        ? "Chuyển khoản / VietQR"
                        : batch.paymentMethod === "CASH"
                          ? "Tiền mặt"
                          : "Khác"}
                    </TableCell>
                    <TableCell>
                      {new Date(batch.createdAt).toLocaleDateString("vi-VN")}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        color={statusColors[batch.status] || "default"}
                        label={statusLabels[batch.status] || batch.status}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        startIcon={<ExpandMoreIcon />}
                        onClick={() =>
                          setExpanded(
                            expanded === batch.id ? null : batch.id,
                          )
                        }
                      >
                        Chi tiết
                      </Button>
                    </TableCell>
                  </TableRow>
                  <TableRow key={`${batch.id}-detail`}>
                    <TableCell colSpan={8} sx={{ p: 0, border: 0 }}>
                      <Collapse in={expanded === batch.id}>
                        <Box sx={{ p: 2, bgcolor: "action.hover" }}>
                          <Typography variant="subtitle2">
                            Các khoản trong batch
                          </Typography>
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
                              Xuất biên lai tổng
                            </Button>
                          ) : (
                            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 1 }}>
                              <Button size="small" variant="outlined" href={`/api/payment-batches/${batch.id}/notice/pdf`}>
                                Tải thông báo PDF
                              </Button>
                              <Button size="small" variant="contained" startIcon={<PrintOutlinedIcon />} component="a" href={`/api/payment-batches/${batch.id}/notice/pdf?inline=1`} target="_blank" rel="noopener noreferrer">
                                Mở để in
                              </Button>
                            </Stack>
                          )}
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
        <TablePagination component="div" count={total} page={page} rowsPerPage={pageSize} onPageChange={(_, nextPage) => setPage(nextPage)} onRowsPerPageChange={(event) => { setPageSize(Number(event.target.value)); setPage(0); }} rowsPerPageOptions={[10, 20, 50, 100]} labelRowsPerPage="Số dòng/trang" labelDisplayedRows={({ from, to, count }) => `${from}–${to} trên ${count !== -1 ? count : `hơn ${to}`}`} />
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
    </Stack>
  );
}
