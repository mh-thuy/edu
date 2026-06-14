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
  FormHelperText,
  CircularProgress,
  Box,
} from "@mui/material";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { classScheduleCreateSchema } from "@/modules/schedule/schemas/schedule.schema";
import type { z } from "zod";
import { useState, useEffect, type ReactElement } from "react";

type ScheduleFormData = z.infer<typeof classScheduleCreateSchema>;

interface DropdownOption {
  id: string;
  name: string;
  code?: string;
}

export interface ScheduleFormProps {
  formId?: string;
  onSubmit: (data: ScheduleFormData) => void | Promise<void>;
  defaultValues?: Partial<ScheduleFormData>;
  onConflictCheck?: (conflicts: any) => void;
}

export function ScheduleForm({
  formId,
  onSubmit,
  defaultValues,
  onConflictCheck,
}: ScheduleFormProps): ReactElement {
  const { control, handleSubmit, watch } = useForm<ScheduleFormData>({
    resolver: zodResolver(classScheduleCreateSchema),
    defaultValues: {
      classId: defaultValues?.classId ?? "",
      roomId: defaultValues?.roomId ?? "",
      dayOfWeek: defaultValues?.dayOfWeek ?? 0,
      startTime: defaultValues?.startTime ?? "08:00",
      endTime: defaultValues?.endTime ?? "10:00",
    },
  });

  const [conflicts, setConflicts] = useState<any>(null);
  const [classes, setClasses] = useState<DropdownOption[]>([]);
  const [rooms, setRooms] = useState<DropdownOption[]>([]);
  const [isLoadingDropdowns, setIsLoadingDropdowns] = useState(true);

  const roomId = watch("roomId");
  const dayOfWeek = watch("dayOfWeek");
  const startTime = watch("startTime");
  const endTime = watch("endTime");

  // Fetch classes and rooms on mount
  useEffect(() => {
    const fetchDropdownOptions = async () => {
      try {
        setIsLoadingDropdowns(true);
        const [classRes, roomRes] = await Promise.all([
          fetch("/api/classes?limit=100&page=1"),
          fetch("/api/rooms?limit=100&page=1"),
        ]);

        if (classRes.ok) {
          const classData = await classRes.json();
          setClasses(
            classData.items?.map((c: any) => ({
              id: c.id,
              name: c.name,
              code: c.code,
            })) || [],
          );
        }

        if (roomRes.ok) {
          const roomData = await roomRes.json();
          setRooms(
            roomData.items?.map((r: any) => ({
              id: r.id,
              name: r.name,
              code: r.code,
            })) || [],
          );
        }
      } catch (err) {
        console.error("Failed to fetch dropdown options:", err);
      } finally {
        setIsLoadingDropdowns(false);
      }
    };

    fetchDropdownOptions();
  }, []);

  // Check room conflicts
  useEffect(() => {
    const checkConflicts = async () => {
      if (!roomId || dayOfWeek === undefined || !startTime || !endTime) {
        setConflicts(null);
        onConflictCheck?.({ hasConflict: false });
        return;
      }

      try {
        const response = await fetch("/api/rooms/check-conflict", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId, dayOfWeek, startTime, endTime }),
        });

        if (!response.ok) {
          setConflicts(null);
          return;
        }

        const data = await response.json();

        setConflicts(data.hasConflict ? data : null);
        onConflictCheck?.(data);
      } catch (err) {
        console.error("Conflict check failed:", err);
        setConflicts(null);
      }
    };

    const timeoutId = window.setTimeout(checkConflicts, 300);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [roomId, dayOfWeek, startTime, endTime, onConflictCheck]);

  return (
    <form id={formId} onSubmit={handleSubmit(onSubmit)}>
      <Stack spacing={2}>
        <Controller
          name="classId"
          control={control}
          render={({ field, fieldState: { error } }) => (
            <FormControl
              error={!!error}
              fullWidth
              disabled={isLoadingDropdowns}
            >
              <InputLabel>Lớp học</InputLabel>
              <Select {...field} value={field.value ?? ""} label="Lớp học">
                <MenuItem value="">
                  {isLoadingDropdowns ? "Đang tải..." : "Chọn lớp học"}
                </MenuItem>
                {classes.map((cls) => (
                  <MenuItem key={cls.id} value={cls.id}>
                    {cls.name} ({cls.code})
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>{error?.message}</FormHelperText>
            </FormControl>
          )}
        />

        <Controller
          name="roomId"
          control={control}
          render={({ field, fieldState: { error } }) => (
            <FormControl
              error={!!error}
              fullWidth
              disabled={isLoadingDropdowns}
            >
              <InputLabel>Phòng học</InputLabel>
              <Select
                {...field}
                value={field.value ?? ""}
                label="Phòng học"
                sx={{
                  "& .MuiSelect-select": {
                    minHeight: "auto",
                  },
                }}
              >
                <MenuItem value="">
                  {isLoadingDropdowns ? "Đang tải..." : "Chọn phòng học"}
                </MenuItem>
                {rooms.map((room) => (
                  <MenuItem key={room.id} value={room.id}>
                    {room.name} ({room.code})
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>{error?.message}</FormHelperText>
            </FormControl>
          )}
        />

        <Controller
          name="dayOfWeek"
          control={control}
          render={({ field, fieldState: { error } }) => (
            <FormControl error={!!error} fullWidth>
              <InputLabel>Ngày trong tuần</InputLabel>
              <Select
                {...field}
                value={field.value ?? 0}
                label="Ngày trong tuần"
                onChange={(event) => {
                  field.onChange(Number(event.target.value));
                }}
              >
                <MenuItem value={0}>Thứ 2</MenuItem>
                <MenuItem value={1}>Thứ 3</MenuItem>
                <MenuItem value={2}>Thứ 4</MenuItem>
                <MenuItem value={3}>Thứ 5</MenuItem>
                <MenuItem value={4}>Thứ 6</MenuItem>
                <MenuItem value={5}>Thứ 7</MenuItem>
                <MenuItem value={6}>Chủ nhật</MenuItem>
              </Select>
              <FormHelperText>{error?.message}</FormHelperText>
            </FormControl>
          )}
        />

        <Controller
          name="startTime"
          control={control}
          render={({ field, fieldState: { error } }) => (
            <TextField
              {...field}
              value={field.value ?? ""}
              label="Giờ bắt đầu"
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
              value={field.value ?? ""}
              label="Giờ kết thúc"
              type="time"
              error={!!error}
              helperText={error?.message}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          )}
        />

        {conflicts && (
          <Alert severity="warning" sx={{ borderRadius: 2 }}>
            Phòng học bị trùng lịch. Vui lòng chọn thời gian khác.
          </Alert>
        )}

        {isLoadingDropdowns && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <CircularProgress size={20} />
            <span>Đang tải dữ liệu...</span>
          </Box>
        )}
      </Stack>
    </form>
  );
}
