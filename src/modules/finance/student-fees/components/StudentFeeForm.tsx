"use client";

import React from "react";
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
} from "@mui/material";

import {
  studentFeeCreateSchema,
  studentFeeUpdateSchema,
} from "@/modules/finance/student-fees/schemas/student-fee.schema";
import { useSnackbar } from "@/hooks/useSnackbar";

import type { z } from "zod";

type StudentFeeCreateInput = z.infer<typeof studentFeeCreateSchema>;
type StudentFeeUpdateInput = z.infer<typeof studentFeeUpdateSchema>;

interface StudentFeeFormProps {
  initialData?: {
    id: string;
    studentId: string;
    classId: string;
    month: string;
    amount: number;
    dueDate: string;
    status: "unpaid" | "partial" | "paid";
  };
  onClose: () => void;
  onSuccess: () => void;
}

export function StudentFeeForm({
  initialData,
  onClose,
  onSuccess,
}: StudentFeeFormProps) {
  const { t: tFinance } = useTranslation("finance");
  const { t: tCommon } = useTranslation("common");
  const snackbar = useSnackbar();
  const [submitting, setSubmitting] = React.useState(false);
  const isCreating = !initialData;

  const schema = isCreating ? studentFeeCreateSchema : studentFeeUpdateSchema;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<StudentFeeCreateInput | StudentFeeUpdateInput>({
    resolver: zodResolver(schema as any), // eslint-disable-line @typescript-eslint/no-explicit-any
    defaultValues: isCreating
      ? {
          studentId: "",
          classId: "",
          month: new Date().toISOString().slice(0, 7),
          amount: 0,
          dueDate: new Date().toISOString().split("T")[0],
        }
      : {
          amount: initialData?.amount,
          dueDate: initialData?.dueDate,
          status: initialData?.status,
        },
  });

  const onSubmit = async (data: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    try {
      setSubmitting(true);
      let response;

      if (isCreating) {
        // CREATE mode - POST to /api/student-fees
        response = await fetch("/api/student-fees", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
      } else {
        // UPDATE mode - PUT to /api/student-fees/{id}
        response = await fetch(`/api/student-fees/${initialData?.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
      }

      if (!response.ok) throw new Error("Failed to save");
      snackbar.showSuccess(isCreating ? tFinance("createFeeSuccess") : tFinance("updateFeeSuccess"));
      onSuccess();
    } catch {
      snackbar.showError(isCreating ? tCommon("createError") : tCommon("updateError"));
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
      <DialogTitle>
        {isCreating ? tFinance("createStudentFee") : tFinance("editStudentFee")}
      </DialogTitle>
      <DialogContent sx={{ mt: 2 }}>
        <Stack spacing={2}>
          {isCreating ? (
            <>
              <TextField
                label={tFinance("selectInvoice")}
                {...register("studentId")}
                error={!!errors.studentId}
                helperText={errors.studentId?.message}
                fullWidth
              />

              <TextField
                label={tCommon("create")}
                {...register("classId")}
                error={!!errors.classId}
                helperText={errors.classId?.message}
                fullWidth
              />

              <TextField
                label={tFinance("month")}
                type="month"
                {...register("month")}
                error={!!errors.month}
                helperText={errors.month?.message}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </>
          ) : (
            <>
              <TextField
                label={tCommon("create")}
                value={initialData?.studentId}
                disabled
                fullWidth
              />
              <TextField
                label={tCommon("create")}
                value={initialData?.classId}
                disabled
                fullWidth
              />
              <TextField
                label={tFinance("month")}
                value={initialData?.month}
                disabled
                fullWidth
              />
            </>
          )}

          <TextField
            label={tFinance("amount")}
            type="number"
            {...register("amount", { valueAsNumber: true })}
            error={!!errors.amount}
            helperText={errors.amount?.message}
            fullWidth
            inputProps={{ step: "100" }}
          />

          <TextField
            label={tCommon("create")}
            type="date"
            {...register("dueDate")}
            error={!!errors.dueDate}
            helperText={errors.dueDate?.message}
            fullWidth
            InputLabelProps={{ shrink: true }}
          />

          {!isCreating && (
            <TextField
              select
              label={tFinance("status")}
              {...register("status")}
              error={!!((errors as any).status)} // eslint-disable-line @typescript-eslint/no-explicit-any
              helperText={((errors as any).status)?.message} // eslint-disable-line @typescript-eslint/no-explicit-any
              fullWidth
              slotProps={{
                select: {
                  native: true,
                },
              }}
            >
              <option value="unpaid">{tFinance("unpaid")}</option>
              <option value="partial">{tFinance("partial")}</option>
              <option value="paid">{tFinance("paid")}</option>
            </TextField>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{tCommon("cancel")}</Button>
        <Button
          type="submit"
          variant="contained"
          disabled={submitting}
          startIcon={submitting ? <CircularProgress size={20} /> : undefined}
        >
          {submitting ? `${tCommon("loading")}` : tCommon("save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
