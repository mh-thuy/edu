"use client";

import { TextField, Stack, Select, MenuItem, FormControl, InputLabel } from "@mui/material";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { classCreateSchema } from "@/modules/class/schemas/class.schema";
import type { z } from "zod";
import type { ReactElement } from "react";

type ClassFormData = z.infer<typeof classCreateSchema>;

export interface ClassFormProps {
  onSubmit: (data: ClassFormData) => void;
  defaultValues?: Partial<ClassFormData>;
}

export function ClassForm({ onSubmit, defaultValues }: ClassFormProps): ReactElement {
  const { control, handleSubmit } = useForm<ClassFormData>({
    resolver: zodResolver(classCreateSchema),
    defaultValues: {
      code: "",
      name: "",
      tuitionFee: 0,
      totalSessions: 0,
      maxStudents: 30,
      status: "DRAFT",
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
              label="Class Code"
              error={!!error}
              helperText={error?.message}
              fullWidth
              placeholder="e.g., C001"
            />
          )}
        />
        <Controller
          name="name"
          control={control}
          render={({ field, fieldState: { error } }) => (
            <TextField
              {...field}
              label="Class Name"
              error={!!error}
              helperText={error?.message}
              fullWidth
              placeholder="e.g., Math 101"
            />
          )}
        />
        <Controller
          name="tuitionFee"
          control={control}
          render={({ field, fieldState: { error } }) => (
            <TextField
              {...field}
              label="Tuition Fee"
              type="number"
              error={!!error}
              helperText={error?.message}
              fullWidth
              onChange={(e) => field.onChange(Number(e.target.value))}
            />
          )}
        />
        <Controller
          name="totalSessions"
          control={control}
          render={({ field, fieldState: { error } }) => (
            <TextField
              {...field}
              label="Total Sessions"
              type="number"
              error={!!error}
              helperText={error?.message}
              fullWidth
              onChange={(e) => field.onChange(Number(e.target.value))}
            />
          )}
        />
        <Controller
          name="maxStudents"
          control={control}
          render={({ field, fieldState: { error } }) => (
            <TextField
              {...field}
              label="Max Students"
              type="number"
              error={!!error}
              helperText={error?.message}
              fullWidth
              onChange={(e) => field.onChange(Number(e.target.value))}
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
                <MenuItem value="DRAFT">Draft</MenuItem>
                <MenuItem value="ACTIVE">Active</MenuItem>
                <MenuItem value="COMPLETED">Completed</MenuItem>
                <MenuItem value="CANCELLED">Cancelled</MenuItem>
              </Select>
            </FormControl>
          )}
        />
      </Stack>
    </form>
  );
}
