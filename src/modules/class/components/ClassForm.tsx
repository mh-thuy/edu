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
import { DatePickerField } from "@/components/shared/forms/DatePickerField";

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
  const statusOptions = isEditing
    ? {
        DRAFT: ["DRAFT", "ACTIVE", "CANCELLED"],
        ACTIVE: ["ACTIVE", "COMPLETED", "CANCELLED"],
        COMPLETED: ["COMPLETED"],
        CANCELLED: ["CANCELLED"],
      }[defaultValues?.status ?? "DRAFT"]
    : ["DRAFT", "ACTIVE", "COMPLETED", "CANCELLED"];
  const statusLabels: Record<string, string> = {
    DRAFT: "Nháp",
    ACTIVE: "Hoạt động",
    COMPLETED: "Hoàn thành",
    CANCELLED: "Đã hủy",
  };

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
                  ? "Mã lớp không thể thay đổi khi chỉnh sửa"
                  : "Nhập mã lớp duy nhất, ví dụ: ENG001")
              }
              fullWidth
              required={!isEditing}
              placeholder="VD: ENG001"
              disabled={isEditing}
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
              helperText={error?.message ?? "Nhập tên lớp dễ nhận biết"}
              fullWidth
              required
              placeholder="VD: Toán 101"
            />
          )}
        />

        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <Controller
            name="startDate"
            control={control}
            render={({ field, fieldState: { error } }) => (
              <DatePickerField
                label="Ngày bắt đầu"
                value={field.value}
                onChange={(value) => field.onChange(toIsoDateTime(value))}
                textFieldProps={{ error: !!error, helperText: error?.message }}
              />
            )}
          />

          <Controller
            name="endDate"
            control={control}
            render={({ field, fieldState: { error } }) => (
              <DatePickerField
                label="Ngày kết thúc"
                value={field.value}
                onChange={(value) => field.onChange(toIsoDateTime(value))}
                textFieldProps={{ error: !!error, helperText: error?.message }}
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
                {statusOptions.map((status) => (
                  <MenuItem key={status} value={status}>
                    {statusLabels[status]}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>{error?.message}</FormHelperText>
            </FormControl>
          )}
        />
      </Stack>
    </form>
  );
}
