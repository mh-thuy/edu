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
import { classCreateSchema } from "@/modules/class/schemas/class.schema";
import type { z } from "zod";
import type { ReactElement } from "react";

type ClassFormData = z.infer<typeof classCreateSchema>;

export interface ClassFormProps {
  formId?: string;
  onSubmit: (data: ClassFormData) => void | Promise<void>;
  defaultValues?: Partial<ClassFormData>;
}

export function ClassForm({
  formId,
  onSubmit,
  defaultValues,
}: ClassFormProps): ReactElement {
  const { control, handleSubmit } = useForm<ClassFormData>({
    resolver: zodResolver(classCreateSchema),
    defaultValues: {
      code: defaultValues?.code ?? "",
      name: defaultValues?.name ?? "",
      tuitionFee: defaultValues?.tuitionFee ?? 0,
      totalSessions: defaultValues?.totalSessions ?? 0,
      maxStudents: defaultValues?.maxStudents ?? 30,
      status: defaultValues?.status ?? "DRAFT",
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
              label="Mã lớp"
              error={!!error}
              helperText={error?.message}
              fullWidth
              placeholder="VD: C001"
            />
          )}
        />

        <Controller
          name="name"
          control={control}
          render={({ field, fieldState: { error } }) => (
            <TextField
              {...field}
              label="Tên lớp"
              error={!!error}
              helperText={error?.message}
              fullWidth
              placeholder="VD: Toán 101"
            />
          )}
        />

        <Controller
          name="tuitionFee"
          control={control}
          render={({ field, fieldState: { error } }) => (
            <TextField
              {...field}
              label="Học phí"
              type="number"
              error={!!error}
              helperText={error?.message}
              fullWidth
              onChange={(event) => {
                field.onChange(Number(event.target.value || 0));
              }}
            />
          )}
        />

        <Controller
          name="totalSessions"
          control={control}
          render={({ field, fieldState: { error } }) => (
            <TextField
              {...field}
              label="Tổng số buổi"
              type="number"
              error={!!error}
              helperText={error?.message}
              fullWidth
              onChange={(event) => {
                field.onChange(Number(event.target.value || 0));
              }}
            />
          )}
        />

        <Controller
          name="maxStudents"
          control={control}
          render={({ field, fieldState: { error } }) => (
            <TextField
              {...field}
              label="Sĩ số tối đa"
              type="number"
              error={!!error}
              helperText={error?.message}
              fullWidth
              onChange={(event) => {
                field.onChange(Number(event.target.value || 0));
              }}
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
                <MenuItem value="DRAFT">Nháp</MenuItem>
                <MenuItem value="ACTIVE">Hoạt động</MenuItem>
                <MenuItem value="COMPLETED">Hoàn thành</MenuItem>
                <MenuItem value="CANCELLED">Đã hủy</MenuItem>
              </Select>
              <FormHelperText>{error?.message}</FormHelperText>
            </FormControl>
          )}
        />
      </Stack>
    </form>
  );
}
