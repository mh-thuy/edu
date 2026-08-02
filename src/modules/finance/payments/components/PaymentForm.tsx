"use client";

import React, { useCallback, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import type { Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Alert,
  Box,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Button,
  CircularProgress,
  Divider,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
  MenuItem,
} from "@mui/material";

import {
  paymentCreateSchema,
  paymentUpdateSchema,
} from "@/modules/finance/payments/schemas/payment.schema";
import { useSnackbar } from "@/hooks/useSnackbar";
import { extractApiErrorMessage, unwrapApiResponse } from "@/lib/api-client";
import { CurrencyInput } from "@/components/shared/forms/CurrencyInput";

import type { z } from "zod";
import { DatePicker } from "@mui/x-date-pickers";
import dayjs from "dayjs";

type PaymentCreateInput = z.infer<typeof paymentCreateSchema>;
type PaymentUpdateInput = z.infer<typeof paymentUpdateSchema>;
type FeeStatus = "unpaid" | "partial" | "paid";
type PaymentMethodValue = "cash" | "transfer" | "wallet";
type ApiPaymentMethod = "CASH" | "TRANSFER" | "WALLET";

interface StudentFeeOption {
  id: string;
  studentId: string;
  month: string;
  amount: number;
  discount?: number;
  outstanding: number;
  status: FeeStatus;
  student: {
    id?: string;
    code: string;
    fullName: string;
  } | null;
  class: {
    code: string;
    name: string;
  } | null;
}

interface StudentFeeApiItem {
  id: string;
  studentId: string;
  month: string;
  amount: number;
  discount?: number;
  status: FeeStatus;
  student?: {
    id?: string;
    code: string;
    fullName: string;
  } | null;
  class?: {
    code: string;
    name: string;
  } | null;
  payments?: Array<{
    id: string;
    amount: number;
  }>;
}

interface StudentFeeListResponse {
  items: StudentFeeApiItem[];
}

interface PaymentFormData {
  studentFeeId: string;
  amount: number;
  method: "cash" | "transfer" | "wallet";
  paymentDate: string;
  notes: string;
}

interface PaymentFormProps {
  initialData?: {
    id: string;
    studentFeeId: string;
    amount: number;
    method: PaymentMethodValue | ApiPaymentMethod;
    paymentDate: string;
    notes?: string | null;
    studentFee?: {
      id: string;
      month: string;
      amount: number;
      discount?: number;
      student?: {
        id?: string;
        code: string;
        fullName: string;
      } | null;
      class?: {
        code: string;
        name: string;
      } | null;
      payments?: Array<{
        id: string;
        amount: number;
      }>;
    } | null;
  };
  onClose: () => void;
  onSuccess: () => void;
}

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat("vi-VN").format(value);

const getStatusLabel = (status: StudentFeeOption["status"]): string => {
  const labels: Record<StudentFeeOption["status"], string> = {
    paid: "Đã thanh toán",
    partial: "Thanh toán một phần",
    unpaid: "Chưa thanh toán",
  };

  return labels[status];
};

const PAYMENT_METHODS = [
  { value: "cash", label: "Tiền mặt" },
  { value: "transfer", label: "Chuyển khoản" },
  { value: "wallet", label: "Ví điện tử" },
];

const normalizePaymentMethod = (
  method?: PaymentMethodValue | ApiPaymentMethod,
): PaymentMethodValue => {
  switch (method?.toLowerCase()) {
    case "transfer":
      return "transfer";
    case "wallet":
      return "wallet";
    default:
      return "cash";
  }
};

const normalizeFeeStatus = (status: string): FeeStatus => {
  const normalized = status.toLowerCase();
  if (normalized === "paid" || normalized === "partial") {
    return normalized;
  }

  return "unpaid";
};

export function PaymentForm({
  initialData,
  onClose,
  onSuccess,
}: PaymentFormProps) {
  const { showError, showSuccess, Snackbar } = useSnackbar();
  const [submitting, setSubmitting] = useState(false);
  const [fees, setFees] = useState<StudentFeeOption[]>([]);
  const [loadingFees, setLoadingFees] = useState(false);
  const [studentCode, setStudentCode] = useState("");
  const [student, setStudent] = useState<StudentFeeOption["student"]>(null);
  const [selectedFeeIds, setSelectedFeeIds] = useState<string[]>([]);
  const [paymentFeeId, setPaymentFeeId] = useState(initialData?.studentFeeId || "");
  const [step, setStep] = useState<"lookup" | "info">("lookup");
  const [exporting, setExporting] = useState(false);

  const isEditing = Boolean(initialData);

  const defaultValues = useMemo<PaymentFormData>(
    () => ({
      studentFeeId: initialData?.studentFeeId || "",
      amount: initialData?.amount || 0,
      method: normalizePaymentMethod(initialData?.method),
      paymentDate:
        initialData?.paymentDate?.slice(0, 10) ||
        new Date().toISOString().slice(0, 10) ||
        "",
      notes: initialData?.notes || "",
    }),
    [initialData],
  );

  const resolver = useMemo(
    () =>
      zodResolver(
        isEditing ? paymentUpdateSchema : paymentCreateSchema,
      ) as unknown as Resolver<PaymentFormData>,
    [isEditing],
  );

  const {
    handleSubmit,
    watch,
    control,
    register,
    setValue,
    formState: { errors },
  } = useForm<PaymentFormData>({
    resolver,
    defaultValues,
  });

  const selectedFeeId = watch("studentFeeId");

  const loadFees = useCallback(async (code: string) => {
    try {
      setLoadingFees(true);
      const params = new URLSearchParams({
        status: "unpaid,partial",
        pageSize: "100",
        search: code.trim(),
      });

      const response = await fetch(`/api/student-fees?${params.toString()}`);

      if (!response.ok) {
        throw new Error(await extractApiErrorMessage(response, "Failed to load fees"));
      }

      const result = await unwrapApiResponse<StudentFeeListResponse>(response);
      const matchingFees = result.items.filter(
        (fee) => fee.student?.code.toLowerCase() === code.trim().toLowerCase(),
      );

      if (matchingFees.length === 0) {
        throw new Error("Không tìm thấy học sinh hoặc học sinh không còn khoản nợ");
      }

      const mappedFees = matchingFees.map((fee) => {
        const paidAmount =
          fee.payments?.reduce((sum, payment) => sum + payment.amount, 0) || 0;
        const netAmount = fee.amount - (fee.discount || 0);

        return {
          id: fee.id,
          studentId: fee.studentId,
          month: fee.month,
          amount: netAmount,
          discount: fee.discount || 0,
          outstanding: Math.max(netAmount - paidAmount, 0),
          status: normalizeFeeStatus(fee.status),
          student: fee.student || null,
          class: fee.class || null,
        };
      });

      setFees(mappedFees);
      setStudent(mappedFees[0]?.student || null);
      setSelectedFeeIds(mappedFees.map((fee) => fee.id));
      setPaymentFeeId("");
      setStep("lookup");
    } catch (error) {
      setFees([]);
      setStudent(null);
      setSelectedFeeIds([]);
      showError(error instanceof Error ? error.message : "Failed to load fees");
    } finally {
      setLoadingFees(false);
    }
  }, [showError]);

  const selectedFee = useMemo(() => {
    if (initialData?.studentFee) {
      const outstanding =
        (initialData.studentFee.amount - (initialData.studentFee.discount || 0)) -
        (initialData.studentFee.payments?.reduce(
          (sum, payment) =>
            payment.id === initialData.id ? sum : sum + payment.amount,
          0,
        ) || 0);

      return {
        id: initialData.studentFee.id,
        studentId: initialData.studentFee.student?.id || "",
        month: initialData.studentFee.month,
        amount:
          initialData.studentFee.amount - (initialData.studentFee.discount || 0),
        discount: initialData.studentFee.discount || 0,
        outstanding,
        status: "partial" as const,
        student: initialData.studentFee.student || null,
        class: initialData.studentFee.class || null,
      };
    }

    return fees.find((fee) => fee.id === (paymentFeeId || selectedFeeId)) || null;
  }, [fees, initialData, paymentFeeId, selectedFeeId]);

  const selectedFees = useMemo(
    () => fees.filter((fee) => selectedFeeIds.includes(fee.id)),
    [fees, selectedFeeIds],
  );

  const selectedTotal = selectedFees.reduce(
    (sum, fee) => sum + fee.outstanding,
    0,
  );

  const handleLookup = async () => {
    const code = studentCode.trim();
    if (!code) {
      showError("Mã học sinh là bắt buộc");
      return;
    }

    await loadFees(code);
  };

  const handleExportSelectedPdf = async () => {
    if (!student || selectedFeeIds.length === 0) {
      showError("Vui lòng chọn ít nhất một khoản học phí");
      return;
    }

    try {
      setExporting(true);
      const response = await fetch(
        `/api/student-fees/students/${selectedFees[0]?.studentId}/generate-payment-package`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ feeIds: selectedFeeIds }),
        },
      );

      if (!response.ok) {
        throw new Error(await extractApiErrorMessage(response, "Xuất PDF thất bại"));
      }

      const result = await unwrapApiResponse<{ pdfUrl: string }>(response);
      window.open(result.pdfUrl, "_blank", "noopener,noreferrer");
      showSuccess("Đã xuất thông tin thanh toán PDF");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Xuất PDF thất bại");
    } finally {
      setExporting(false);
    }
  };

  const onSubmit = async (data: PaymentFormData) => {
    if (!selectedFee) {
      showError("Vui lòng chọn hóa đơn");
      return;
    }

    const maxAllowed = isEditing
      ? selectedFee.outstanding + (initialData?.amount || 0)
      : selectedFee.outstanding;

    if (data.amount > maxAllowed) {
      showError(
        `Số tiền không được vượt quá công nợ còn lại: ${formatCurrency(maxAllowed)} VND`,
      );
      return;
    }

    try {
      setSubmitting(true);

      const payload = isEditing
        ? ({
            amount: data.amount,
            method: data.method,
            paymentDate: data.paymentDate,
            notes: data.notes || undefined,
          } satisfies PaymentUpdateInput)
        : ({
            studentFeeId: data.studentFeeId,
            amount: data.amount,
            method: data.method,
            paymentDate: data.paymentDate,
            notes: data.notes || undefined,
          } satisfies PaymentCreateInput);

      const response = await fetch(
        isEditing ? `/api/payments/${initialData?.id}` : "/api/payments",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        throw new Error(
          (await extractApiErrorMessage(
            response,
            (isEditing
              ? "Failed to update payment"
              : "Failed to record payment"),
          )) ||
            "Failed to save payment",
        );
      }

      showSuccess(
        isEditing
          ? "Cập nhật thanh toán thành công"
          : "Ghi nhận thanh toán thành công",
      );
      onSuccess();
    } catch (error) {
      showError(
        error instanceof Error
          ? error.message
          : isEditing
            ? "Cập nhật thanh toán thất bại"
            : "Ghi nhận thanh toán thất bại",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Dialog
        open
        onClose={onClose}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          component: "form",
          onSubmit: handleSubmit(onSubmit),
        }}
      >
        <DialogTitle>
          {isEditing ? "Cập nhật thanh toán" : "Ghi nhận thanh toán"}
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {isEditing ? (
                  <TextField
                    label="Hóa đơn"
                    value={
                      selectedFee
                        ? `${selectedFee.student?.code || "N/A"} - ${
                            selectedFee.student?.fullName || "Không rõ"
                          } | ${selectedFee.class?.code || "N/A"} - ${
                            selectedFee.class?.name || "Không rõ"
                          } | ${selectedFee.month}`
                        : ""
                    }
                    fullWidth
                    InputProps={{ readOnly: true }}
                  />
            ) : step === "lookup" ? (
              <Stack spacing={1.5}>
                <TextField
                  label="Mã học sinh"
                  placeholder="Nhập chính xác mã học sinh"
                  value={studentCode}
                  onChange={(event) => setStudentCode(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleLookup();
                    }
                  }}
                  required
                  fullWidth
                  autoFocus
                />
                <Button
                  type="button"
                  variant="outlined"
                  onClick={() => void handleLookup()}
                  disabled={loadingFees || !studentCode.trim()}
                >
                  {loadingFees ? "Đang tải..." : "Tra cứu học phí"}
                </Button>

                {student && fees.length > 0 && (
                  <Stack spacing={1}>
                    <Typography variant="subtitle2">
                      {student.code} - {student.fullName}
                    </Typography>
                    {fees.map((fee) => (
                      <Stack
                        key={fee.id}
                        direction="row"
                        alignItems="center"
                        justifyContent="space-between"
                        sx={{
                          px: 1,
                          border: "1px solid",
                          borderColor: "divider",
                          borderRadius: 1.5,
                        }}
                      >
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={selectedFeeIds.includes(fee.id)}
                              onChange={() =>
                                setSelectedFeeIds((current) =>
                                  current.includes(fee.id)
                                    ? current.filter((id) => id !== fee.id)
                                    : [...current, fee.id],
                                )
                              }
                            />
                          }
                          label={`${fee.month} · ${fee.class?.name || "Không rõ lớp"}`}
                        />
                        <Typography variant="body2" fontWeight={600}>
                          {formatCurrency(fee.outstanding)} VND
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                )}
              </Stack>
            ) : (
              <Stack spacing={1.5}>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  justifyContent="space-between"
                  spacing={1}
                >
                  <Box>
                    <Typography variant="subtitle1" fontWeight={700}>
                      Thông tin thanh toán
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {student?.code} - {student?.fullName}
                    </Typography>
                  </Box>
                  <Typography variant="h6" color="primary" fontWeight={700}>
                    {formatCurrency(selectedTotal)} VND
                  </Typography>
                </Stack>
                {selectedFees.map((fee) => (
                  <Stack
                    key={fee.id}
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    sx={{ p: 1.25, bgcolor: "grey.50", borderRadius: 1.5 }}
                  >
                    <Box>
                      <Typography variant="body2" fontWeight={600}>
                        {fee.month} · {fee.class?.name || "Không rõ lớp"}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Còn nợ: {formatCurrency(fee.outstanding)} VND
                      </Typography>
                    </Box>
                    <Button
                      type="button"
                      size="small"
                      onClick={() => {
                        setPaymentFeeId(fee.id);
                        setValue("studentFeeId", fee.id);
                      }}
                    >
                      Ghi nhận khoản này
                    </Button>
                  </Stack>
                ))}
              </Stack>
            )}

            {selectedFee ? (
              <>
                <Divider />

                <Stack
                  spacing={0.75}
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: "grey.50",
                    border: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    Tổng tiền: {formatCurrency(selectedFee.amount)} VND
                  </Typography>

                  <Typography variant="caption" color="text.secondary">
                    Công nợ còn lại:{" "}
                    {formatCurrency(
                      isEditing
                        ? selectedFee.outstanding + (initialData?.amount || 0)
                        : selectedFee.outstanding,
                    )}{" "}
                    VND
                  </Typography>

                  <Typography variant="caption" color="text.secondary">
                    Trạng thái học phí: {getStatusLabel(selectedFee.status)}
                  </Typography>
                </Stack>
              </>
            ) : loadingFees ? (
              <Alert severity="info">Đang tải danh sách học phí...</Alert>
            ) : null}

            {(isEditing || paymentFeeId) && <Controller
              name="amount"
              control={control}
              render={({ field }) => (
                <CurrencyInput
                  label="Số tiền thanh toán"
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.amount}
                />
              )}
            />}

            {(isEditing || paymentFeeId) && <Controller
              name="method"
              control={control}
              render={({ field }) => (
                <TextField
                  select
                  label="Phương thức"
                  {...field}
                  error={!!errors.method}
                  helperText={errors.method?.message}
                  fullWidth
                >
                  {PAYMENT_METHODS.map((method) => (
                    <MenuItem key={method.value} value={method.value}>
                      {method.label}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />}

            {(isEditing || paymentFeeId) && <Controller
              name="paymentDate"
              control={control}
              render={({ field }) => (
                <DatePicker
                  label="Ngày thanh toán"
                  format="DD/MM/YYYY"
                  value={field.value ? dayjs(field.value) : null}
                  onChange={(value) => {
                    field.onChange(value ? value.format("YYYY-MM-DD") : "");
                  }}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      error: !!errors.paymentDate,
                      helperText: errors.paymentDate?.message,
                    },
                  }}
                />
              )}
            />}

            {(isEditing || paymentFeeId) && <TextField
              label="Ghi chú"
              {...register("notes")}
              fullWidth
              multiline
              rows={2}
            />}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={submitting}>
            Hủy
          </Button>
          {!isEditing && step === "lookup" ? (
            <Button
              type="button"
              variant="contained"
              onClick={() => setStep("info")}
              disabled={selectedFeeIds.length === 0 || !student}
            >
              Xem thông tin thanh toán
            </Button>
          ) : !isEditing && !paymentFeeId ? (
            <>
              <Button type="button" onClick={() => setStep("lookup")}>
                Chọn lại khoản
              </Button>
              <Button
                type="button"
                variant="contained"
                onClick={() => void handleExportSelectedPdf()}
                disabled={exporting}
                startIcon={exporting ? <CircularProgress size={18} /> : undefined}
              >
                {exporting ? "Đang xuất..." : "Xuất PDF"}
              </Button>
            </>
          ) : (
            <Button
              type="submit"
              variant="contained"
              disabled={submitting || !selectedFee}
              startIcon={submitting ? <CircularProgress size={20} /> : undefined}
            >
              {submitting ? "Đang xử lý..." : "Ghi nhận thanh toán"}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {Snackbar}
    </>
  );
}
