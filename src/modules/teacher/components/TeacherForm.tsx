"use client";

import {
  TextField,
  Stack,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormHelperText,
  Box,
} from "@mui/material";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { teacherCreateSchema } from "@/modules/teacher/schemas/teacher.schema";
import type { z } from "zod";
import type { ReactElement } from "react";

type TeacherFormData = z.infer<typeof teacherCreateSchema>;

export interface TeacherFormProps {
  onSubmit: (data: TeacherFormData) => void | Promise<void>;
  defaultValues?: Partial<TeacherFormData>;
}

export function TeacherForm({
  onSubmit,
  defaultValues,
}: TeacherFormProps): ReactElement {
  const { control, handleSubmit } = useForm<TeacherFormData>({
    resolver: zodResolver(teacherCreateSchema),
    defaultValues: {
      code: defaultValues?.code ?? "",
      phone: defaultValues?.phone ?? "",
      email: defaultValues?.email ?? "",
      bankAccount: defaultValues?.bankAccount ?? "",
      specialty: defaultValues?.specialty ?? "",
      status: defaultValues?.status ?? "ACTIVE",
    },
  });

  return (
    <Box component="form" onSubmit={handleSubmit(onSubmit)}>
      <Stack spacing={2.5}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <Controller
            name="code"
            control={control}
            render={({ field, fieldState: { error } }) => (
              <TextField
                {...field}
                label="Mã giáo viên"
                placeholder="VD: GV001"
                error={!!error}
                helperText={error?.message}
                fullWidth
                size="small"
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
                placeholder="VD: 0912345678"
                error={!!error}
                helperText={error?.message}
                fullWidth
                size="small"
              />
            )}
          />
        </Stack>

        <Controller
          name="email"
          control={control}
          render={({ field, fieldState: { error } }) => (
            <TextField
              {...field}
              label="Email"
              type="email"
              placeholder="VD: giaovien@example.com"
              error={!!error}
              helperText={error?.message}
              fullWidth
              size="small"
            />
          )}
        />

        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <Controller
            name="bankAccount"
            control={control}
            render={({ field, fieldState: { error } }) => (
              <TextField
                {...field}
                label="Tài khoản ngân hàng"
                placeholder="VD: 123456789"
                error={!!error}
                helperText={error?.message}
                fullWidth
                size="small"
              />
            )}
          />

          <Controller
            name="specialty"
            control={control}
            render={({ field, fieldState: { error } }) => (
              <TextField
                {...field}
                label="Chuyên môn"
                placeholder="VD: Toán học"
                error={!!error}
                helperText={error?.message}
                fullWidth
                size="small"
              />
            )}
          />
        </Stack>

        <Controller
          name="status"
          control={control}
          render={({ field, fieldState: { error } }) => (
            <FormControl error={!!error} fullWidth size="small">
              <InputLabel>Trạng thái</InputLabel>
              <Select {...field} label="Trạng thái">
                <MenuItem value="ACTIVE">Đang hoạt động</MenuItem>
                <MenuItem value="INACTIVE">Ngừng hoạt động</MenuItem>
              </Select>

              {error?.message && (
                <FormHelperText>{error.message}</FormHelperText>
              )}
            </FormControl>
          )}
        />
      </Stack>
    </Box>
  );
}
