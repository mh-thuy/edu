"use client";

import { TextField, Stack, Select, MenuItem, FormControl, InputLabel } from "@mui/material";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { teacherCreateSchema } from "@/modules/teacher/schemas/teacher.schema";
import type { z } from "zod";
import type { ReactElement } from "react";

type TeacherFormData = z.infer<typeof teacherCreateSchema>;

export interface TeacherFormProps {
  onSubmit: (data: TeacherFormData) => void;
  defaultValues?: Partial<TeacherFormData>;
}

export function TeacherForm({ onSubmit, defaultValues }: TeacherFormProps): ReactElement {
  const { control, handleSubmit } = useForm<TeacherFormData>({
    resolver: zodResolver(teacherCreateSchema),
    defaultValues: {
      code: "",
      phone: "",
      email: "",
      bankAccount: "",
      specialty: "",
      status: "ACTIVE",
      ...defaultValues,
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Stack spacing={2}>
        <Controller
          name="code"
          control={control}
          render={({ field, fieldState: { error } }) => (
            <TextField
              {...field}
              label="Teacher Code"
              error={!!error}
              helperText={error?.message}
              fullWidth
              placeholder="e.g., T001"
            />
          )}
        />
        <Controller
          name="phone"
          control={control}
          render={({ field, fieldState: { error } }) => (
            <TextField
              {...field}
              label="Phone"
              error={!!error}
              helperText={error?.message}
              fullWidth
              placeholder="e.g., 0912345678"
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
              placeholder="teacher@example.com"
            />
          )}
        />
        <Controller
          name="bankAccount"
          control={control}
          render={({ field, fieldState: { error } }) => (
            <TextField
              {...field}
              label="Bank Account"
              error={!!error}
              helperText={error?.message}
              fullWidth
              placeholder="e.g., 123456789"
            />
          )}
        />
        <Controller
          name="specialty"
          control={control}
          render={({ field, fieldState: { error } }) => (
            <TextField
              {...field}
              label="Specialty"
              error={!!error}
              helperText={error?.message}
              fullWidth
              placeholder="e.g., Mathematics"
            />
          )}
        />
        <Controller
          name="status"
          control={control}
          render={({ field, fieldState: { error } }) => (
            <FormControl error={!!error} fullWidth>
              <InputLabel>Status</InputLabel>
              <Select {...field} label="Status">
                <MenuItem value="ACTIVE">Active</MenuItem>
                <MenuItem value="INACTIVE">Inactive</MenuItem>
              </Select>
            </FormControl>
          )}
        />
      </Stack>
    </form>
  );
}
