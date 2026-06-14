"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
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
  const { t: tFinance } = useTranslation("finance");
  const { t: tCommon } = useTranslation("common");
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
        snackbar.showError(tCommon("error"));
      } finally {
        setLoadingFees(false);
      }
    };
    loadFees();
  }, [snackbar, tCommon]);

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
      snackbar.showError(tFinance("chooseInvoice"));
      return;
    }

    if (amount > selectedFee.outstanding) {
      snackbar.showError(
        `${tFinance("amountRequired")} ${selectedFee.outstanding.toLocaleString()} VND`
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
      snackbar.showSuccess(tFinance("recordPaymentSuccess"));
      onSuccess();
    } catch {
      snackbar.showError(tFinance("recordPaymentError"));
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
      <DialogTitle>{tFinance("recordPayment")}</DialogTitle>
      <DialogContent sx={{ mt: 2 }}>
        <Stack spacing={2}>
          <TextField
            select
            label={tFinance("invoice")}
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
            <option value="">{tFinance("chooseInvoice")}</option>
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
                {tFinance("totalAmount")}: {selectedFee.amount.toLocaleString()} VND
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {tFinance("remainingAmount")}: {selectedFee.outstanding.toLocaleString()} VND
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {tFinance("status")}: {selectedFee.status}
              </Typography>
            </>
          )}

          <TextField
            type="number"
            label={tFinance("amount")}
            {...register("amount", { valueAsNumber: true })}
            error={!!errors.amount}
            helperText={errors.amount?.message}
            fullWidth
            inputProps={{ step: "100" }}
          />

          <TextField
            select
            label={tFinance("paymentMethod")}
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
            <option value="cash">{tFinance("cash")}</option>
            <option value="transfer">{tFinance("bank")}</option>
            <option value="wallet">{tFinance("card")}</option>
          </TextField>

          <TextField
            type="date"
            label={tFinance("paymentDate")}
            {...register("paymentDate")}
            error={!!errors.paymentDate}
            helperText={errors.paymentDate?.message}
            fullWidth
            InputLabelProps={{ shrink: true }}
          />

          <TextField
            label={tCommon("note")}
            {...register("notes")}
            fullWidth
            multiline
            rows={2}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{tCommon("cancel")}</Button>
        <Button
          type="submit"
          variant="contained"
          disabled={submitting || !selectedFee}
          startIcon={submitting ? <CircularProgress size={20} /> : undefined}
        >
          {submitting ? `${tCommon("loading")}` : tCommon("save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
