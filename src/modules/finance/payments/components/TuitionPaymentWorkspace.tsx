"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  FormHelperText,
  InputLabel,
  FormControlLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import SearchIcon from "@mui/icons-material/Search";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import { ConfirmDialog } from "@/components/shared/dialogs/ConfirmDialog";
import {
  MasterSelectField,
  type MasterSelectValue,
} from "@/components/shared/forms/MasterSelectField";
import {
  StudentSelectDialog,
  type StudentItem,
} from "@/components/shared/dialogs/StudentSelectDialog";
import { AppTextField } from "@/components/shared/forms/AppTextField";
import { useDisclosure } from "@/hooks/useDisclosure";
import { useSnackbar } from "@/hooks/useSnackbar";
import { extractApiErrorMessage, unwrapApiResponse } from "@/lib/api-client";

type Fee = {
  id: string;
  feeNo: string;
  finalAmount: number;
  dueDate?: string | null;
  status: string;
  student?: { code: string; fullName: string } | null;
  class?: { name: string } | null;
  paymentAllocations?: Array<{
    paymentBatch: { batchNo: string; status: string };
  }>;
};
type BankAccount = {
  id: string;
  bankCode: string;
  bankName: string;
  accountNo: string;
  accountName: string;
};
type PendingBatch = {
  id: string;
  batchNo: string;
  amount: number;
  account: BankAccount;
  qrUrl: string;
};
const steps = ["Tìm học sinh", "Chọn khoản phí", "Xác nhận thanh toán", "Hoàn tất"];
const feeStatusLabels: Record<string, string> = {
  UNPAID: "Chưa thanh toán",
  OVERDUE: "Quá hạn",
};
const feeStatusColors: Record<string, "warning" | "error"> = {
  UNPAID: "warning",
  OVERDUE: "error",
};
const money = (value: number) =>
  `${new Intl.NumberFormat("vi-VN").format(value)} ₫`;

