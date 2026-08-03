"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Box, Button, Chip, MenuItem, Paper, Select, Stack, Step, StepLabel, Stepper, Table, TableBody, TableCell, TableHead, TablePagination, TableRow, Typography } from "@mui/material";
import { extractApiErrorMessage, unwrapApiResponse } from "@/lib/api-client";
import { ConfirmDialog } from "@/components/shared/dialogs/ConfirmDialog";

type Account = { id: string; bankName: string; accountNo: string; accountName: string };
type Candidate = { tuitionFeeId: string; matchScore: number; amountDifference: number; tuitionFee?: { feeNo: string; finalAmount: number; status: string; student: { code: string; fullName: string }; class: { name: string } } };
type Batch = { id: string; batchNo: string; totalAmount: number; student: { code: string; fullName: string }; allocations: Array<{ tuitionFeeId: string; amount: number; tuitionFee: { feeNo: string } }> };
type Transaction = { id: string; transactionDate: string; description: string; creditAmount: number; debitAmount: number; reconciliationStatus: string; candidates: Candidate[]; paymentBatch?: Batch | null };
type PendingConfirmation = { transactionId: string; body: { tuitionFeeId?: string; batchId?: string }; title: string; message: string };

const money = (value: number) => new Intl.NumberFormat("vi-VN").format(Number(value));
const steps = ["Chọn tài khoản và file", "Import", "Đối soát"];
const reconciliationLabels: Record<string, string> = { IMPORTED: "Đã import", AUTO_MATCHED: "Tự động khớp", MANUAL_MATCHED: "Đã khớp thủ công", CONFIRMED: "Đã xác nhận", UNMATCHED: "Chưa khớp", AMBIGUOUS: "Khớp nhiều ứng viên", AMOUNT_MISMATCH: "Lệch số tiền", DUPLICATED: "Trùng giao dịch", IGNORED: "Bỏ qua", REVERSED: "Đã hoàn tác", ERROR: "Lỗi" };
const reconciliationColors: Record<string, "default" | "success" | "warning" | "error" | "info"> = { IMPORTED: "default", AUTO_MATCHED: "info", MANUAL_MATCHED: "info", CONFIRMED: "success", UNMATCHED: "warning", AMBIGUOUS: "warning", AMOUNT_MISMATCH: "error", DUPLICATED: "default", IGNORED: "default", REVERSED: "error", ERROR: "error" };

