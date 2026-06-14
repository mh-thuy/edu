"use client";

import {
  TextField,
  Stack,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormHelperText,
} from "@mui/material";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { studentCreateSchema } from "@/modules/student/schemas/student.schema";
import type { z } from "zod";
import type { ReactElement } from "react";

type StudentFormData = z.infer<typeof studentCreateSchema>;

export interface StudentFormProps {
  formId?: string;
  onSubmit: (data: StudentFormData) => void | Promise<void>;
  defaultValues?: Partial<StudentFormData>;
}

export function StudentForm({
  formId,
  onSubmit,
  defaultValues,
}: StudentFormProps): ReactElement {
  const { control, handleSubmit } = useForm<StudentFormData>({
    resolver: zodResolver(studentCreateSchema),
    defaultValues: {
      code: defaultValues?.code ?? "",
      fullName: defaultValues?.fullName ?? "",
      phone: defaultValues?.phone ?? "",
      email: defaultValues?.email ?? "",
      address: defaultValues?.address ?? "",
      parentName: defaultValues?.parentName ?? "",
      status: defaultValues?.status ?? "ACTIVE",
    },
  });

  return (
    <form id={formId} onSubmit={handleSubmit(onSubmit)}>
      <Stack spacing={2}>
        <Controller
          name="code"
          control={control}
          render={({ field, fieldState: { error } }) => (
            <TextField
              {...field}
              label="Mã học sinh"
              error={!!error}
              helperText={error?.message}
              fullWidth
              placeholder="VD: S001"
            />
          )}
        />

        <Controller
          name="fullName"
          control={control}
          render={({ field, fieldState: { error } }) => (
            <TextField
              {...field}
              label="Họ tên"
              error={!!error}
              helperText={error?.message}
              fullWidth
            />
          )}
        />

        <Controller
          name="email"
          control={control}
          render={({ field, fieldState: { error } }) => (
            <TextField
              {...field}
              label="Email"
              type="email"
              error={!!error}
              helperText={error?.message}
              fullWidth
            />
          )}
        />

        <Controller
          name="phone"
          control={control}
          render={({ field, fieldState: { error } }) => (
            <TextField
              {...field}
              label="Số điện thoại"
              error={!!error}
              helperText={error?.message}
              fullWidth
            />
          )}
        />

        <Controller
          name="address"
          control={control}
          render={({ field, fieldState: { error } }) => (
            <TextField
              {...field}
              label="Địa chỉ"
              error={!!error}
              helperText={error?.message}
              fullWidth
            />
          )}
        />

        <Controller
          name="parentName"
          control={control}
          render={({ field, fieldState: { error } }) => (
            <TextField
              {...field}
              label="Tên phụ huynh"
              error={!!error}
              helperText={error?.message}
              fullWidth
            />
          )}
        />

        <Controller
          name="status"
          control={control}
          render={({ field, fieldState: { error } }) => (
            <FormControl error={!!error} fullWidth>
              <InputLabel>Trạng thái</InputLabel>
              <Select {...field} label="Trạng thái">
                <MenuItem value="ACTIVE">Hoạt động</MenuItem>
                <MenuItem value="INACTIVE">Ngừng hoạt động</MenuItem>
              </Select>
              <FormHelperText>{error?.message}</FormHelperText>
            </FormControl>
          )}
        />
      </Stack>
    </form>
  );
}