export function TuitionPaymentWorkspace({
  initialTuitionFeeId,
}: {
  initialTuitionFeeId?: string;
}) {
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
  const [bankAccountsLoading, setBankAccountsLoading] = useState(false);
  const [bankAccountsError, setBankAccountsError] = useState("");
  const [bankAccountError, setBankAccountError] = useState("");
  const [pendingBatch, setPendingBatch] = useState<PendingBatch | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const studentDialog = useDisclosure();
  const { showSuccess, showError, Snackbar } = useSnackbar();
  const selectedFees = fees.filter((fee) => selectedIds.includes(fee.id));
  const total = useMemo(
    () => selectedFees.reduce((sum, fee) => sum + Number(fee.finalAmount), 0),
    [selectedFees],
  );
  const selectedStudent = fees[0]?.student;

  const loadBankAccounts = useCallback(async () => {
    setBankAccountsLoading(true);
    setBankAccountsError("");
    try {
      const response = await fetch("/api/bank-accounts");
      if (!response.ok) {
        throw new Error(
          await extractApiErrorMessage(
            response,
            "Không thể tải tài khoản ngân hàng",
          ),
        );
      }
      setBankAccounts(await unwrapApiResponse<BankAccount[]>(response));
    } catch (reason) {
      setBankAccounts([]);
      setBankAccountsError(
        reason instanceof Error
          ? reason.message
          : "Không thể tải tài khoản ngân hàng",
      );
    } finally {
      setBankAccountsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBankAccounts();
  }, [loadBankAccounts]);

  useEffect(() => {
    if (!initialTuitionFeeId) return;
    void fetch(`/api/tuition-fees/${initialTuitionFeeId}`)
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            await extractApiErrorMessage(
              response,
              "Không thể tải khoản học phí",
            ),
          );
        return unwrapApiResponse<
          Fee & { student: { id: string; code: string; fullName: string } }
        >(response);
      })
      .then((fee) => {
        if (fee.status !== "UNPAID" && fee.status !== "OVERDUE")
          throw new Error("Khoản học phí này không còn cần thanh toán");
        const pendingBatchNo =
          fee.paymentAllocations?.[0]?.paymentBatch.batchNo;
        if (pendingBatchNo)
          throw new Error(
            `Khoản học phí đang chờ thanh toán trong đợt ${pendingBatchNo}`,
          );
        setStudent({
          id: fee.student.id,
          code: fee.student.code,
          name: fee.student.fullName,
        });
        setStudentCode(fee.student.code);
        setFees([fee]);
        setSelectedIds([fee.id]);
        setStep(1);
      })
      .catch((reason) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "Không thể tải khoản học phí",
        ),
      );
  }, [initialTuitionFeeId]);

  async function lookupStudent() {
    if (!studentCode) {
      setError("Mã học sinh là bắt buộc");
      return;
    }
    setLoading(true);
    setError("");
    setPendingBatch(null);
    setReceiptId(null);
    try {
      const response = await fetch(
        `/api/tuition-fees?studentCode=${encodeURIComponent(studentCode)}&pageSize=100`,
      );
      if (!response.ok)
        throw new Error(
          await extractApiErrorMessage(response, "Không thể tải học phí"),
        );
      const result = await unwrapApiResponse<{ items: Fee[]; pagination?: { totalPages: number } }>(response);
      const totalPages = result.pagination?.totalPages ?? 1;
      const remainingPages = await Promise.all(
        Array.from({ length: Math.max(totalPages - 1, 0) }, (_, index) =>
          fetch(`/api/tuition-fees?studentCode=${encodeURIComponent(studentCode)}&page=${index + 2}&pageSize=100`).then(async (pageResponse) => {
            if (!pageResponse.ok) throw new Error(await extractApiErrorMessage(pageResponse, "Không thể tải đầy đủ học phí"));
            return unwrapApiResponse<{ items: Fee[] }>(pageResponse);
          }),
        ),
      );
      const allFees = [result.items, ...remainingPages.map((page) => page.items)].flat();
      const unpaid = allFees.filter(
        (fee) => fee.status === "UNPAID" || fee.status === "OVERDUE",
      );
      setFees(unpaid);
      setSelectedIds([]);
      if (!unpaid.length) {
        setError("Học sinh không còn khoản học phí cần thanh toán");
        return;
      }
      setStep(1);
    } catch (reason) {
      setFees([]);
      setSelectedIds([]);
      setError(
        reason instanceof Error ? reason.message : "Không thể tải học phí",
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadPendingQr(batch: {
    id: string;
    batchNo: string;
    amount: number;
    account: BankAccount;
  }) {
    setQrLoading(true);
    setQrError("");
    try {
      const qrResponse = await fetch(`/api/payment-batches/${batch.id}/qr`);
      if (!qrResponse.ok) {
        throw new Error(
          await extractApiErrorMessage(
            qrResponse,
            "Không thể tạo QR thanh toán",
          ),
        );
      }
      const qr = await unwrapApiResponse<{
        qrUrl: string;
        amount: number;
        account: BankAccount;
      }>(qrResponse);
      setPendingBatch({
        ...batch,
        amount: Number(qr.amount),
        account: qr.account,
        qrUrl: qr.qrUrl,
      });
    } catch (reason) {
      setQrError(
        reason instanceof Error
          ? reason.message
          : "Không thể tạo QR thanh toán",
      );
    } finally {
      setQrLoading(false);
    }
  }

  async function submitPayment() {
    if (!selectedIds.length) {
      setError("Hãy chọn ít nhất một khoản học phí");
      setStep(1);
      return;
    }
    if (method === "BANK_TRANSFER" && !bankAccountId) {
      setBankAccountError("Hãy chọn tài khoản nhận tiền");
      return;
    }
    setConfirmOpen(false);
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/payment-batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tuitionFeeIds: selectedIds,
          paymentMethod: method,
          bankAccountId: method === "BANK_TRANSFER" ? bankAccountId : undefined,
          payerName: payerName || undefined,
          transactionReference: transactionReference || undefined,
        }),
      });
      if (!response.ok)
        throw new Error(
          await extractApiErrorMessage(response, "Không thể tạo thanh toán"),
        );
      const batch = await unwrapApiResponse<{
        id: string;
        batchNo: string;
        status: string;
        totalAmount: number;
        receipt?: { id: string } | null;
      }>(response);
      if (batch.status === "SUCCESS") {
        setReceiptId(batch.receipt?.id || null);
        setStep(3);
        showSuccess("Đã ghi nhận thanh toán và phát hành biên lai");
        return;
      }
      setPendingBatch({
        id: batch.id,
        batchNo: batch.batchNo,
        amount: Number(batch.totalAmount),
        account:
          bankAccounts.find((account) => account.id === bankAccountId) ?? {
            id: bankAccountId,
            bankCode: "",
            bankName: "",
            accountNo: "",
            accountName: "",
          },
        qrUrl: "",
      });
      setStep(3);
      await loadPendingQr({
        id: batch.id,
        batchNo: batch.batchNo,
        amount: Number(batch.totalAmount),
        account:
          bankAccounts.find((account) => account.id === bankAccountId) ?? {
            id: bankAccountId,
            bankCode: "",
            bankName: "",
            accountNo: "",
            accountName: "",
          },
      });
      showSuccess("Đã tạo đợt chuyển khoản. Chờ đối soát sau khi nhận tiền");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Thanh toán thất bại",
      );
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setStep(0);
    setStudent(null);
    setStudentCode("");
    setFees([]);
    setSelectedIds([]);
    setPendingBatch(null);
    setReceiptId(null);
    setError("");
    setMethod("CASH");
    setPayerName("");
    setTransactionReference("");
    setBankAccountId("");
    setBankAccountError("");
    setQrError("");
  }
  function selectStudent(item: StudentItem) {
    setStudent({ id: item.id, code: item.code, name: item.fullName });
    setStudentCode(item.code);
    setFees([]);
    setSelectedIds([]);
    setPendingBatch(null);
    setReceiptId(null);
    setError("");
    studentDialog.onClose();
  }

  function requestPaymentConfirmation() {
    if (!selectedIds.length) {
      setError("Hãy chọn ít nhất một khoản học phí");
      setStep(1);
      return;
    }
    if (method === "BANK_TRANSFER" && !bankAccountId) {
      setBankAccountError("Hãy chọn tài khoản nhận tiền");
      return;
    }
    setBankAccountError("");
    setConfirmOpen(true);
  }

  async function copyTransferContent() {
    if (!pendingBatch) return;
    try {
      await navigator.clipboard.writeText(`PB ${pendingBatch.batchNo}`);
      showSuccess("Đã sao chép nội dung chuyển khoản");
    } catch {
      showError("Không thể sao chép tự động. Vui lòng nhập: PB " + pendingBatch.batchNo);
    }
  }

  return (
    <Stack spacing={{ xs: 2, md: 3 }} sx={{ width: "100%" }}>
      <Box>
        <Typography variant="h4" fontWeight={700}>
          Thu học phí
        </Typography>
        <Typography color="text.secondary">
          Gom nhiều khoản học phí của một học sinh và thanh toán trong một lần.
        </Typography>
      </Box>
      <Paper sx={{ p: { xs: 1, md: 3 } }}>
        <Stepper activeStep={step} alternativeLabel>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Paper>
      {error && <Alert severity="error">{error}</Alert>}

      {step === 0 && (
        <Card>
          <CardContent>
            <Stack spacing={2} maxWidth={700}>
              <Typography variant="h6">1. Tìm học sinh</Typography>
              <Typography variant="body2" color="text.secondary">
                Chọn học sinh để xem các khoản chưa thanh toán.
              </Typography>
              <MasterSelectField
                label="Học viên"
                value={student}
                onOpen={studentDialog.onOpen}
                required
                codeLabel="Mã học sinh"
                nameLabel="Họ tên"
              />
              <Button
                variant="contained"
                startIcon={
                  loading ? (
                    <CircularProgress size={18} color="inherit" />
                  ) : (
                    <SearchIcon />
                  )
                }
                onClick={() => void lookupStudent()}
                disabled={loading || !studentCode}
              >
                Tra cứu học phí
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                justifyContent="space-between"
                gap={1}
              >
                <Box>
                  <Typography variant="h6">2. Chọn khoản phí</Typography>
                  <Typography color="text.secondary">
                    {selectedStudent?.code} — {selectedStudent?.fullName}
                  </Typography>
                </Box>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<ArrowBackIcon />}
                  onClick={() => setStep(0)}
                >
                  Đổi học sinh
                </Button>
              </Stack>
              <Alert severity="info">
                Có{" "}
                {fees.filter((fee) => !fee.paymentAllocations?.length).length}{" "}
                khoản có thể chọn trong tổng số {fees.length} khoản. Khoản đang
                chờ đối soát hoặc đã thanh toán sẽ bị khóa.
              </Alert>
              <Stack>
                {fees.map((fee) => {
                  const locked = Boolean(fee.paymentAllocations?.length);
                  const batchNo =
                    fee.paymentAllocations?.[0]?.paymentBatch.batchNo;
                  return (
                    <Paper
                      key={fee.id}
                      variant="outlined"
                      sx={{
                        p: 1,
                        mb: 1,
                        borderColor: selectedIds.includes(fee.id)
                          ? "primary.main"
                          : undefined,
                        opacity: locked ? 0.65 : 1,
                      }}
                    >
                      <FormControlLabel
                        control={
                          <Checkbox
                            disabled={locked}
                            checked={selectedIds.includes(fee.id)}
                            onChange={() =>
                              setSelectedIds((current) =>
                                current.includes(fee.id)
                                  ? current.filter((id) => id !== fee.id)
                                  : [...current, fee.id],
                              )
                            }
                          />
                        }
                        label={
                          <Box>
                            <Stack
                              direction={{ xs: "column", sm: "row" }}
                              spacing={0.75}
                              alignItems={{ sm: "center" }}
                            >
                              <Typography>
                                {fee.feeNo} · {fee.class?.name || "Chưa có lớp"}
                              </Typography>
                              {!locked && (
                                <Chip
                                  size="small"
                                  color={feeStatusColors[fee.status] || "warning"}
                                  label={feeStatusLabels[fee.status] || fee.status}
                                />
                              )}
                            </Stack>
                            <Typography
                              variant="caption"
                              color={locked ? "warning.main" : "text.secondary"}
                            >
                              {locked
                                ? `Đang chờ thanh toán trong đợt ${batchNo}`
                                : `${fee.dueDate ? `Hạn ${new Date(fee.dueDate).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}` : "Chưa có hạn"} · ${money(Number(fee.finalAmount))}`}
                            </Typography>
                          </Box>
                        }
                      />
                    </Paper>
                  );
                })}
              </Stack>
              <Divider />
              <Stack
                direction={{ xs: "column", sm: "row" }}
                justifyContent="space-between"
                alignItems={{ xs: "stretch", sm: "center" }}
                gap={1}
              >
                <Typography>
                  Đã chọn <strong>{selectedFees.length}</strong> khoản
                </Typography>
                <Typography variant="h6" color="primary.main">
                  {money(total)}
                </Typography>
                <Button
                  variant="contained"
                  onClick={() => setStep(2)}
                  disabled={!selectedIds.length}
                >
                  Tiếp tục
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardContent>
            <Stack spacing={2} maxWidth={760}>
              <Typography variant="h6">3. Xác nhận thanh toán</Typography>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography>
                  {selectedStudent?.code} — {selectedStudent?.fullName}
                </Typography>
                {selectedFees.map((fee) => (
                  <Stack
                    key={fee.id}
                    direction="row"
                    justifyContent="space-between"
                  >
                    <Typography variant="body2">{fee.feeNo}</Typography>
                    <Typography variant="body2">
                      {money(Number(fee.finalAmount))}
                    </Typography>
                  </Stack>
                ))}
                <Divider sx={{ my: 1 }} />
                <Stack direction="row" justifyContent="space-between">
                  <Typography fontWeight={700}>Tổng thanh toán</Typography>
                  <Typography fontWeight={700} color="primary.main">
                    {money(total)}
                  </Typography>
                </Stack>
              </Paper>
              <AppTextField
                select
                fullWidth
                label="Phương thức thanh toán"
                value={method}
                onChange={(event) => {
                  setMethod(event.target.value);
                  setBankAccountError("");
                  if (event.target.value === "CASH") setBankAccountId("");
                }}
              >
                <MenuItem value="CASH">Tiền mặt</MenuItem>
                <MenuItem value="BANK_TRANSFER">Chuyển khoản / VietQR</MenuItem>
              </AppTextField>
              {method === "BANK_TRANSFER" && (
                <>
                  {bankAccountsError && (
                    <Alert
                      severity="error"
                      action={
                        <Button
                          color="inherit"
                          size="small"
                          onClick={() => void loadBankAccounts()}
                          disabled={bankAccountsLoading}
                        >
                          Thử lại
                        </Button>
                      }
                    >
                      {bankAccountsError}
                    </Alert>
                  )}
                  <FormControl fullWidth required>
                    <InputLabel id="bank-account-label">
                      Tài khoản nhận tiền
                    </InputLabel>
                    <Select
                      labelId="bank-account-label"
                      label="Tài khoản nhận tiền"
                      value={bankAccountId}
                      onChange={(event) => {
                        setBankAccountId(event.target.value);
                        setBankAccountError("");
                      }}
                      error={Boolean(bankAccountError)}
                    >
                      <MenuItem value="">
                        {bankAccountsLoading
                          ? "Đang tải tài khoản..."
                          : "Chọn tài khoản nhận tiền"}
                      </MenuItem>
                      {!bankAccountsLoading &&
                        !bankAccountsError &&
                        !bankAccounts.length && (
                          <MenuItem value="" disabled>
                            Chưa cấu hình tài khoản nhận tiền
                          </MenuItem>
                        )}
                      {bankAccounts.map((account) => (
                        <MenuItem key={account.id} value={account.id}>
                          {account.bankName} — {account.accountNo} —{" "}
                          {account.accountName}
                        </MenuItem>
                      ))}
                    </Select>
                    <FormHelperText error={Boolean(bankAccountError)}>
                      {bankAccountError ||
                        "Chỉ chọn tài khoản đang hoạt động của trung tâm"}
                    </FormHelperText>
                  </FormControl>
                  <AppTextField
                    fullWidth
                    label="Mã giao dịch (nếu có)"
                    value={transactionReference}
                    onChange={(event) =>
                      setTransactionReference(event.target.value)
                    }
                  />
                </>
              )}
              <AppTextField
                fullWidth
                label="Người nộp"
                value={payerName}
                onChange={(event) => setPayerName(event.target.value)}
              />
              <Stack direction="row" justifyContent="space-between">
                <Button
                  variant="outlined"
                  startIcon={<ArrowBackIcon />}
                  onClick={() => setStep(1)}
                >
                  Quay lại
                </Button>
                <Button
                  variant="contained"
                  onClick={requestPaymentConfirmation}
                  disabled={loading || qrLoading}
                >
                  {loading ? (
                    <CircularProgress size={20} color="inherit" />
                  ) : (
                    "Xác nhận thanh toán toàn bộ"
                  )}
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardContent>
            <Stack spacing={2} alignItems="center" textAlign="center">
              <Chip
                color={pendingBatch ? "warning" : "success"}
                label={
                  pendingBatch ? "Đang chờ đối soát" : "Thanh toán thành công"
                }
              />
              <Typography variant="h6">
                {pendingBatch
                  ? `Mã đợt thanh toán: ${pendingBatch.batchNo}`
                  : "Đã ghi nhận toàn bộ khoản đã chọn"}
              </Typography>
              {pendingBatch && (
                <>
                  <Alert severity="info" sx={{ width: "100%", textAlign: "left" }}>
                    Đây là phiếu báo thanh toán, chưa phải biên lai. Chỉ chuyển đúng số tiền và nội dung bên dưới.
                  </Alert>
                  <Paper variant="outlined" sx={{ width: "100%", p: 2, textAlign: "left" }}>
                    <Stack spacing={0.75}>
                      <Typography><strong>Ngân hàng:</strong> {pendingBatch.account.bankName || "-"}</Typography>
                      <Typography><strong>Số tài khoản:</strong> {pendingBatch.account.accountNo || "-"}</Typography>
                      <Typography><strong>Chủ tài khoản:</strong> {pendingBatch.account.accountName || "-"}</Typography>
                      <Typography><strong>Số tiền:</strong> {money(pendingBatch.amount)}</Typography>
                      <Typography sx={{ overflowWrap: "anywhere" }}>
                        <strong>Nội dung chuyển khoản:</strong> PB {pendingBatch.batchNo}
                      </Typography>
                    </Stack>
                  </Paper>
                  {qrError && (
                    <Alert
                      severity="error"
                      sx={{ width: "100%" }}
                      action={
                        <Button
                          color="inherit"
                          size="small"
                          onClick={() => void loadPendingQr(pendingBatch)}
                          disabled={qrLoading}
                        >
                          Thử lại
                        </Button>
                      }
                    >
                      {qrError}
                    </Alert>
                  )}
                  {qrLoading ? (
                    <Stack alignItems="center" spacing={1} sx={{ py: 3 }}>
                      <CircularProgress />
                      <Typography color="text.secondary">Đang tạo QR thanh toán...</Typography>
                    </Stack>
                  ) : pendingBatch.qrUrl ? (
                    <Box
                      component="img"
                      src={pendingBatch.qrUrl}
                      alt={`QR chuyển khoản đợt ${pendingBatch.batchNo}`}
                      sx={{ width: 260, height: 260, border: "1px solid", borderColor: "divider" }}
                    />
                  ) : null}
                  <Typography variant="body2" color="text.secondary">
                    Nếu số tiền hoặc khoản phí thay đổi, hãy tạo lại đợt thanh toán và QR mới.
                  </Typography>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                    <Button
                      variant="outlined"
                      startIcon={<ContentCopyOutlinedIcon />}
                      onClick={() => void copyTransferContent()}
                    >
                      Sao chép nội dung
                    </Button>
                    {pendingBatch.qrUrl && (
                      <Button
                        component="a"
                        href={pendingBatch.qrUrl}
                        download={`qr-${pendingBatch.batchNo}.png`}
                        target="_blank"
                        rel="noopener noreferrer"
                        variant="outlined"
                        startIcon={<DownloadOutlinedIcon />}
                      >
                        Tải QR
                      </Button>
                    )}
                    <Button
                      variant="outlined"
                      href={`/api/payment-batches/${pendingBatch.id}/notice/pdf`}
                      startIcon={<DownloadOutlinedIcon />}
                    >
                      Tải thông báo PDF
                    </Button>
                    <Button
                      variant="contained"
                      href={`/api/payment-batches/${pendingBatch.id}/notice/pdf?inline=1`}
                      target="_blank"
                      rel="noopener noreferrer"
                      startIcon={<PrintOutlinedIcon />}
                    >
                      Mở để in
                    </Button>
                  </Stack>
                </>
              )}
              {receiptId && (
                <Button
                  variant="outlined"
                  onClick={() =>
                    window.open(
                      `/api/payment-batch-receipts/${receiptId}/pdf`,
                      "_blank",
                      "noopener,noreferrer",
                    )
                  }
                >
                  Xuất biên lai tổng
                </Button>
              )}
              {!pendingBatch && (
                <Alert severity="success" sx={{ width: "100%", textAlign: "left" }}>
                  Thanh toán đã hoàn tất và biên lai đã được phát hành. Vui lòng xuất hoặc in biên lai để lưu hồ sơ.
                </Alert>
              )}
              <Button variant="outlined" onClick={reset}>Thu học phí cho học sinh khác</Button>
            </Stack>
          </CardContent>
        </Card>
      )}
      <StudentSelectDialog
        open={studentDialog.open}
        onClose={studentDialog.onClose}
        onSelect={selectStudent}
      />
      <ConfirmDialog
        open={confirmOpen}
        title="Xác nhận thu học phí"
        message="Bạn có chắc muốn ghi nhận toàn bộ các khoản học phí đã chọn? Thao tác này sẽ tạo giao dịch; thanh toán tiền mặt hoàn tất ngay, còn chuyển khoản sẽ chờ đối soát."
        content={
          <Stack spacing={0.5} sx={{ mt: 2 }}>
            <Typography variant="body2">
              Học viên: <strong>{selectedStudent?.fullName || "-"}</strong>
            </Typography>
            <Typography variant="body2">
              Số khoản: <strong>{selectedFees.length}</strong>
            </Typography>
            <Typography variant="body2">
              Tổng tiền: <strong>{money(total)}</strong>
            </Typography>
            <Typography variant="body2">
              Phương thức: <strong>{method === "CASH" ? "Tiền mặt" : "Chuyển khoản / VietQR"}</strong>
            </Typography>
          </Stack>
        }
        onConfirm={() => void submitPayment()}
        onCancel={() => setConfirmOpen(false)}
        isLoading={loading}
        confirmLabel="Ghi nhận thanh toán"
        cancelLabel="Quay lại"
        confirmColor="primary"
      />
      {Snackbar}
    </Stack>
  );
}
