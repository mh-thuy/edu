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
import { type ReactElement } from "react";

type ClassFormData = z.infer<typeof classCreateSchema>;

type ClassFormDefaultValues = Partial<ClassFormData> & {};

export interface ClassFormProps {
  formId?: string;
  onSubmit: (data: ClassFormData) => void | Promise<void>;
  defaultValues?: ClassFormDefaultValues;
}

export function ClassForm({
  formId,
  onSubmit,
  defaultValues,
}: ClassFormProps): ReactElement {
  const isEditing = Boolean(defaultValues?.code);

  const { control, handleSubmit } = useForm<ClassFormData>({
    resolver: zodResolver(classCreateSchema),
    defaultValues: {
      code: defaultValues?.code ?? "",
      name: defaultValues?.name ?? "",
      startDate: defaultValues?.startDate ?? undefined,
      endDate: defaultValues?.endDate ?? undefined,
      status: defaultValues?.status ?? "DRAFT",
    },
  });

  const toInputDateValue = (value?: string) => value?.slice(0, 10) ?? "";

  const toIsoDateTime = (value: string) =>
    value ? new Date(`${value}T00:00:00.000Z`).toISOString() : undefined;

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
              helperText={
                error?.message ??
                (isEditing
                  ? "Mã lớp được hệ thống tạo tự động"
                  : "Mã lớp sẽ được hệ thống tạo tự động khi lưu")
              }
              fullWidth
              placeholder="Tự động tạo khi lưu"
              disabled
              autoFocus
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

        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <Controller
            name="startDate"
            control={control}
            render={({ field, fieldState: { error } }) => (
              <TextField
                label="Ngày bắt đầu"
                type="date"
                value={toInputDateValue(field.value)}
                error={!!error}
                helperText={error?.message}
                fullWidth
                InputLabelProps={{ shrink: true }}
                onChange={(event) => {
                  field.onChange(toIsoDateTime(event.target.value));
                }}
              />
            )}
          />

          <Controller
            name="endDate"
            control={control}
            render={({ field, fieldState: { error } }) => (
              <TextField
                label="Ngày kết thúc"
                type="date"
                value={toInputDateValue(field.value)}
                error={!!error}
                helperText={error?.message}
                fullWidth
                InputLabelProps={{ shrink: true }}
                onChange={(event) => {
                  field.onChange(toIsoDateTime(event.target.value));
                }}
              />
            )}
          />
        </Stack>

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
