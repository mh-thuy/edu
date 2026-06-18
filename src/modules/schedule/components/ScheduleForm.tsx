"use client";

import {
  Alert,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
} from "@mui/material";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useEffect, useMemo, useState, type ReactElement } from "react";

import {
  classScheduleFormSchema,
  type ClassScheduleFormData,
} from "@/modules/schedule/schemas/schedule.schema";
import { ClassSelectDialog } from "@/components/shared/ClassSelectDialog";
import { RoomSelectDialog } from "@/components/shared/RoomSelectDialog";
import {
  MasterSelectField,
  type MasterSelectValue,
} from "@/components/shared/MasterSelectField";
import { useDisclosure } from "@/hooks/useDisclosure";
import { unwrapApiResponse } from "@/lib/api-client";

type MasterItem = {
  id: string;
  code: string;
  name: string;
};

type ConflictResult = {
  hasConflict: boolean;
  conflicts?: unknown[];
};

type ScheduleSubmitData = {
  classId: string;
  roomId?: string | null;
  teacherId?: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

export interface ScheduleFormProps {
  formId?: string;
  onSubmit: (data: ScheduleSubmitData) => void | Promise<void>;
  defaultValues?: Partial<ClassScheduleFormData>;
  onConflictCheck?: (result: ConflictResult) => void;
  scheduleId?: string;
}

const DAY_OPTIONS = [
  { value: 0, label: "Thứ 2" },
  { value: 1, label: "Thứ 3" },
  { value: 2, label: "Thứ 4" },
  { value: 3, label: "Thứ 5" },
  { value: 4, label: "Thứ 6" },
  { value: 5, label: "Thứ 7" },
  { value: 6, label: "Chủ nhật" },
];

export function ScheduleForm({
  formId,
  onSubmit,
  defaultValues,
  onConflictCheck,
  scheduleId,
}: ScheduleFormProps): ReactElement {
  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ClassScheduleFormData>({
    resolver: zodResolver(classScheduleFormSchema),
    defaultValues: {
      classId: defaultValues?.classId ?? "",
      classCode: defaultValues?.classCode ?? "",
      className: defaultValues?.className ?? "",
      roomId: defaultValues?.roomId ?? "",
      roomCode: defaultValues?.roomCode ?? "",
      roomName: defaultValues?.roomName ?? "",
      teacherId: defaultValues?.teacherId ?? undefined,
      dayOfWeek: defaultValues?.dayOfWeek ?? 0,
      startTime: defaultValues?.startTime ?? "08:00",
      endTime: defaultValues?.endTime ?? "10:00",
    },
  });

  const classDialog = useDisclosure();
  const roomDialog = useDisclosure();

  const [conflict, setConflict] = useState<ConflictResult | null>(null);

  const classId = useWatch({ control, name: "classId" });
  const classCode = useWatch({ control, name: "classCode" });
  const className = useWatch({ control, name: "className" });
  const roomId = useWatch({ control, name: "roomId" });
  const roomCode = useWatch({ control, name: "roomCode" });
  const roomName = useWatch({ control, name: "roomName" });
  const dayOfWeek = useWatch({ control, name: "dayOfWeek" });
  const startTime = useWatch({ control, name: "startTime" });
  const endTime = useWatch({ control, name: "endTime" });

  const selectedClass = useMemo<MasterSelectValue | null>(() => {
    if (!classId) return null;

    return {
      id: classId,
      code: classCode ?? "",
      name: className ?? "",
    };
  }, [classId, classCode, className]);

  const selectedRoom = useMemo<MasterSelectValue | null>(() => {
    if (!roomId) return null;

    return {
      id: roomId,
      code: roomCode ?? "",
      name: roomName ?? "",
    };
  }, [roomId, roomCode, roomName]);

  const handleClassSelect = (item: MasterItem) => {
    setValue("classId", item.id, {
      shouldValidate: true,
      shouldDirty: true,
    });
    setValue("classCode", item.code, {
      shouldValidate: true,
      shouldDirty: true,
    });
    setValue("className", item.name, {
      shouldValidate: true,
      shouldDirty: true,
    });

    classDialog.onClose();
  };

  const handleRoomSelect = (item: MasterItem) => {
    setValue("roomId", item.id, {
      shouldValidate: true,
      shouldDirty: true,
    });
    setValue("roomCode", item.code, {
      shouldValidate: true,
      shouldDirty: true,
    });
    setValue("roomName", item.name, {
      shouldValidate: true,
      shouldDirty: true,
    });

    roomDialog.onClose();
  };

  const handleFormSubmit = async (data: ClassScheduleFormData) => {
    await onSubmit({
      classId: data.classId,
      roomId: data.roomId,
      teacherId: data.teacherId || undefined,
      dayOfWeek: data.dayOfWeek,
      startTime: data.startTime,
      endTime: data.endTime,
    });
  };

  useEffect(() => {
    if (!roomId || dayOfWeek === undefined || !startTime || !endTime) {
      setConflict(null);
      onConflictCheck?.({ hasConflict: false });
      return;
    }

    const controller = new AbortController();

    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/schedules/check-conflict", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomId,
            dayOfWeek,
            startTime,
            endTime,
            excludeScheduleId: scheduleId,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          setConflict(null);
          return;
        }

        const result = await unwrapApiResponse<ConflictResult>(response);

        setConflict(result.hasConflict ? result : null);
        onConflictCheck?.(result);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        console.error("Conflict check failed:", error);
        setConflict(null);
      }
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [roomId, dayOfWeek, startTime, endTime, onConflictCheck, scheduleId]);

  return (
    <form id={formId} onSubmit={handleSubmit(handleFormSubmit)}>
      <Stack spacing={2}>
        <MasterSelectField
          label="Chọn lớp học"
          value={selectedClass}
          onOpen={classDialog.onOpen}
          codeLabel="Mã lớp"
          nameLabel="Tên lớp"
          required
          error={errors.classId?.message}
        />

        <MasterSelectField
          label="Chọn phòng học"
          value={selectedRoom}
          onOpen={roomDialog.onOpen}
          codeLabel="Mã phòng"
          nameLabel="Tên phòng"
          required
          error={errors.roomId?.message}
        />

        <Controller
          name="dayOfWeek"
          control={control}
          render={({ field, fieldState }) => (
            <FormControl error={!!fieldState.error} fullWidth>
              <InputLabel>Ngày trong tuần</InputLabel>

              <Select
                {...field}
                value={field.value ?? 0}
                label="Ngày trong tuần"
                onChange={(event) => field.onChange(Number(event.target.value))}
              >
                {DAY_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>

              <FormHelperText>{fieldState.error?.message}</FormHelperText>
            </FormControl>
          )}
        />

        <Controller
          name="startTime"
          control={control}
          render={({ field, fieldState }) => (
            <TextField
              {...field}
              value={field.value ?? ""}
              label="Giờ bắt đầu"
              type="time"
              error={!!fieldState.error}
              helperText={fieldState.error?.message}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          )}
        />

        <Controller
          name="endTime"
          control={control}
          render={({ field, fieldState }) => (
            <TextField
              {...field}
              value={field.value ?? ""}
              label="Giờ kết thúc"
              type="time"
              error={!!fieldState.error}
              helperText={fieldState.error?.message}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          )}
        />

        {conflict && (
          <Alert severity="warning" sx={{ borderRadius: 2 }}>
            Phòng học bị trùng lịch. Vui lòng chọn thời gian khác.
          </Alert>
        )}
      </Stack>

      <ClassSelectDialog
        open={classDialog.open}
        onClose={classDialog.onClose}
        onSelect={handleClassSelect}
      />

      <RoomSelectDialog
        open={roomDialog.open}
        onClose={roomDialog.onClose}
        onSelect={handleRoomSelect}
      />
    </form>
  );
}
