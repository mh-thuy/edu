"use client";

import { TextField, Stack, Select, MenuItem, FormControl, InputLabel } from "@mui/material";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { roomCreateSchema } from "@/modules/room/schemas/room.schema";
import type { z } from "zod";
import type { ReactElement } from "react";

type RoomFormData = z.infer<typeof roomCreateSchema>;

export interface RoomFormProps {
  onSubmit: (data: RoomFormData) => void;
  defaultValues?: Partial<RoomFormData>;
}

export function RoomForm({ onSubmit, defaultValues }: RoomFormProps): ReactElement {
  const { t } = useTranslation("room");
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
              label={t("roomCode")}
              error={!!error}
              helperText={error?.message}
              fullWidth
              placeholder={t("roomPlaceholder")}
            />
          )}
        />
        <Controller
          name="name"
          control={control}
          render={({ field, fieldState: { error } }) => (
            <TextField
              {...field}
              label={t("roomName")}
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
              label={t("capacity")}
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
              label={t("floor")}
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
              label={t("location")}
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
              <InputLabel>{t("status")}</InputLabel>
              <Select {...field} label={t("status")}>
                <MenuItem value="AVAILABLE">{t("available")}</MenuItem>
                <MenuItem value="OCCUPIED">Occupied</MenuItem>
                <MenuItem value="MAINTENANCE">{t("maintenance")}</MenuItem>
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
              label={t("note")}
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
