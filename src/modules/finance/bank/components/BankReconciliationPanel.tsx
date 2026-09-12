"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { extractApiErrorMessage, unwrapApiResponse } from "@/lib/api-client";
import { ConfirmDialog } from "@/components/shared/dialogs/ConfirmDialog";
import AccountBalanceOutlinedIcon from "@mui/icons-material/AccountBalanceOutlined";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import { useSnackbar } from "@/hooks/useSnackbar";

type Account = {
  id: string;
  bankName: string;
  accountNo: string;
  accountName: string;
};
type Batch = {
  id: string;
  batchNo: string;
  totalAmount: number;
  student: { code: string; fullName: string };
  allocations: Array<{
    tuitionFeeId: string;
    amount: number;
    tuitionFee: { feeNo: string };
  }>;
};
type Transaction = {
  confirmationToken: string;
  rowNo: number;
  transactionDate: string;
  bankTransactionNo: string | null;
  description: string;
  creditAmount: number;
  debitAmount: number;
  reconciliationStatus: string;
  paymentBatch?: Batch | null;
  paymentBatchCandidates: Array<Batch & { confirmationToken: string }>;
};
type ImportResult = {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicatedRows: number;
  matchedRows: number;
  unmatchedRows: number;
  ignoredRows: number;
  items: Transaction[];
};
type PendingConfirmation = {
  body: { confirmationToken: string; batchId: string };
  itemToken: string;
  title: string;
  message: string;
};
type ResultFilter =
  | "ALL"
  | "AUTO_MATCHED"
  | "UNMATCHED"
  | "IGNORED"
  | "DUPLICATED"
  | "CONFIRMED";

const money = (value: number) =>
  new Intl.NumberFormat("vi-VN").format(Number(value));
const formatTransactionDate = (value: string) => {
  const date = new Date(value);
  const datePart = date.toLocaleDateString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const timePart = date.toLocaleTimeString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  return `${datePart} ${timePart}`;
};
const steps = ["Chọn tài khoản và file", "Phân tích", "Đối soát"];
const reconciliationLabels: Record<string, string> = {
  AUTO_MATCHED: "Tự động khớp",
  UNMATCHED: "Chưa khớp",
  IGNORED: "Bỏ qua",
  DUPLICATED: "Trùng giao dịch",
  CONFIRMED: "Đã xác nhận",
};
const reconciliationColors: Record<string, "default" | "warning" | "info" | "success"> = {
  AUTO_MATCHED: "info",
  UNMATCHED: "warning",
  CONFIRMED: "success",
};

