"use client";

import { TextField, Stack, Select, MenuItem, FormControl, InputLabel } from "@mui/material";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { roomCreateSchema } from "@/modules/room/schemas/room.schema";
import type { z } from "zod";
import type { ReactElement } from "react";

type RoomFormData = z.infer<typeof roomCreateSchema>;

export interface RoomFormProps {
  onSubmit: (data: RoomFormData) => void;
  defaultValues?: Partial<RoomFormData>;
}

export function RoomForm({ onSubmit, defaultValues }: RoomFormProps): ReactElement {
  const { control, handleSubmit } = useForm<RoomFormData>({
    resolver: zodResolver(roomCreateSchema),
    defaultValues: {
      code: "",
      name: "",
      capacity: 30,
      floor: 1,
      location: "",
      status: "AVAILABLE",
      note: "",
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
              label="Room Code"
              error={!!error}
              helperText={error?.message}
              fullWidth
              placeholder="e.g., A101"
            />
          )}
        />
        <Controller
          name="name"
          control={control}
          render={({ field, fieldState: { error } }) => (
            <TextField
              {...field}
              label="Room Name"
              error={!!error}
              helperText={error?.message}
              fullWidth
              placeholder="e.g., Main Classroom"
            />
          )}
        />
        <Controller
          name="capacity"
          control={control}
          render={({ field, fieldState: { error } }) => (
            <TextField
              {...field}
              label="Capacity"
              type="number"
              error={!!error}
              helperText={error?.message}
              fullWidth
              onChange={(e) => field.onChange(Number(e.target.value))}
            />
          )}
        />
        <Controller
          name="floor"
          control={control}
          render={({ field, fieldState: { error } }) => (
            <TextField
              {...field}
              label="Floor"
              type="number"
              error={!!error}
              helperText={error?.message}
              fullWidth
              onChange={(e) => field.onChange(Number(e.target.value))}
            />
          )}
        />
        <Controller
          name="location"
          control={control}
          render={({ field, fieldState: { error } }) => (
            <TextField
              {...field}
              label="Location"
              error={!!error}
              helperText={error?.message}
              fullWidth
              placeholder="e.g., Building A"
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
                <MenuItem value="AVAILABLE">Available</MenuItem>
                <MenuItem value="OCCUPIED">Occupied</MenuItem>
                <MenuItem value="MAINTENANCE">Maintenance</MenuItem>
              </Select>
            </FormControl>
          )}
        />
        <Controller
          name="note"
          control={control}
          render={({ field, fieldState: { error } }) => (
            <TextField
              {...field}
              label="Note"
              error={!!error}
              helperText={error?.message}
              fullWidth
              multiline
              rows={2}
            />
          )}
        />
      </Stack>
    </form>
  );
}
