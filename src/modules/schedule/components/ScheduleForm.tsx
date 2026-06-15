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
  Box,
  Button,
} from "@mui/material";
import InputAdornment from "@mui/material/InputAdornment";
import SearchIcon from "@mui/icons-material/Search";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { classScheduleCreateSchema } from "@/modules/schedule/schemas/schedule.schema";
import type { z } from "zod";
import { useState, useEffect, type ReactElement } from "react";
import { ClassSelectDialog } from "@/components/shared/ClassSelectDialog";
import { RoomSelectDialog } from "@/components/shared/RoomSelectDialog";

type ScheduleFormData = z.infer<typeof classScheduleCreateSchema>;

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
  const { control, handleSubmit, watch, setValue } = useForm<ScheduleFormData>({
    resolver: zodResolver(classScheduleCreateSchema),
    defaultValues: {
      classId: defaultValues?.classId ?? "",
      classCode: defaultValues?.classCode ?? "",
      className: defaultValues?.className ?? "",
      roomId: defaultValues?.roomId ?? "",
      roomCode: defaultValues?.roomCode ?? "",
      roomName: defaultValues?.roomName ?? "",
      dayOfWeek: defaultValues?.dayOfWeek ?? 0,
      startTime: defaultValues?.startTime ?? "08:00",
      endTime: defaultValues?.endTime ?? "10:00",
    },
  });

  const [conflicts, setConflicts] = useState<any>(null);
  const [openClassDialog, setOpenClassDialog] = useState(false);
  const [openRoomDialog, setOpenRoomDialog] = useState(false);

  const roomId = watch("roomId");
  const dayOfWeek = watch("dayOfWeek");
  const startTime = watch("startTime");
  const endTime = watch("endTime");

  // Handle class selection from dialog
  const handleClassSelect = (classItem: any) => {
    setValue("classId", classItem.id);
    setValue("classCode", classItem.code);
    setValue("className", classItem.name);
  };

  // Handle room selection from dialog
  const handleRoomSelect = (roomItem: any) => {
    setValue("roomId", roomItem.id);
    setValue("roomCode", roomItem.code);
    setValue("roomName", roomItem.name);
  };

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
        {/* Class Selection Section */}
        <Box
          sx={{
            border: "1px solid",
            borderColor: "divider",
            p: 2,
            borderRadius: 2,
            bgcolor: "background.paper",
          }}
        >
          <Controller
            name="classId"
            control={control}
            render={({ fieldState: { error } }) => (
              <FormControl fullWidth error={!!error}>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1.5}
                  alignItems="flex-start"
                >
                  <Controller
                    name="classCode"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Mã lớp"
                        value={field.value ?? ""}
                        fullWidth
                        size="small"
                        slotProps={{
                          input: {
                            readOnly: true,
                            endAdornment: (
                              <InputAdornment position="end">
                                <Button
                                  size="small"
                                  variant="contained"
                                  startIcon={<SearchIcon />}
                                  onClick={() => setOpenClassDialog(true)}
                                  sx={{
                                    height: 30,
                                    whiteSpace: "nowrap",
                                    mr: -0.5,
                                  }}
                                >
                                  Chọn
                                </Button>
                              </InputAdornment>
                            ),
                          },
                        }}
                      />
                    )}
                  />

                  <Controller
                    name="className"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Tên lớp"
                        value={field.value ?? ""}
                        fullWidth
                        size="small"
                        error={!!error}
                        slotProps={{
                          input: {
                            readOnly: true,
                          },
                        }}
                      />
                    )}
                  />
                </Stack>

                {error && <FormHelperText>{error.message}</FormHelperText>}
              </FormControl>
            )}
          />
        </Box>

        {/* Room Selection Section */}
        <Box
          sx={{
            border: "1px solid",
            borderColor: "divider",
            p: 2,
            borderRadius: 2,
            bgcolor: "background.paper",
          }}
        >
          <Controller
            name="roomId"
            control={control}
            render={({ fieldState: { error } }) => (
              <FormControl fullWidth error={!!error}>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1.5}
                  alignItems="flex-start"
                >
                  <Controller
                    name="roomCode"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Mã phòng"
                        value={field.value ?? ""}
                        fullWidth
                        size="small"
                        error={!!error}
                        slotProps={{
                          input: {
                            readOnly: true,
                            endAdornment: (
                              <InputAdornment position="end">
                                <Button
                                  size="small"
                                  variant="contained"
                                  startIcon={<SearchIcon />}
                                  onClick={() => setOpenRoomDialog(true)}
                                  sx={{
                                    height: 30,
                                    whiteSpace: "nowrap",
                                    mr: -0.5,
                                  }}
                                >
                                  Chọn
                                </Button>
                              </InputAdornment>
                            ),
                          },
                        }}
                      />
                    )}
                  />

                  <Controller
                    name="roomName"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Tên phòng"
                        value={field.value ?? ""}
                        fullWidth
                        size="small"
                        error={!!error}
                        slotProps={{
                          input: {
                            readOnly: true,
                          },
                        }}
                      />
                    )}
                  />
                </Stack>

                {error && <FormHelperText>{error.message}</FormHelperText>}
              </FormControl>
            )}
          />
        </Box>

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
      </Stack>

      {/* Class Select Dialog */}
      <ClassSelectDialog
        open={openClassDialog}
        onClose={() => setOpenClassDialog(false)}
        onSelect={handleClassSelect}
      />

      {/* Room Select Dialog */}
      <RoomSelectDialog
        open={openRoomDialog}
        onClose={() => setOpenRoomDialog(false)}
        onSelect={handleRoomSelect}
      />
    </form>
  );
}
