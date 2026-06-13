"use client";

import { TextField, Stack, Select, MenuItem, FormControl, InputLabel } from "@mui/material";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { studentCreateSchema } from "@/modules/student/schemas/student.schema";
import type { z } from "zod";
import type { ReactElement } from "react";

type StudentFormData = z.infer<typeof studentCreateSchema>;

export interface StudentFormProps {
  onSubmit: (data: StudentFormData) => void;
  defaultValues?: Partial<StudentFormData>;
}

export function StudentForm({ onSubmit, defaultValues }: StudentFormProps): ReactElement {
  const { control, handleSubmit } = useForm<StudentFormData>({
    resolver: zodResolver(studentCreateSchema),
    defaultValues: {
      code: "",
      fullName: "",
      phone: "",
      email: "",
      address: "",
      parentName: "",
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
              label="Student Code"
              error={!!error}
              helperText={error?.message}
              fullWidth
              placeholder="e.g., S001"
            />
          )}
        />
        <Controller
          name="fullName"
          control={control}
          render={({ field, fieldState: { error } }) => (
            <TextField
              {...field}
              label="Full Name"
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
            <TextField {...field} label="Phone" error={!!error} helperText={error?.message} fullWidth />
          )}
        />
        <Controller
          name="address"
          control={control}
          render={({ field, fieldState: { error } }) => (
            <TextField {...field} label="Address" error={!!error} helperText={error?.message} fullWidth />
          )}
        />
        <Controller
          name="parentName"
          control={control}
          render={({ field, fieldState: { error } }) => (
            <TextField {...field} label="Parent Name" error={!!error} helperText={error?.message} fullWidth />
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