export function BankReconciliationPanel() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState(0);
  const [items, setItems] = useState<Transaction[]>([]);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [message, setMessage] = useState<{ text: string; severity: "success" | "error" | "info" }>({ text: "", severity: "info" });
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);

  const load = useCallback(async () => {
    if (!accountId) return;
    setListLoading(true);
    try {
      const response = await fetch(`/api/bank-statement-transactions?bankAccountId=${encodeURIComponent(accountId)}&status=UNMATCHED,AUTO_MATCHED,AMBIGUOUS,AMOUNT_MISMATCH&page=${page + 1}&pageSize=${pageSize}`);
      if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không thể tải giao dịch ngân hàng"));
      const result = await unwrapApiResponse<{ items: Transaction[]; total: number }>(response);
      setItems(result.items); setTotal(result.total);
    } catch (reason) {
      setMessage({ text: reason instanceof Error ? reason.message : "Không thể tải giao dịch ngân hàng", severity: "error" });
    } finally {
      setListLoading(false);
    }
  }, [accountId, page, pageSize]);

  useEffect(() => {
    void fetch("/api/bank-accounts").then(async (response) => response.ok ? unwrapApiResponse<Account[]>(response) : []).then((data) => { setAccounts(data); setAccountId(data[0]?.id || ""); });
  }, []);
  useEffect(() => { setPage(0); }, [accountId]);
  useEffect(() => { void load(); }, [load]);

  function inspectFile(nextFile: File | null) { setFile(nextFile); if (nextFile) setStep(1); }

  async function importFile() {
    if (!file || !accountId) { setMessage({ text: "Chọn tài khoản ngân hàng và file CSV", severity: "error" }); return; }
    setLoading(true);
    const form = new FormData(); form.append("file", file); form.append("bankAccountId", accountId);
    try {
      const response = await fetch("/api/bank-statement-imports", { method: "POST", body: form });
      if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Import thất bại"));
      const result = await unwrapApiResponse<{ duplicatedRows: number }>(response);
      setMessage({ text: `Import sao kê thành công. Đã bỏ qua ${result.duplicatedRows} dòng trùng.`, severity: "success" });
      setFile(null); setStep(2); await load();
    } catch (reason) {
      setMessage({ text: reason instanceof Error ? reason.message : "Import thất bại", severity: "error" });
    } finally { setLoading(false); }
  }

  function requestConfirm(transactionId: string, body: PendingConfirmation["body"], title: string, message: string) {
    setPendingConfirmation({ transactionId, body, title, message });
  }

  async function confirm() {
    if (!pendingConfirmation) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/bank-reconciliations/${pendingConfirmation.transactionId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pendingConfirmation.body) });
      if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không thể xác nhận đối soát"));
      setMessage({ text: "Đã xác nhận đối soát và tạo thanh toán/biên lai.", severity: "success" });
      setPendingConfirmation(null); await load();
    } catch (reason) {
      setMessage({ text: reason instanceof Error ? reason.message : "Không thể xác nhận đối soát", severity: "error" });
    } finally { setLoading(false); }
  }

  return <Stack spacing={2}>
    <Typography variant="h5">Import và đối soát sao kê ngân hàng</Typography>
    <Stepper activeStep={step} alternativeLabel>{steps.map((label) => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}</Stepper>
    <Paper sx={{ p: 2 }}><Stack spacing={2}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center">
        <Select value={accountId} onChange={(event) => setAccountId(event.target.value)} displayEmpty sx={{ minWidth: 260 }}><MenuItem value="">Chọn tài khoản</MenuItem>{accounts.map((account) => <MenuItem key={account.id} value={account.id}>{account.bankName} — {account.accountNo}</MenuItem>)}</Select>
        <Button variant="outlined" component="label">{file?.name || "Chọn file CSV"}<input hidden type="file" accept=".csv,text/csv" onChange={(event) => inspectFile(event.target.files?.[0] || null)} /></Button>
      </Stack>
      {file && <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center"><Typography>Đã chọn {file.name}. Có thể import ngay.</Typography><Button variant="contained" onClick={() => void importFile()} disabled={loading || !accountId}>{loading ? "Đang import..." : "Import sao kê"}</Button></Stack>}
      {message.text && <Alert severity={message.severity}>{message.text}</Alert>}
    </Stack></Paper>
    <Paper sx={{ overflow: "auto" }}><Table size="small"><TableHead><TableRow><TableCell>Ngày</TableCell><TableCell>Nội dung</TableCell><TableCell align="right">Ghi có</TableCell><TableCell>Trạng thái</TableCell><TableCell>Đối tượng đối soát</TableCell></TableRow></TableHead><TableBody>
      {listLoading ? <TableRow><TableCell colSpan={5}><Typography sx={{ p: 3 }} textAlign="center">Đang tải giao dịch...</Typography></TableCell></TableRow> : items.map((item) => <TableRow key={item.id}><TableCell>{new Date(item.transactionDate).toLocaleString("vi-VN")}</TableCell><TableCell sx={{ minWidth: 300 }}>{item.description}</TableCell><TableCell align="right">{money(item.creditAmount)} VND</TableCell><TableCell><Chip size="small" color={reconciliationColors[item.reconciliationStatus] || "default"} label={reconciliationLabels[item.reconciliationStatus] || item.reconciliationStatus} /></TableCell><TableCell>
        {item.paymentBatch ? <Box><Typography variant="body2"><strong>{item.paymentBatch.batchNo}</strong> · {item.paymentBatch.student.code} — {item.paymentBatch.student.fullName}</Typography><Typography variant="body2">{item.paymentBatch.allocations.length} khoản · {money(item.paymentBatch.totalAmount)} VND</Typography><Button size="small" variant="outlined" disabled={loading} onClick={() => requestConfirm(item.id, { batchId: item.paymentBatch!.id }, "Xác nhận batch", `Xác nhận thanh toán batch ${item.paymentBatch!.batchNo} và tạo biên lai?`)}>Xác nhận batch</Button></Box> : item.candidates.length ? item.candidates.slice(0, 3).map((candidate) => { const exact = Math.abs(Number(item.creditAmount) - Number(candidate.tuitionFee?.finalAmount || 0)) < 0.001; return <Box key={candidate.tuitionFeeId} sx={{ mb: 1 }}><Typography variant="body2">{candidate.tuitionFee?.student.code} — {candidate.tuitionFee?.student.fullName} · {money(Number(candidate.tuitionFee?.finalAmount || 0))} VND</Typography><Button size="small" variant="outlined" disabled={!exact || loading || candidate.tuitionFee?.status === "PAID"} onClick={() => requestConfirm(item.id, { tuitionFeeId: candidate.tuitionFeeId }, "Xác nhận đối soát", "Xác nhận giao dịch này và tạo thanh toán/biên lai?")}>{exact ? "Xác nhận khớp chính xác" : "Không khớp số tiền"}</Button></Box>; }) : "Chưa có ứng viên"}
      </TableCell></TableRow>)}
      {!listLoading && !items.length && <TableRow><TableCell colSpan={5}><Typography sx={{ p: 3 }} color="text.secondary" textAlign="center">Không có giao dịch chờ đối soát</Typography></TableCell></TableRow>}
    </TableBody></Table><TablePagination component="div" count={total} page={page} rowsPerPage={pageSize} onPageChange={(_, nextPage) => setPage(nextPage)} onRowsPerPageChange={(event) => { setPageSize(Number(event.target.value)); setPage(0); }} rowsPerPageOptions={[10, 20, 50, 100]} labelRowsPerPage="Số dòng/trang" labelDisplayedRows={({ from, to, count }) => `${from}–${to} trên ${count !== -1 ? count : `hơn ${to}`}`} /></Paper>
    <ConfirmDialog open={!!pendingConfirmation} title={pendingConfirmation?.title || "Xác nhận đối soát"} message={pendingConfirmation?.message || "Bạn có chắc chắn muốn thực hiện thao tác này không?"} onConfirm={() => void confirm()} onCancel={() => setPendingConfirmation(null)} isLoading={loading} />
  </Stack>;
}
