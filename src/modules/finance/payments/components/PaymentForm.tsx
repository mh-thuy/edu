"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import type { Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Alert,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Button,
  CircularProgress,
  Divider,
  Stack,
  TextField,
  Typography,
  MenuItem,
  InputAdornment,
} from "@mui/material";
import { ConfirmDialog } from "@/components/shared/dialogs/ConfirmDialog";

import {
  paymentCreateSchema,
  paymentUpdateSchema,
} from "@/modules/finance/payments/schemas/payment.schema";
import { useSnackbar } from "@/hooks/useSnackbar";
import { extractApiErrorMessage, unwrapApiResponse } from "@/lib/api-client";

import type { z } from "zod";
import { DatePicker } from "@mui/x-date-pickers";
import dayjs from "dayjs";

type PaymentCreateInput = z.infer<typeof paymentCreateSchema>;
type PaymentUpdateInput = z.infer<typeof paymentUpdateSchema>;
type FeeStatus = "unpaid" | "partial" | "paid";

interface StudentFeeOption {
  id: string;
  month: string;
  amount: number;
  discount?: number;
  outstanding: number;
  status: FeeStatus;
  student: {
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
  month: string;
  amount: number;
  discount?: number;
  status: FeeStatus;
  student?: {
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
    method: "cash" | "transfer" | "wallet";
    paymentDate: string;
    notes?: string | null;
    studentFee?: {
      id: string;
      month: string;
      amount: number;
      discount?: number;
      student?: {
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
  presetStudentFee?: {
    id: string;
    month: string;
    amount: number;
    discount?: number;
    outstanding: number;
    status: FeeStatus;
    student?: {
      code: string;
      fullName: string;
    } | null;
    class?: {
      code: string;
      name: string;
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

const normalizeFeeStatus = (status: string): FeeStatus => {
  const normalized = status.toLowerCase();
  if (normalized === "paid" || normalized === "partial") {
    return normalized;
  }

  return "unpaid";
};

export function PaymentForm({
  initialData,
  presetStudentFee,
  onClose,
  onSuccess,
}: PaymentFormProps) {
  const { showError, showSuccess, Snackbar } = useSnackbar();
  const [submitting, setSubmitting] = useState(false);
  const [fees, setFees] = useState<StudentFeeOption[]>([]);
  const [loadingFees, setLoadingFees] = useState(false);
  const [feeSearch, setFeeSearch] = useState("");
  const [selectedFeeOption, setSelectedFeeOption] = useState<StudentFeeOption | null>(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  const isEditing = Boolean(initialData);

  const defaultValues = useMemo<PaymentFormData>(
    () => ({
      studentFeeId: initialData?.studentFeeId || "",
      ...(presetStudentFee ? { studentFeeId: presetStudentFee.id } : {}),
      amount: initialData?.amount || 0,
      method: initialData?.method || "cash",
      paymentDate:
        initialData?.paymentDate?.slice(0, 10) ||
        new Date().toISOString().slice(0, 10) ||
        "",
      notes: initialData?.notes || "",
    }),
    [initialData, presetStudentFee],
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
    formState: { errors, isDirty },
  } = useForm<PaymentFormData>({
    resolver,
    defaultValues,
  });

  const selectedFeeId = watch("studentFeeId");

  const loadFees = useCallback(async (searchValue = "") => {
    try {
      setLoadingFees(true);
      const params = new URLSearchParams({
        status: "unpaid,partial",
        pageSize: "20",
      });

      if (searchValue.trim()) {
        params.set("search", searchValue.trim());
      }

      const response = await fetch(`/api/student-fees?${params.toString()}`);

      if (!response.ok) {
        throw new Error(await extractApiErrorMessage(response, "Failed to load fees"));
      }

      const result = await unwrapApiResponse<StudentFeeListResponse>(response);
      const mappedFees = result.items.map((fee) => {
        const paidAmount =
          fee.payments?.reduce((sum, payment) => sum + payment.amount, 0) || 0;
        const netAmount = fee.amount - (fee.discount || 0);

        return {
          id: fee.id,
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
    } catch (error) {
      showError(error instanceof Error ? error.message : "Failed to load fees");
    } finally {
      setLoadingFees(false);
    }
  }, [showError]);

  useEffect(() => {
    if (isEditing || presetStudentFee) {
      return;
    }

    const timer = window.setTimeout(() => {
      void loadFees(feeSearch);
    }, 300);

    return () => {
      window.clearTimeout(timer);
    };
  }, [feeSearch, isEditing, loadFees, presetStudentFee]);

  const selectedFee = useMemo(() => {
    if (presetStudentFee && !isEditing) {
      return presetStudentFee;
    }

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

    return fees.find((fee) => fee.id === selectedFeeId) || selectedFeeOption || null;
  }, [fees, initialData, presetStudentFee, selectedFeeId, selectedFeeOption, isEditing]);

  const requestClose = () => {
    if (submitting) {
      return;
    }
    if (isDirty) {
      setShowLeaveConfirm(true);
      return;
    }
    onClose();
  };

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty || submitting) {
        return;
      }
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isDirty, submitting]);

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
        onClose={requestClose}
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
            <Controller
              name="studentFeeId"
              control={control}
              render={({ field }) =>
                !isEditing && !presetStudentFee ? (
                  <Stack spacing={1.25}>
                    <TextField
                      label="Tìm hóa đơn"
                      placeholder="Mã học viên, tên học viên, mã lớp, tên lớp, tháng"
                      value={feeSearch}
                      onChange={(event) => setFeeSearch(event.target.value)}
                      fullWidth
                    />
                    <TextField
                      select
                      label="Hóa đơn"
                      {...field}
                      onChange={(event) => {
                        field.onChange(event);
                        setSelectedFeeOption(
                          fees.find((fee) => fee.id === event.target.value) || null,
                        );
                      }}
                      error={!!errors.studentFeeId}
                      helperText={errors.studentFeeId?.message}
                      fullWidth
                      disabled={loadingFees}
                    >
                      <MenuItem value="">-- Chọn hóa đơn --</MenuItem>

                      {fees.map((fee) => (
                        <MenuItem key={fee.id} value={fee.id}>
                          {fee.student?.code || "N/A"} -{" "}
                          {fee.student?.fullName || "Không rõ"} |{" "}
                          {fee.class?.code || "N/A"} -{" "}
                          {fee.class?.name || "Không rõ"} | {fee.month} | Nợ{" "}
                          {formatCurrency(fee.outstanding)} VND
                        </MenuItem>
                      ))}
                    </TextField>
                  </Stack>
                ) : (
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
                )
              }
            />

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

            <Controller
              name="amount"
              control={control}
              render={({ field }) => (
                <TextField
                  label="Số tiền thanh toán"
                  fullWidth
                  value={
                    field.value
                      ? Number(field.value).toLocaleString("vi-VN")
                      : ""
                  }
                  onChange={(event) => {
                    const rawValue = event.target.value.replace(/[^\d]/g, "");
                    field.onChange(rawValue ? Number(rawValue) : null);
                  }}
                  error={!!errors.amount}
                  helperText={errors.amount?.message}
                  inputMode="numeric"
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">VND</InputAdornment>
                    ),
                  }}
                />
              )}
            />

            <Controller
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
            />

            <Controller
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
            />

            <TextField
              label="Ghi chú"
              {...register("notes")}
              fullWidth
              multiline
              rows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={requestClose} disabled={submitting}>
            Hủy
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={submitting || (!isEditing && !selectedFee)}
            startIcon={submitting ? <CircularProgress size={20} /> : undefined}
          >
            {submitting ? "Đang xử lý..." : "Lưu"}
          </Button>
        </DialogActions>
      </Dialog>

      {Snackbar}
      <ConfirmDialog
        open={showLeaveConfirm}
        title="Xác nhận rời trang"
        message="Dữ liệu chưa lưu sẽ bị mất. Bạn có chắc muốn rời đi?"
        confirmLabel="Rời đi"
        cancelLabel="Ở lại"
        confirmColor="warning"
        onConfirm={() => {
          setShowLeaveConfirm(false);
          onClose();
        }}
        onCancel={() => setShowLeaveConfirm(false)}
      />
    </>
  );
}
