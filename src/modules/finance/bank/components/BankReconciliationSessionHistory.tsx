"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import { extractApiErrorMessage, unwrapApiResponse } from "@/lib/api-client";
import { LoadingState } from "@/components/shared/feedback/LoadingState";

type Session = {
  id: string;
  fileName: string;
  bankFormat: string;
  statementFromDate: string | null;
  statementToDate: string | null;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicatedRows: number;
  matchedRows: number;
  unmatchedRows: number;
  ignoredRows: number;
  createdAt: string;
  bankAccount: { bankName: string; accountNo: string };
};

type SessionList = { sessions: Session[]; total: number; page: number; pageSize: number };

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
}

function formatCreatedAt(value: string) {
  return new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
}

export function BankReconciliationSessionHistory() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadSessions = useCallback(async (targetPage: number, append = false) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/bank-statement-imports?page=${targetPage}&pageSize=20`);
      if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không thể tải phiên đối soát"));
      const data = await unwrapApiResponse<SessionList>(response);
      setSessions((current) => append ? [...current, ...data.sessions] : data.sessions);
      setTotal(data.total);
      setPage(data.page);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể tải phiên đối soát");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadSessions(1); }, [loadSessions]);
  useEffect(() => {
    const refresh = () => { void loadSessions(1); };
    window.addEventListener("bank-reconciliation-sessions-updated", refresh);
    return () => window.removeEventListener("bank-reconciliation-sessions-updated", refresh);
  }, [loadSessions]);

  return (
    <Paper sx={{ width: "100%", minWidth: 0, boxSizing: "border-box", p: { xs: 1.5, md: 2 } }}>
      <Stack spacing={2}>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} spacing={1}>
          <Box>
            <Typography variant="h6" fontWeight={700}>Lịch sử phiên đối soát</Typography>
            <Typography variant="body2" color="text.secondary">{total} phiên đã lưu</Typography>
          </Box>
          <Button startIcon={<RefreshOutlinedIcon />} onClick={() => void loadSessions(1)} disabled={loading}>
            Làm mới
          </Button>
        </Stack>
        {error && <Alert severity="error">{error}</Alert>}
        {loading && sessions.length === 0 && !error && <LoadingState label="Đang tải lịch sử đối soát..." minHeight={200} />}
        {!error && sessions.length === 0 && !loading && <Alert severity="info">Chưa có phiên sao kê nào.</Alert>}
        {sessions.length > 0 && (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Thời điểm import</TableCell>
                  <TableCell>File / tài khoản</TableCell>
                  <TableCell>Ngày sao kê</TableCell>
                  <TableCell align="right">Dòng</TableCell>
                  <TableCell align="right">Khớp</TableCell>
                  <TableCell align="right">Chưa khớp</TableCell>
                  <TableCell align="right">Bỏ qua</TableCell>
                  <TableCell align="right">Trùng / lỗi</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sessions.map((session) => (
                  <TableRow key={session.id} hover>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{formatCreatedAt(session.createdAt)}</TableCell>
                    <TableCell sx={{ minWidth: 180 }}>
                      <Typography variant="body2" fontWeight={600}>{session.fileName}</Typography>
                      <Typography variant="caption" color="text.secondary">{session.bankAccount.bankName} · {session.bankAccount.accountNo}</Typography>
                    </TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{formatDate(session.statementFromDate)} – {formatDate(session.statementToDate)}</TableCell>
                    <TableCell align="right">{session.totalRows}</TableCell>
                    <TableCell align="right">{session.matchedRows}</TableCell>
                    <TableCell align="right">{session.unmatchedRows}</TableCell>
                    <TableCell align="right">{session.ignoredRows}</TableCell>
                    <TableCell align="right">{session.duplicatedRows} / {session.invalidRows}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        {sessions.length < total && (
          <Button onClick={() => void loadSessions(page + 1, true)} disabled={loading}>
            {loading ? "Đang tải…" : "Tải thêm phiên"}
          </Button>
        )}
        {loading && sessions.length > 0 && <LoadingState label="Đang tải thêm phiên đối soát..." inline size={18} />}
      </Stack>
    </Paper>
  );
}