export function BankReconciliationPanel() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState(0);
  const [items, setItems] = useState<Transaction[]>([]);
  const [confirmedTokens, setConfirmedTokens] = useState<Set<string>>(
    () => new Set(),
  );
  const [message, setMessage] = useState<{
    text: string;
    severity: "success" | "error" | "info";
  }>({ text: "", severity: "info" });
  const [loading, setLoading] = useState(false);
  const [hasAnalysis, setHasAnalysis] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] =
    useState<PendingConfirmation | null>(null);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountError, setAccountError] = useState("");
  const [resultFilter, setResultFilter] = useState<ResultFilter>("ALL");
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const { showSuccess, showError, Snackbar } = useSnackbar();

  const loadAccounts = useCallback(async () => {
    setAccountsLoading(true);
    setAccountError("");
    try {
      const response = await fetch("/api/bank-accounts");
      if (!response.ok) {
        throw new Error(
          await extractApiErrorMessage(response, "Không thể tải tài khoản ngân hàng"),
        );
      }
      const data = await unwrapApiResponse<Account[]>(response);
      setAccounts(data);
      setAccountId((current) =>
        data.some((account) => account.id === current) ? current : data[0]?.id || "",
      );
    } catch (reason) {
      setAccountError(
        reason instanceof Error ? reason.message : "Không thể tải tài khoản ngân hàng",
      );
    } finally {
      setAccountsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  const displayedItems = useMemo(
    () =>
      items.map((item) =>
        confirmedTokens.has(item.confirmationToken)
          ? { ...item, reconciliationStatus: "CONFIRMED" }
          : item,
      ),
    [confirmedTokens, items],
  );

  const filteredItems = useMemo(
    () =>
      resultFilter === "ALL"
        ? displayedItems
        : displayedItems.filter((item) => item.reconciliationStatus === resultFilter),
    [displayedItems, resultFilter],
  );

  const summary = useMemo(
    () => ({
      total: displayedItems.length,
      matched: displayedItems.filter((item) => item.reconciliationStatus === "AUTO_MATCHED").length,
      unmatched: displayedItems.filter((item) => item.reconciliationStatus === "UNMATCHED").length,
      ignored: displayedItems.filter((item) => item.reconciliationStatus === "IGNORED").length,
      duplicated: displayedItems.filter((item) => item.reconciliationStatus === "DUPLICATED").length,
      confirmed: displayedItems.filter((item) => item.reconciliationStatus === "CONFIRMED").length,
      creditAmount: displayedItems.reduce((total, item) => total + item.creditAmount, 0),
    }),
    [displayedItems],
  );

  function inspectFile(nextFile: File | null) {
    setFile(nextFile);
    if (nextFile) setStep(1);
  }

  function resetSession() {
    setFile(null);
    setItems([]);
    setConfirmedTokens(new Set());
    setHasAnalysis(false);
    setPendingConfirmation(null);
    setResultFilter("ALL");
    setStep(0);
    setMessage({ text: "", severity: "info" });
    setResetDialogOpen(false);
  }

  async function importFile() {
    if (!file || !accountId) {
      setMessage({
        text: "Chọn tài khoản ngân hàng và file Excel sao kê",
        severity: "error",
      });
      return;
    }
    setLoading(true);
    const form = new FormData();
    form.append("file", file);
    form.append("bankAccountId", accountId);
    try {
      const response = await fetch("/api/bank-statement-imports", {
        method: "POST",
        body: form,
      });
      if (!response.ok)
        throw new Error(
          await extractApiErrorMessage(response, "Không thể phân tích sao kê"),
        );
      const result = await unwrapApiResponse<ImportResult>(response);
      setItems(result.items);
      setHasAnalysis(true);
      setResultFilter("ALL");
      setFile(null);
      setStep(2);
      setMessage({
        text: `Đã phân tích ${result.validRows} dòng. Khớp ${result.matchedRows}, chưa khớp ${result.unmatchedRows}, bỏ qua ${result.ignoredRows}, trùng ${result.duplicatedRows}. Chỉ dòng được xác nhận mới được lưu.`,
        severity: "success",
      });
    } catch (reason) {
      setMessage({
        text:
          reason instanceof Error
            ? reason.message
            : "Không thể phân tích sao kê",
        severity: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  function requestConfirm(
    item: Transaction,
    selection: { batchId: string },
    title: string,
    message: string,
    confirmationToken = item.confirmationToken,
  ) {
    setPendingConfirmation({
      body: { confirmationToken, ...selection },
      itemToken: item.confirmationToken,
      title,
      message,
    });
  }

  async function confirm() {
    if (!pendingConfirmation) return;
    setLoading(true);
    try {
      const response = await fetch("/api/bank-reconciliations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pendingConfirmation.body),
      });
      if (!response.ok)
        throw new Error(
          await extractApiErrorMessage(response, "Không thể xác nhận đối soát"),
        );
      const token = pendingConfirmation.itemToken;
      setConfirmedTokens((current) => new Set(current).add(token));
      setMessage({
        text: "Đã xác nhận đối soát và tạo thanh toán/biên lai.",
        severity: "success",
      });
      showSuccess("Đã xác nhận đối soát và tạo thanh toán/biên lai");
      setPendingConfirmation(null);
    } catch (reason) {
      setMessage({
        text:
          reason instanceof Error
            ? reason.message
            : "Không thể xác nhận đối soát",
        severity: "error",
      });
      showError(
        reason instanceof Error ? reason.message : "Không thể xác nhận đối soát",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Stack spacing={{ xs: 2, md: 3 }}>
      <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box sx={{ width: 44, height: 44, borderRadius: 2, display: "grid", placeItems: "center", bgcolor: "primary.main", color: "primary.contrastText" }}>
            <AccountBalanceOutlinedIcon />
          </Box>
          <Box>
            <Typography variant="h5" fontWeight={700}>Phân tích và đối soát sao kê</Typography>
            <Typography variant="body2" color="text.secondary">Chỉ giao dịch được xác nhận mới tạo thanh toán và biên lai.</Typography>
          </Box>
        </Stack>
      </Paper>
      <Paper sx={{ p: { xs: 1, md: 2 } }}>
        <Stepper activeStep={step} alternativeLabel>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Paper>
      <Paper sx={{ p: { xs: 1.5, md: 2 } }}>
        <Stack spacing={2}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            alignItems="center"
          >
            <FormControl fullWidth sx={{ minWidth: { md: 300 }, flex: 1 }}>
              <InputLabel id="reconciliation-bank-account-label">Tài khoản nhận</InputLabel>
              <Select
                labelId="reconciliation-bank-account-label"
                value={accountId}
                label="Tài khoản nhận"
                onChange={(event) => setAccountId(event.target.value)}
                disabled={accountsLoading || !accounts.length || loading || items.length > 0}
              >
                {accounts.map((account) => (
                  <MenuItem key={account.id} value={account.id}>
                    {account.bankName} — {account.accountNo}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              variant="outlined"
              component="label"
              startIcon={<UploadFileOutlinedIcon />}
              disabled={loading || items.length > 0}
            >
              {file?.name || "Chọn file Excel sao kê"}
              <input
                hidden
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(event) =>
                  inspectFile(event.target.files?.[0] || null)
                }
              />
            </Button>
          </Stack>
          {accountsLoading && <Alert severity="info">Đang tải tài khoản ngân hàng...</Alert>}
          {accountError && (
            <Alert
              severity="error"
              action={
                <Button color="inherit" size="small" onClick={() => void loadAccounts()}>
                  Thử lại
                </Button>
              }
            >
              {accountError}
            </Alert>
          )}
          {!accountsLoading && !accountError && !accounts.length && (
            <Alert severity="warning">Chưa có tài khoản ngân hàng đang hoạt động để đối soát.</Alert>
          )}
          {file && (
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={2}
              alignItems="center"
            >
              <Typography>
                Đã chọn {file.name}. Có thể phân tích ngay.
              </Typography>
              <Button
                variant="contained"
                onClick={() => void importFile()}
                disabled={loading || !accountId}
              >
                {loading ? "Đang phân tích..." : "Phân tích sao kê"}
              </Button>
            </Stack>
          )}
          {message.text && (
            <Alert severity={message.severity}>{message.text}</Alert>
          )}
        </Stack>
      </Paper>
      <Paper sx={{ overflow: "hidden" }}>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} gap={0.5} sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>Kết quả phân tích</Typography>
            <Typography variant="body2" color="text.secondary">
              {items.length
                ? `${items.length} giao dịch trong phiên · ${money(summary.creditAmount)} VND ghi có`
                : "Chưa có giao dịch trong phiên"}
            </Typography>
          </Box>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
            {items.length > 0 && (
              <Button
                size="small"
                variant="outlined"
                startIcon={<RefreshOutlinedIcon />}
                onClick={() => setResetDialogOpen(true)}
                disabled={loading}
              >
                Phiên mới
              </Button>
            )}
            {items.length > 0 && <Chip size="small" color="warning" label={`${summary.unmatched} chưa khớp`} />}
          </Stack>
        </Stack>
        {items.length > 0 && (
          <Stack direction={{ xs: "column", md: "row" }} spacing={1} sx={{ px: 2, pb: 2 }}>
            <Chip size="small" variant="outlined" label={`Tất cả: ${summary.total}`} />
            <Chip size="small" color="info" variant="outlined" label={`Khớp tự động: ${summary.matched}`} />
            <Chip size="small" color="warning" variant="outlined" label={`Cần kiểm tra: ${summary.unmatched}`} />
            <Chip size="small" variant="outlined" label={`Bỏ qua: ${summary.ignored}`} />
            <Chip size="small" variant="outlined" label={`Trùng: ${summary.duplicated}`} />
            <Chip size="small" color="success" variant="outlined" label={`Đã xác nhận: ${summary.confirmed}`} />
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel id="reconciliation-result-filter-label">Lọc trạng thái</InputLabel>
              <Select
                labelId="reconciliation-result-filter-label"
                value={resultFilter}
                label="Lọc trạng thái"
                onChange={(event) => setResultFilter(event.target.value as ResultFilter)}
              >
                <MenuItem value="ALL">Tất cả</MenuItem>
                <MenuItem value="AUTO_MATCHED">Khớp tự động</MenuItem>
                <MenuItem value="UNMATCHED">Cần kiểm tra</MenuItem>
                <MenuItem value="IGNORED">Bỏ qua</MenuItem>
                <MenuItem value="DUPLICATED">Trùng giao dịch</MenuItem>
                <MenuItem value="CONFIRMED">Đã xác nhận</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        )}
        <Box sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Dòng</TableCell>
              <TableCell>Ngày</TableCell>
              <TableCell>Mã giao dịch</TableCell>
              <TableCell>Nội dung</TableCell>
              <TableCell align="right">Ghi có</TableCell>
              <TableCell align="right">Ghi nợ</TableCell>
              <TableCell>Trạng thái</TableCell>
              <TableCell>Đối tượng đối soát</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredItems.map((item) => (
              <TableRow key={item.confirmationToken}>
                <TableCell>{item.rowNo}</TableCell>
                <TableCell>
                  {formatTransactionDate(item.transactionDate)}
                </TableCell>
                <TableCell>{item.bankTransactionNo || "-"}</TableCell>
                <TableCell sx={{ minWidth: 300 }}>{item.description}</TableCell>
                <TableCell align="right">
                  {money(item.creditAmount)} VND
                </TableCell>
                <TableCell align="right">
                  {money(item.debitAmount)} VND
                </TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    color={
                      reconciliationColors[item.reconciliationStatus] ||
                      "default"
                    }
                    label={
                      reconciliationLabels[item.reconciliationStatus] ||
                      item.reconciliationStatus
                    }
                  />
                </TableCell>
                <TableCell>
                  {confirmedTokens.has(item.confirmationToken) ? (
                    <Typography variant="body2" color="success.main">
                      Đã xác nhận và tạo payment/biên lai trong phiên này
                    </Typography>
                  ) : item.paymentBatch ? (
                    <Box>
                      <Typography variant="body2">
                        <strong>{item.paymentBatch.batchNo}</strong> ·{" "}
                        {item.paymentBatch.student.code} —{" "}
                        {item.paymentBatch.student.fullName}
                      </Typography>
                      <Typography variant="body2">
                        {item.paymentBatch.allocations.length} khoản ·{" "}
                        {money(item.paymentBatch.totalAmount)} VND
                      </Typography>
                      <Button
                        size="small"
                        variant="outlined"
                        disabled={loading}
                        onClick={() =>
                          requestConfirm(
                            item,
                            { batchId: item.paymentBatch!.id },
                            "Xác nhận đợt thanh toán",
                            `Xác nhận ${item.paymentBatch!.batchNo} cho ${item.paymentBatch!.student.code} — ${item.paymentBatch!.student.fullName}, số tiền ${money(item.creditAmount)} VND, giao dịch ${item.bankTransactionNo || "không có mã"} lúc ${formatTransactionDate(item.transactionDate)} và tạo biên lai?`,
                          )
                        }
                      >
                        Xác nhận đợt thanh toán
                      </Button>
                    </Box>
                  ) : (
                    item.reconciliationStatus === "IGNORED" ? (
                      "Giao dịch ghi nợ, không đối soát"
                    ) : item.reconciliationStatus === "DUPLICATED" ? (
                      "Giao dịch đã được xác nhận trước đó"
                    ) : item.paymentBatchCandidates.length ? (
                      <Stack spacing={1}>
                        <Typography variant="body2" color="text.secondary">
                          Có {item.paymentBatchCandidates.length} đợt cùng số tiền, hãy chọn đúng học viên:
                        </Typography>
                        {item.paymentBatchCandidates.map((candidate) => (
                          <Box key={candidate.id}>
                            <Typography variant="body2">
                              <strong>{candidate.batchNo}</strong> · {candidate.student.code} — {candidate.student.fullName}
                            </Typography>
                            <Button
                              size="small"
                              variant="outlined"
                              disabled={loading}
                              onClick={() =>
                                requestConfirm(
                                  item,
                                  { batchId: candidate.id },
                                  "Xác nhận đợt thanh toán thủ công",
                                  `Xác nhận giao dịch ${item.bankTransactionNo || "không có mã"} số tiền ${money(item.creditAmount)} VND lúc ${formatTransactionDate(item.transactionDate)} cho ${candidate.batchNo} — ${candidate.student.code} — ${candidate.student.fullName} và tạo biên lai?`,
                                  candidate.confirmationToken,
                                )
                              }
                            >
                              Chọn đợt này
                            </Button>
                          </Box>
                        ))}
                      </Stack>
                    ) : (
                      "Không tìm thấy đợt thanh toán cùng số tiền"
                    )
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!items.length && (
              <TableRow>
                <TableCell colSpan={8}>
                  <Typography
                    sx={{ p: 3 }}
                    color="text.secondary"
                    textAlign="center"
                  >
                    {!hasAnalysis
                      ? "Chưa có dữ liệu phân tích trong phiên này"
                      : "Đã xử lý hết giao dịch trong phiên này"}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {items.length > 0 && !filteredItems.length && (
              <TableRow>
                <TableCell colSpan={8}>
                  <Typography sx={{ p: 3 }} color="text.secondary" textAlign="center">
                    Không có giao dịch thuộc trạng thái đã chọn
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        </Box>
      </Paper>
      <ConfirmDialog
        open={!!pendingConfirmation}
        title={pendingConfirmation?.title || "Xác nhận đối soát"}
        message={
          pendingConfirmation?.message ||
          "Bạn có chắc chắn muốn thực hiện thao tác này không?"
        }
        onConfirm={() => void confirm()}
        onCancel={() => setPendingConfirmation(null)}
        isLoading={loading}
      />
      <ConfirmDialog
        open={resetDialogOpen}
        title="Bắt đầu phiên đối soát mới"
        message="Kết quả chưa xác nhận trong phiên hiện tại sẽ bị xóa khỏi màn hình. Các payment đã xác nhận vẫn được giữ nguyên. Bạn có muốn tiếp tục?"
        confirmLabel="Bắt đầu phiên mới"
        cancelLabel="Quay lại"
        confirmColor="primary"
        onConfirm={resetSession}
        onCancel={() => setResetDialogOpen(false)}
      />
      {Snackbar}
    </Stack>
  );
}
