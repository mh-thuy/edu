/* eslint-disable @typescript-eslint/no-explicit-any */

"use client";

import {
  TextField,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
} from "@mui/material";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { classScheduleCreateSchema } from "@/modules/schedule/schemas/schedule.schema";
import type { z } from "zod";
import { useState, useEffect, type ReactElement } from "react";

type ScheduleFormData = z.infer<typeof classScheduleCreateSchema>;

export interface ScheduleFormProps {
  onSubmit: (data: ScheduleFormData) => void;
  defaultValues?: Partial<ScheduleFormData>;
  onConflictCheck?: (conflicts: any) => void;
}

export function ScheduleForm({
  onSubmit,
  defaultValues,
  onConflictCheck,
}: ScheduleFormProps): ReactElement {
  const { control, handleSubmit, watch } = useForm<ScheduleFormData>({
    resolver: zodResolver(classScheduleCreateSchema),
    defaultValues: {
      classId: "",
      dayOfWeek: 0,
      startTime: "08:00",
      endTime: "10:00",
      ...defaultValues,
    },
  });

  const [conflicts, setConflicts] = useState<any>(null);
  const roomId = watch("roomId");
  const dayOfWeek = watch("dayOfWeek");
  const startTime = watch("startTime");
  const endTime = watch("endTime");

  useEffect(() => {
    const checkConflicts = async () => {
      if (!roomId || dayOfWeek === undefined) return;

      try {
        const response = await fetch("/api/rooms/check-conflict", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId, dayOfWeek, startTime, endTime }),
        });
        const data = await response.json();
        setConflicts(data.hasConflict ? data : null);
        onConflictCheck?.(data);
      } catch (err) {
        console.error("Conflict check failed:", err);
      }
    };

    checkConflicts();
  }, [roomId, dayOfWeek, startTime, endTime, onConflictCheck]);

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Stack spacing={2}>
        <Controller
          name="classId"
          control={control}
          render={({ field, fieldState: { error } }) => (
            <FormControl error={!!error} fullWidth>
              <InputLabel>Class</InputLabel>
              <Select {...field} label="Class">
                <MenuItem value="">Select a class</MenuItem>
              </Select>
            </FormControl>
          )}
        />
        <Controller
          name="roomId"
          control={control}
          render={({ field, fieldState: { error } }) => (
            <FormControl error={!!error} fullWidth>
              <InputLabel>Room</InputLabel>
              <Select {...field} label="Room">
                <MenuItem value="">Select a room</MenuItem>
              </Select>
            </FormControl>
          )}
        />
        <Controller
          name="dayOfWeek"
          control={control}
          render={({ field, fieldState: { error } }) => (
            <FormControl error={!!error} fullWidth>
              <InputLabel>Day of Week</InputLabel>
              <Select
                {...field}
                label="Day of Week"
                onChange={(e) => field.onChange(Number(e.target.value))}
              >
                <MenuItem value={0}>Monday</MenuItem>
                <MenuItem value={1}>Tuesday</MenuItem>
                <MenuItem value={2}>Wednesday</MenuItem>
                <MenuItem value={3}>Thursday</MenuItem>
                <MenuItem value={4}>Friday</MenuItem>
                <MenuItem value={5}>Saturday</MenuItem>
                <MenuItem value={6}>Sunday</MenuItem>
              </Select>
            </FormControl>
          )}
        />
        <Controller
          name="startTime"
          control={control}
          render={({ field, fieldState: { error } }) => (
            <TextField
              {...field}
              label="Start Time"
              type="time"
              error={!!error}
              helperText={error?.message}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          )}
        />
        <Controller
          name="endTime"
          control={control}
          render={({ field, fieldState: { error } }) => (
            <TextField
              {...field}
              label="End Time"
              type="time"
              error={!!error}
              helperText={error?.message}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          )}
        />
        {conflicts && (
          <Alert severity="warning">
            Room conflict detected! Please choose a different time slot.
          </Alert>
        )}
      </Stack>
    </form>
  );
}
