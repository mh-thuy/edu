"use client";

import React from "react";
import { useForm, Controller } from "react-hook-form";
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
import {
  MasterSelectField,
  type MasterSelectValue,
} from "@/components/shared/MasterSelectField";
import { StudentSelectDialog } from "@/components/shared/StudentSelectDialog";
import { ClassSelectDialog } from "@/components/shared/ClassSelectDialog";
import { useDisclosure } from "@/hooks/useDisclosure";

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

export function StudentFeeForm({
  initialData,
  onClose,
  onSuccess,
}: StudentFeeFormProps) {
  const snackbar = useSnackbar();
  const [submitting, setSubmitting] = React.useState(false);
  const isCreating = !initialData;

  // Local display state for selected student/class (id stored in form)
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

  const resolver: Resolver<StudentFeeUpdateInput> = (
    isCreating
      ? (zodResolver(studentFeeCreateSchema) as unknown)
      : (zodResolver(studentFeeUpdateSchema) as unknown)
  ) as Resolver<StudentFeeUpdateInput>;

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<StudentFeeUpdateInput>({
    resolver,
    defaultValues: isCreating
      ? {
          studentId: "",
          classId: "",
          month: new Date().toISOString().slice(0, 7),
          amount: 0,
          dueDate: new Date().toISOString().split("T")[0] || "",
        }
      : {
          amount: initialData?.amount,
          dueDate: initialData?.dueDate?.slice(0, 10),
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
        response = await fetch("/api/student-fees", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
      } else {
        response = await fetch(`/api/student-fees/${initialData?.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
      }

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to save");
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
        onClose={onClose}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          component: "form",
          onSubmit: handleSubmit(onSubmit),
        }}
      >
        <DialogTitle>{isCreating ? "Thêm học phí" : "Cập nhật học phí"}</DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Stack spacing={2}>
            {isCreating ? (
              <>
                {/* Student picker */}
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

                {/* Class picker */}
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
                  value={
                    initialData?.student
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
                    initialData?.class
                      ? `${initialData.class.code} - ${initialData.class.name}`
                      : ""
                  }
                  InputProps={{ readOnly: true }}
                  fullWidth
                  size="small"
                />
                <TextField
                  label="Tháng"
                  value={initialData?.month ?? ""}
                  InputProps={{ readOnly: true }}
                  fullWidth
                  size="small"
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
              inputProps={{ step: "1000", min: 0 }}
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
                slotProps={{ select: { native: true } }}
              >
                <option value="unpaid">Chưa thanh toán</option>
                <option value="partial">Thanh toán một phần</option>
                <option value="paid">Đã thanh toán</option>
              </TextField>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
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

      {/* Student picker dialog */}
      <StudentSelectDialog
        open={studentDialog.open}
        onClose={studentDialog.onClose}
        onSelect={(item) => {
          const display = { id: item.id, code: item.code, name: item.fullName };
          setSelectedStudent(display);
          setValue("studentId", item.id, { shouldValidate: true });
          studentDialog.onClose();
        }}
      />

      {/* Class picker dialog */}
      <ClassSelectDialog
        open={classDialog.open}
        onClose={classDialog.onClose}
        onSelect={(item) => {
          const display = { id: item.id, code: item.code, name: item.name };
          setSelectedClass(display);
          setValue("classId", item.id, { shouldValidate: true });
          classDialog.onClose();
        }}
      />

      {snackbar.Snackbar}
    </>
  );
}
