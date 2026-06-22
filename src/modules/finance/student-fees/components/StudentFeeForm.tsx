"use client";

import React from "react";
import { Controller, useForm } from "react-hook-form";
import type { Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers";
import dayjs from "dayjs";

import {
  studentFeeCreateSchema,
  studentFeeUpdateSchema,
} from "@/modules/finance/student-fees/schemas/student-fee.schema";
import { useSnackbar } from "@/hooks/useSnackbar";
import { useDisclosure } from "@/hooks/useDisclosure";
import {
  MasterSelectField,
  type MasterSelectValue,
} from "@/components/shared/forms/MasterSelectField";
import { StudentSelectDialog } from "@/components/shared/dialogs/StudentSelectDialog";
import { ClassSelectDialog } from "@/components/shared/dialogs/ClassSelectDialog";
import { extractApiErrorMessage } from "@/lib/api-client";
import { CurrencyInput } from "@/components/shared/forms/CurrencyInput";

type StudentFeeStatus = "UNPAID" | "PARTIAL" | "PAID";

type StudentFeeFormValues = {
  studentId?: string;
  classId?: string;
  month?: string;
  amount: number;
  discount: number;
  paidAmount: number;
  dueDate: string;
  status?: StudentFeeStatus;
  note?: string;
};

interface StudentFeeFormProps {
  initialData?: {
    id: string;
    studentId: string;
    classId: string;
    month: string;
    amount: number;
    discount?: number;
    finalAmount?: number;
    paidAmount?: number;
    outstandingAmount?: number;
    dueDate: string;
    status: "unpaid" | "partial" | "paid" | "UNPAID" | "PARTIAL" | "PAID";
    note?: string | null;
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

function getStatusLabel(status?: StudentFeeStatus) {
  switch (status) {
    case "PAID":
      return "Đã thanh toán";
    case "PARTIAL":
      return "Thanh toán một phần";
    case "UNPAID":
    default:
      return "Chưa thanh toán";
  }
}

function getStatusColor(status?: StudentFeeStatus) {
  switch (status) {
    case "PAID":
      return "success";
    case "PARTIAL":
      return "warning";
    case "UNPAID":
    default:
      return "error";
  }
}

function calculateStatus(
  finalAmount: number,
  paidAmount: number,
): StudentFeeStatus {
  if (paidAmount <= 0) return "UNPAID";
  if (paidAmount < finalAmount) return "PARTIAL";
  return "PAID";
}

export function StudentFeeForm({
  initialData,
  onClose,
  onSuccess,
}: StudentFeeFormProps) {
  const snackbar = useSnackbar();
  const isCreating = !initialData;

  const [submitting, setSubmitting] = React.useState(false);

  const [selectedStudent, setSelectedStudent] =
    React.useState<MasterSelectValue | null>(
      initialData?.student
        ? {
            id: initialData.studentId,
            code: initialData.student.code,
            name: initialData.student.fullName,
          }
        : null,
    );

  const [selectedClass, setSelectedClass] =
    React.useState<MasterSelectValue | null>(
      initialData?.class
        ? {
            id: initialData.classId,
            code: initialData.class.code,
            name: initialData.class.name,
          }
        : null,
    );

  const studentDialog = useDisclosure();
  const classDialog = useDisclosure();

  const resolver = (
    isCreating
      ? zodResolver(studentFeeCreateSchema)
      : zodResolver(studentFeeUpdateSchema)
  ) as any;

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm<StudentFeeFormValues>({
    resolver,
    defaultValues: isCreating
      ? {
          studentId: "",
          classId: "",
          month: dayjs().format("YYYY-MM"),
          amount: 0,
          discount: 0,
          paidAmount: 0,
          dueDate: dayjs().format("YYYY-MM-DD"),
          note: "",
        }
      : {
          amount: Number(initialData.amount ?? 0),
          discount: Number(initialData.discount ?? 0),
          paidAmount: Number(initialData.paidAmount ?? 0),
          dueDate: initialData.dueDate.slice(0, 10),
          status: initialData.status.toUpperCase() as StudentFeeStatus,
          note: initialData.note ?? "",
        },
  });

  const amount = Number(watch("amount") || 0);
  const discount = Number(watch("discount") || 0);
  const paidAmount = Number(watch("paidAmount") || 0);

  const finalAmount = Math.max(amount - discount, 0);
  const outstandingAmount = Math.max(finalAmount - paidAmount, 0);
  const calculatedStatus = calculateStatus(finalAmount, paidAmount);

  const onSubmit = async (data: StudentFeeFormValues) => {
    try {
      setSubmitting(true);

      const payload = {
        ...data,
        finalAmount,
        outstandingAmount,
        status: calculatedStatus,
      };

      const url = isCreating
        ? "/api/student-fees"
        : `/api/student-fees/${initialData.id}`;

      const method = isCreating ? "POST" : "PATCH";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(
          await extractApiErrorMessage(response, "Failed to save"),
        );
      }

      snackbar.showSuccess(
        isCreating ? "Tạo thành công" : "Cập nhật thành công",
      );

      onSuccess();
    } catch (err) {
      snackbar.showError(
        err instanceof Error
          ? err.message
          : isCreating
            ? "Tạo thất bại"
            : "Cập nhật thất bại",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Dialog
        open
        onClose={submitting ? undefined : onClose}
        maxWidth="md"
        fullWidth
        PaperProps={{
          component: "form",
          onSubmit: handleSubmit(onSubmit),
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" justifyContent="space-between" gap={2}>
            <Box>
              <Typography variant="h6" fontWeight={700}>
                {isCreating ? "Thêm học phí" : "Cập nhật học phí"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Quản lý học phí, thanh toán và công nợ của học sinh
              </Typography>
            </Box>

            <Chip
              label={getStatusLabel(calculatedStatus)}
              color={getStatusColor(calculatedStatus)}
              variant="outlined"
              sx={{ fontWeight: 700 }}
            />
          </Stack>
        </DialogTitle>

        <DialogContent sx={{ mt: 1 }}>
          <Stack spacing={2.5} pt={1}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Stack spacing={2}>
                <Typography fontWeight={700}>Thông tin học phí</Typography>

                {isCreating ? (
                  <>
                    <Controller
                      name="studentId"
                      control={control}
                      render={() => (
                        <MasterSelectField
                          label="Học sinh"
                          required
                          value={selectedStudent}
                          onOpen={studentDialog.onOpen}
                          error={errors.studentId?.message}
                          codeLabel="Mã"
                          nameLabel="Tên"
                        />
                      )}
                    />

                    <Controller
                      name="classId"
                      control={control}
                      render={() => (
                        <MasterSelectField
                          label="Lớp"
                          required
                          value={selectedClass}
                          onOpen={classDialog.onOpen}
                          error={errors.classId?.message}
                          codeLabel="Mã"
                          nameLabel="Tên"
                        />
                      )}
                    />

                    <Controller
                      name="month"
                      control={control}
                      render={({ field }) => (
                        <DatePicker
                          label="Kỳ học phí"
                          views={["year", "month"]}
                          format="MM/YYYY"
                          value={field.value ? dayjs(field.value) : null}
                          onChange={(value) => {
                            field.onChange(
                              value ? value.format("YYYY-MM") : "",
                            );
                          }}
                          slotProps={{
                            textField: {
                              fullWidth: true,
                              size: "small",
                              error: !!errors.month,
                              helperText: errors.month?.message,
                            },
                          }}
                        />
                      )}
                    />
                  </>
                ) : (
                  <>
                    <TextField
                      label="Học sinh"
                      value={
                        initialData.student
                          ? `${initialData.student.code} - ${initialData.student.fullName}`
                          : ""
                      }
                      InputProps={{ readOnly: true }}
                      fullWidth
                      size="small"
                    />

                    <TextField
                      label="Lớp"
                      value={
                        initialData.class
                          ? `${initialData.class.code} - ${initialData.class.name}`
                          : ""
                      }
                      InputProps={{ readOnly: true }}
                      fullWidth
                      size="small"
                    />

                    <TextField
                      label="Kỳ học phí"
                      value={initialData.month}
                      InputProps={{ readOnly: true }}
                      fullWidth
                      size="small"
                    />
                  </>
                )}
              </Stack>
            </Paper>

            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Stack spacing={2}>
                <Typography fontWeight={700}>Chi tiết thanh toán</Typography>

                <Controller
                  name="amount"
                  control={control}
                  render={({ field }) => (
                    <CurrencyInput
                      label="Học phí gốc"
                      value={field.value}
                      onChange={field.onChange}
                      error={errors.amount}
                      disabled={submitting}
                    />
                  )}
                />

                <Controller
                  name="discount"
                  control={control}
                  render={({ field }) => (
                    <CurrencyInput
                      label="Giảm giá"
                      value={field.value}
                      onChange={field.onChange}
                      error={errors.discount}
                      disabled={submitting}
                    />
                  )}
                />

                <Divider />

                <CurrencyInput
                  label="Thành tiền"
                  value={finalAmount}
                  readOnly
                  disabled
                  sx={{
                    "& .MuiInputBase-root": {
                      bgcolor: "success.50",
                    },
                    "& .MuiInputBase-input": {
                      fontWeight: 700,
                      fontSize: 18,
                      color: "success.main",
                    },
                  }}
                />

                <Controller
                  name="paidAmount"
                  control={control}
                  render={({ field }) => (
                    <CurrencyInput
                      label="Đã thanh toán"
                      value={field.value}
                      onChange={field.onChange}
                      disabled={submitting}
                    />
                  )}
                />

                <CurrencyInput
                  label="Còn lại"
                  value={outstandingAmount}
                  readOnly
                  disabled
                  sx={{
                    "& .MuiInputBase-root": {
                      bgcolor:
                        outstandingAmount > 0 ? "error.50" : "success.50",
                    },
                    "& .MuiInputBase-input": {
                      fontWeight: 700,
                      fontSize: 18,
                      color:
                        outstandingAmount > 0 ? "error.main" : "success.main",
                    },
                  }}
                />
              </Stack>
            </Paper>

            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Stack spacing={2}>
                <Typography fontWeight={700}>
                  Thông tin hạn thanh toán
                </Typography>

                <Controller
                  name="dueDate"
                  control={control}
                  render={({ field }) => (
                    <DatePicker
                      label="Hạn thanh toán"
                      format="DD/MM/YYYY"
                      value={field.value ? dayjs(field.value) : null}
                      onChange={(value) => {
                        field.onChange(value ? value.format("YYYY-MM-DD") : "");
                      }}
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          size: "small",
                          error: !!errors.dueDate,
                          helperText: errors.dueDate?.message,
                        },
                      }}
                    />
                  )}
                />

                <TextField
                  label="Trạng thái"
                  value={getStatusLabel(calculatedStatus)}
                  InputProps={{ readOnly: true }}
                  fullWidth
                  size="small"
                />

                <TextField
                  label="Ghi chú"
                  {...register("note")}
                  error={!!errors.note}
                  helperText={errors.note?.message}
                  fullWidth
                  size="small"
                  multiline
                  minRows={3}
                  disabled={submitting}
                />
              </Stack>
            </Paper>
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} disabled={submitting}>
            Hủy
          </Button>

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

      <StudentSelectDialog
        open={studentDialog.open}
        onClose={studentDialog.onClose}
        onSelect={(item) => {
          setSelectedStudent({
            id: item.id,
            code: item.code,
            name: item.fullName,
          });

          setValue("studentId", item.id, {
            shouldValidate: true,
            shouldDirty: true,
          });

          studentDialog.onClose();
        }}
      />

      <ClassSelectDialog
        open={classDialog.open}
        onClose={classDialog.onClose}
        onSelect={(item) => {
          setSelectedClass({
            id: item.id,
            code: item.code,
            name: item.name,
          });

          setValue("classId", item.id, {
            shouldValidate: true,
            shouldDirty: true,
          });

          classDialog.onClose();
        }}
      />

      {snackbar.Snackbar}
    </>
  );
}
