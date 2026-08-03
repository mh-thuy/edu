"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, Card, CardContent, Checkbox, Chip, CircularProgress, Divider, FormControl, InputLabel, FormControlLabel, MenuItem, Paper, Select, Stack, Step, StepLabel, Stepper, TextField, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SearchIcon from "@mui/icons-material/Search";
import { MasterSelectField, type MasterSelectValue } from "@/components/shared/forms/MasterSelectField";
import { StudentSelectDialog, type StudentItem } from "@/components/shared/dialogs/StudentSelectDialog";
import { useDisclosure } from "@/hooks/useDisclosure";
import { extractApiErrorMessage, unwrapApiResponse } from "@/lib/api-client";

type Fee = { id: string; feeNo: string; finalAmount: number; dueDate?: string | null; status: string; student?: { code: string; fullName: string } | null; class?: { name: string } | null };
type BankAccount = { id: string; bankCode: string; bankName: string; accountNo: string; accountName: string };
const steps = ["Tìm học sinh", "Chọn khoản phí", "Xác nhận thanh toán"];
const money = (value: number) => `${new Intl.NumberFormat("vi-VN").format(value)} VND`;

export function TuitionPaymentWorkspace() {
  const [step, setStep] = useState(0);
  const [student, setStudent] = useState<MasterSelectValue | null>(null);
  const [studentCode, setStudentCode] = useState("");
  const [fees, setFees] = useState<Fee[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [method, setMethod] = useState("CASH");
  const [payerName, setPayerName] = useState("");
  const [transactionReference, setTransactionReference] = useState("");
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [bankAccountId, setBankAccountId] = useState("");
  const [pendingBatch, setPendingBatch] = useState<{ id: string; batchNo: string; qrUrl: string } | null>(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const studentDialog = useDisclosure();
  const selectedFees = fees.filter((fee) => selectedIds.includes(fee.id));
  const total = useMemo(() => selectedFees.reduce((sum, fee) => sum + Number(fee.finalAmount), 0), [selectedFees]);
  const selectedStudent = fees[0]?.student;

  useEffect(() => { void fetch("/api/bank-accounts").then(async (response) => response.ok ? unwrapApiResponse<BankAccount[]>(response) : []).then(setBankAccounts).catch(() => setBankAccounts([])); }, []);

  async function lookupStudent() {
    if (!studentCode) { setError("Mã học sinh là bắt buộc"); return; }
    setLoading(true); setError(""); setPendingBatch(null); setReceiptId(null);
    try {
      const response = await fetch(`/api/tuition-fees?studentCode=${encodeURIComponent(studentCode)}&pageSize=100`);
      if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không thể tải học phí"));
      const result = await unwrapApiResponse<{ items: Fee[] }>(response);
      const unpaid = result.items.filter((fee) => fee.status === "UNPAID" || fee.status === "OVERDUE");
      setFees(unpaid); setSelectedIds([]);
      if (!unpaid.length) { setError("Học sinh không còn khoản học phí cần thanh toán"); return; }
      setStep(1);
    } catch (reason) { setFees([]); setSelectedIds([]); setError(reason instanceof Error ? reason.message : "Không thể tải học phí"); }
    finally { setLoading(false); }
  }

  async function submitPayment() {
    if (!selectedIds.length) { setError("Hãy chọn ít nhất một khoản học phí"); setStep(1); return; }
    if (method === "BANK_TRANSFER" && !bankAccountId) { setError("Hãy chọn tài khoản nhận tiền"); return; }
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/payment-batches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tuitionFeeIds: selectedIds, paymentMethod: method, bankAccountId: method === "BANK_TRANSFER" ? bankAccountId : undefined, payerName: payerName || undefined, transactionReference: transactionReference || undefined }) });
      if (!response.ok) throw new Error(await extractApiErrorMessage(response, "Không thể tạo thanh toán"));
      const batch = await unwrapApiResponse<{ id: string; batchNo: string; status: string; receipt?: { id: string } | null }>(response);
      if (batch.status === "SUCCESS") { setReceiptId(batch.receipt?.id || null); setStep(3); return; }
      const qrResponse = await fetch(`/api/payment-batches/${batch.id}/qr`);
      if (!qrResponse.ok) throw new Error(await extractApiErrorMessage(qrResponse, "Không thể tạo QR thanh toán"));
      const qr = await unwrapApiResponse<{ qrUrl: string }>(qrResponse);
      setPendingBatch({ id: batch.id, batchNo: batch.batchNo, qrUrl: qr.qrUrl }); setStep(3);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Thanh toán thất bại"); }
    finally { setLoading(false); }
  }

  function reset() { setStep(0); setStudent(null); setStudentCode(""); setFees([]); setSelectedIds([]); setPendingBatch(null); setReceiptId(null); setError(""); }
  function selectStudent(item: StudentItem) { setStudent({ id: item.id, code: item.code, name: item.fullName }); setStudentCode(item.code); setError(""); studentDialog.onClose(); }

  return <Stack spacing={3} sx={{ width: "100%" }}>
    <Box><Typography variant="h4" fontWeight={700}>Thu học phí</Typography><Typography color="text.secondary">Gom nhiều khoản học phí của một học sinh và thanh toán trong một lần.</Typography></Box>
    <Paper sx={{ p: { xs: 1, md: 3 } }}><Stepper activeStep={step} alternativeLabel>{steps.map((label) => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}</Stepper></Paper>
    {error && <Alert severity="error">{error}</Alert>}

    {step === 0 && <Card><CardContent><Stack spacing={2} maxWidth={700}><Typography variant="h6">1. Tìm học sinh</Typography><Typography variant="body2" color="text.secondary">Chọn học sinh để xem các khoản chưa thanh toán.</Typography><MasterSelectField label="Học viên" value={student} onOpen={studentDialog.onOpen} required codeLabel="Mã học sinh" nameLabel="Họ tên" /><Button variant="contained" startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <SearchIcon />} onClick={() => void lookupStudent()} disabled={loading || !studentCode}>Tra cứu học phí</Button></Stack></CardContent></Card>}

    {step === 1 && <Card><CardContent><Stack spacing={2}><Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={1}><Box><Typography variant="h6">2. Chọn khoản phí</Typography><Typography color="text.secondary">{selectedStudent?.code} — {selectedStudent?.fullName}</Typography></Box><Button size="small" startIcon={<ArrowBackIcon />} onClick={() => setStep(0)}>Đổi học sinh</Button></Stack><Alert severity="info">Đã tìm thấy {fees.length} khoản cần thanh toán.</Alert><Stack>{fees.map((fee) => <Paper key={fee.id} variant="outlined" sx={{ p: 1, mb: 1, borderColor: selectedIds.includes(fee.id) ? "primary.main" : undefined }}><FormControlLabel control={<Checkbox checked={selectedIds.includes(fee.id)} onChange={() => setSelectedIds((current) => current.includes(fee.id) ? current.filter((id) => id !== fee.id) : [...current, fee.id])} />} label={<Box><Typography>{fee.feeNo} · {fee.class?.name || "Chưa có lớp"}</Typography><Typography variant="caption" color="text.secondary">{fee.dueDate ? `Hạn ${new Date(fee.dueDate).toLocaleDateString("vi-VN")}` : "Chưa có hạn"} · {money(Number(fee.finalAmount))}</Typography></Box>} /></Paper>)}</Stack><Divider /><Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "center" }} gap={1}><Typography>Đã chọn <strong>{selectedFees.length}</strong> khoản</Typography><Typography variant="h6" color="primary.main">{money(total)}</Typography><Button variant="contained" onClick={() => setStep(2)} disabled={!selectedIds.length}>Tiếp tục</Button></Stack></Stack></CardContent></Card>}

    {step === 2 && <Card><CardContent><Stack spacing={2} maxWidth={760}><Typography variant="h6">3. Xác nhận thanh toán</Typography><Paper variant="outlined" sx={{ p: 2 }}><Typography>{selectedStudent?.code} — {selectedStudent?.fullName}</Typography>{selectedFees.map((fee) => <Stack key={fee.id} direction="row" justifyContent="space-between"><Typography variant="body2">{fee.feeNo}</Typography><Typography variant="body2">{money(Number(fee.finalAmount))}</Typography></Stack>)}<Divider sx={{ my: 1 }} /><Stack direction="row" justifyContent="space-between"><Typography fontWeight={700}>Tổng thanh toán</Typography><Typography fontWeight={700} color="primary.main">{money(total)}</Typography></Stack></Paper><TextField select label="Phương thức thanh toán" value={method} onChange={(event) => setMethod(event.target.value)}><MenuItem value="CASH">Tiền mặt</MenuItem><MenuItem value="BANK_TRANSFER">Chuyển khoản / VietQR</MenuItem><MenuItem value="OTHER">Khác</MenuItem></TextField>{method === "BANK_TRANSFER" && <><FormControl fullWidth required><InputLabel id="bank-account-label">Tài khoản nhận tiền</InputLabel><Select labelId="bank-account-label" label="Tài khoản nhận tiền" value={bankAccountId} onChange={(event) => setBankAccountId(event.target.value)}><MenuItem value="">Chọn tài khoản nhận tiền</MenuItem>{bankAccounts.map((account) => <MenuItem key={account.id} value={account.id}>{account.bankName} — {account.accountNo} — {account.accountName}</MenuItem>)}</Select></FormControl><TextField label="Mã giao dịch (nếu có)" value={transactionReference} onChange={(event) => setTransactionReference(event.target.value)} /></>}<TextField label="Người nộp" value={payerName} onChange={(event) => setPayerName(event.target.value)} /><Stack direction="row" justifyContent="space-between"><Button startIcon={<ArrowBackIcon />} onClick={() => setStep(1)}>Quay lại</Button><Button variant="contained" onClick={() => void submitPayment()} disabled={loading}>{loading ? <CircularProgress size={20} color="inherit" /> : "Xác nhận thanh toán"}</Button></Stack></Stack></CardContent></Card>}

    {step === 3 && <Card><CardContent><Stack spacing={2} alignItems="center" textAlign="center"><Chip color={pendingBatch ? "warning" : "success"} label={pendingBatch ? "Đang chờ đối soát" : "Thanh toán thành công"} /><Typography variant="h6">{pendingBatch ? `Mã batch: ${pendingBatch.batchNo}` : "Đã ghi nhận toàn bộ khoản đã chọn"}</Typography>{pendingBatch && <><Alert severity="info">Nội dung chuyển khoản cần có mã batch <strong>{pendingBatch.batchNo}</strong>.</Alert><Box component="img" src={pendingBatch.qrUrl} alt="QR chuyển khoản" sx={{ width: 260, height: 260 }} /><Button variant="outlined" href={`/api/payment-batches/${pendingBatch.id}/notice/pdf`}>Xuất thông báo tổng</Button></>}{receiptId && <Button variant="outlined" onClick={() => window.open(`/api/payment-batch-receipts/${receiptId}/pdf`, "_blank", "noopener,noreferrer")}>Xuất biên lai tổng</Button>}<Button onClick={reset}>Thu học phí cho học sinh khác</Button></Stack></CardContent></Card>}
    <StudentSelectDialog open={studentDialog.open} onClose={studentDialog.onClose} onSelect={selectStudent} />
  </Stack>;
}
