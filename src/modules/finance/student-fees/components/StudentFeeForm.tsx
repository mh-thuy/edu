"use client";

import React from "react";
import { useForm } from "react-hook-form";
import type { Resolver } from "react-hook-form";
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
  const snackbar = useSnackbar();
  const [submitting, setSubmitting] = React.useState(false);
  const isCreating = !initialData;

  const resolver: Resolver<StudentFeeUpdateInput> = (
    isCreating
      ? (zodResolver(studentFeeCreateSchema) as unknown)
      : (zodResolver(studentFeeUpdateSchema) as unknown)
  ) as Resolver<StudentFeeUpdateInput>;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<StudentFeeUpdateInput>({
    resolver,
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

  const onSubmit = async (
    data: StudentFeeCreateInput | StudentFeeUpdateInput,
  ) => {
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
      snackbar.showSuccess(
        isCreating ? "Tạo thành công" : "Cập nhật thành công",
      );
      onSuccess();
    } catch {
      snackbar.showError(isCreating ? "Tạo thất bại" : "Cập nhật thất bại");
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
      <DialogTitle>{isCreating ? "Tạo hóa đơn" : "Sửa hóa đơn"}</DialogTitle>
      <DialogContent sx={{ mt: 2 }}>
        <Stack spacing={2}>
          {isCreating ? (
            <>
              <TextField
                label="Mã học sinh"
                {...register("studentId")}
                error={!!errors.studentId}
                helperText={errors.studentId?.message}
                fullWidth
              />

              <TextField
                label="Mã lớp"
                {...register("classId")}
                error={!!errors.classId}
                helperText={errors.classId?.message}
                fullWidth
              />

              <TextField
                label="Tháng (YYYY-MM)"
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
                label="Học sinh"
                value={initialData?.studentId}
                disabled
                fullWidth
              />
              <TextField
                label="Lớp"
                value={initialData?.classId}
                disabled
                fullWidth
              />
              <TextField
                label="Tháng"
                value={initialData?.month}
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

          {!isCreating && (
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
          )}
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
