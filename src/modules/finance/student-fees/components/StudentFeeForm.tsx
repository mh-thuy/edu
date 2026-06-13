"use client";

import React from "react";
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
} from "@mui/material";

import { studentFeeUpdateSchema } from "@/modules/finance/student-fees/schemas/student-fee.schema";
import { useSnackbar } from "@/hooks/useSnackbar";

import type { z } from "zod";

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
  const snackbar = useSnackbar();
  const [submitting, setSubmitting] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<StudentFeeUpdateInput>({
    resolver: zodResolver(studentFeeUpdateSchema),
    defaultValues: initialData
      ? {
          amount: initialData.amount,
          dueDate: initialData.dueDate,
          status: initialData.status,
        }
      : undefined,
  });

  const onSubmit = async (data: StudentFeeUpdateInput) => {
    if (!initialData?.id) return;

    try {
      setSubmitting(true);
      const response = await fetch(`/api/student-fees/${initialData.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error("Failed to update");
      snackbar.showSuccess("Cập nhật thành công");
      onSuccess();
    } catch {
      snackbar.showError("Cập nhật thất bại");
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
        {initialData ? "Sửa hóa đơn" : "Tạo hóa đơn"}
      </DialogTitle>
      <DialogContent sx={{ mt: 2 }}>
        <Stack spacing={2}>
          {initialData && (
            <>
              <TextField
                label="Học sinh"
                value={initialData.studentId}
                disabled
                fullWidth
              />
              <TextField
                label="Lớp"
                value={initialData.classId}
                disabled
                fullWidth
              />
              <TextField
                label="Tháng"
                value={initialData.month}
                disabled
                fullWidth
              />
            </>
          )}

          <TextField
            label="Số tiền"
            type="number"
            {...register("amount", { valueAsNumber: true })}
            error={!!errors.amount}
            helperText={errors.amount?.message}
            fullWidth
            inputProps={{ step: "100" }}
          />

          <TextField
            label="Hạn thanh toán"
            type="date"
            {...register("dueDate")}
            error={!!errors.dueDate}
            helperText={errors.dueDate?.message}
            fullWidth
            InputLabelProps={{ shrink: true }}
          />

          <TextField
            select
            label="Trạng thái"
            {...register("status")}
            error={!!errors.status}
            helperText={errors.status?.message}
            fullWidth
            slotProps={{
              select: {
                native: true,
              },
            }}
          >
            <option value="unpaid">Chưa thanh toán</option>
            <option value="partial">Thanh toán một phần</option>
            <option value="paid">Đã thanh toán</option>
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Hủy</Button>
        <Button
          type="submit"
          variant="contained"
          disabled={submitting}
          startIcon={submitting ? <CircularProgress size={20} /> : undefined}
        >
          {submitting ? "Đang xử lý..." : "Lưu"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
