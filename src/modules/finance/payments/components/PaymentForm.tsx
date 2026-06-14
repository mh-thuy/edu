"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Stack,
  CircularProgress,
  Typography,
  Divider,
} from "@mui/material";

import { paymentCreateSchema } from "@/modules/finance/payments/schemas/payment.schema";
import { useSnackbar } from "@/hooks/useSnackbar";

import type { z } from "zod";

type PaymentCreateInput = z.infer<typeof paymentCreateSchema>;

interface PaymentFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface StudentFeeInfo {
  id: string;
  studentId: string;
  amount: number;
  outstanding: number;
  status: string;
}

export function PaymentForm({ onClose, onSuccess }: PaymentFormProps) {
  const snackbar = useSnackbar();
  const [submitting, setSubmitting] = useState(false);
  const [selectedFee, setSelectedFee] = useState<StudentFeeInfo | null>(null);
  const [fees, setFees] = useState<StudentFeeInfo[]>([]);
  const [loadingFees, setLoadingFees] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<PaymentCreateInput>({
    resolver: zodResolver(paymentCreateSchema),
    defaultValues: {
      method: "cash",
      paymentDate: new Date().toISOString().split("T")[0],
    },
  });

  const studentFeeId = watch("studentFeeId");
  const amount = watch("amount", 0);

  // Load unpaid student fees
  React.useEffect(() => {
    const loadFees = async () => {
      try {
        setLoadingFees(true);
        const response = await fetch(
          "/api/student-fees?status=unpaid,partial"
        );
        if (!response.ok) throw new Error("Failed to load fees");
        const result = await response.json();
        setFees(result.data || []);
      } catch {
        snackbar.showError("Failed to load fees");
      } finally {
        setLoadingFees(false);
      }
    };
    loadFees();
  }, [snackbar]);

  // Update selected fee info when fee is selected
  React.useEffect(() => {
    if (studentFeeId) {
      const fee = fees.find((f) => f.id === studentFeeId);
      setSelectedFee(fee || null);
    } else {
      setSelectedFee(null);
    }
  }, [studentFeeId, fees]);

  const onSubmit = async (data: PaymentCreateInput) => {
    if (!selectedFee) {
      snackbar.showError("Vui lòng chọn hóa đơn");
      return;
    }

    if (amount > selectedFee.outstanding) {
      snackbar.showError(
        `Số tiền không được vượt quá nợ cần thanh toán: ${selectedFee.outstanding.toLocaleString()} VND`
      );
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error("Failed to record payment");
      snackbar.showSuccess("Ghi nhận thanh toán thành công");
      onSuccess();
    } catch {
      snackbar.showError("Ghi nhận thanh toán thất bại");
    } finally {
      setSubmitting(false);
    }
  };

  return (
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
      <DialogTitle>Ghi nhận thanh toán</DialogTitle>
      <DialogContent sx={{ mt: 2 }}>
        <Stack spacing={2}>
          <TextField
            select
            label="Hóa đơn"
            {...register("studentFeeId")}
            error={!!errors.studentFeeId}
            helperText={errors.studentFeeId?.message}
            fullWidth
            disabled={loadingFees}
            slotProps={{
              select: {
                native: true,
              },
            }}
          >
            <option value="">-- Chọn hóa đơn --</option>
            {fees.map((fee) => (
              <option key={fee.id} value={fee.id}>
                {fee.studentId} - {fee.amount.toLocaleString()} VND
              </option>
            ))}
          </TextField>

          {selectedFee && (
            <>
              <Divider />
              <Typography variant="caption" color="text.secondary">
                Tổng tiền: {selectedFee.amount.toLocaleString()} VND
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Nợ còn lại: {selectedFee.outstanding.toLocaleString()} VND
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Trạng thái: {selectedFee.status}
              </Typography>
            </>
          )}

          <TextField
            type="number"
            label="Số tiền thanh toán"
            {...register("amount", { valueAsNumber: true })}
            error={!!errors.amount}
            helperText={errors.amount?.message}
            fullWidth
            inputProps={{ step: "100" }}
          />

          <TextField
            select
            label="Phương thức"
            {...register("method")}
            error={!!errors.method}
            helperText={errors.method?.message}
            fullWidth
            slotProps={{
              select: {
                native: true,
              },
            }}
          >
            <option value="cash">Tiền mặt</option>
            <option value="transfer">Chuyển khoản</option>
            <option value="wallet">Ví điện tử</option>
          </TextField>

          <TextField
            type="date"
            label="Ngày thanh toán"
            {...register("paymentDate")}
            error={!!errors.paymentDate}
            helperText={errors.paymentDate?.message}
            fullWidth
            InputLabelProps={{ shrink: true }}
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
        <Button onClick={onClose}>Hủy</Button>
        <Button
          type="submit"
          variant="contained"
          disabled={submitting || !selectedFee}
          startIcon={submitting ? <CircularProgress size={20} /> : undefined}
        >
          {submitting ? "Đang xử lý..." : "Lưu"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
