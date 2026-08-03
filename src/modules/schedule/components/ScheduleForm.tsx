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
import { ClassSelectDialog } from "@/components/shared/dialogs/ClassSelectDialog";
import { TeacherSelectDialog } from "@/components/shared/dialogs/TeacherSelectDialog";
import {
  MasterSelectField,
  type MasterSelectValue,
} from "@/components/shared/forms/MasterSelectField";
import { useDisclosure } from "@/hooks/useDisclosure";
import { unwrapApiResponse } from "@/lib/api-client";
import { intToTime, timeToInt } from "@/utils/date";

type MasterItem = {
  id: string;
  code: string;
  name: string;
};

type ScheduleConflictItem = {
  id: string;
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
  teacher?: {
    id: string;
    code: string;
    fullName: string;
  } | null;
  class?: {
    code: string;
    name: string;
  } | null;
};

export type ConflictResult = {
  hasConflict: boolean;
  conflicts?: ScheduleConflictItem[];
};

type ScheduleSubmitData = {
  classId: string;
  teacherId: string;
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
};

export interface ScheduleFormProps {
  formId?: string;
  onSubmit: (data: ScheduleSubmitData) => void | Promise<void>;
  defaultValues?: Partial<ClassScheduleFormData> & {
    startMinute?: number;
    endMinute?: number;
  };
  onConflictCheck?: (result: ConflictResult) => void;
  scheduleId?: string;
}

const DAY_OPTIONS = [
  { value: 0, label: "Chủ nhật" },
  { value: 1, label: "Thứ 2" },
  { value: 2, label: "Thứ 3" },
  { value: 3, label: "Thứ 4" },
  { value: 4, label: "Thứ 5" },
  { value: 5, label: "Thứ 6" },
  { value: 6, label: "Thứ 7" },
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
      teacherId: defaultValues?.teacherId ?? "",
      teacherCode: defaultValues?.teacherCode ?? "",
      teacherName: defaultValues?.teacherName ?? "",
      dayOfWeek: defaultValues?.dayOfWeek ?? 1,
      startTime: intToTime(defaultValues?.startMinute ?? 480),
      endTime: intToTime(defaultValues?.endMinute ?? 540),
    },
  });

  const classDialog = useDisclosure();
  const teacherDialog = useDisclosure();
  const [conflict, setConflict] = useState<ConflictResult | null>(null);

  const classId = useWatch({ control, name: "classId" });
  const classCode = useWatch({ control, name: "classCode" });
  const className = useWatch({ control, name: "className" });
  const teacherId = useWatch({ control, name: "teacherId" });
  const teacherCode = useWatch({ control, name: "teacherCode" });
  const teacherName = useWatch({ control, name: "teacherName" });
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
  }, [classCode, classId, className]);

  const selectedTeacher = useMemo<MasterSelectValue | null>(() => {
    if (!teacherId) return null;

    return {
      id: teacherId,
      code: teacherCode ?? "",
      name: teacherName ?? "",
    };
  }, [teacherCode, teacherId, teacherName]);

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

  const handleTeacherSelect = (item: MasterItem) => {
    setValue("teacherId", item.id, {
      shouldValidate: true,
      shouldDirty: true,
    });
    setValue("teacherCode", item.code, {
      shouldValidate: true,
      shouldDirty: true,
    });
    setValue("teacherName", item.name, {
      shouldValidate: true,
      shouldDirty: true,
    });

    teacherDialog.onClose();
  };

  const handleFormSubmit = async (data: ClassScheduleFormData) => {
    await onSubmit({
      classId: data.classId,
      teacherId: data.teacherId,
      dayOfWeek: data.dayOfWeek,
      startMinute: timeToInt(data.startTime),
      endMinute: timeToInt(data.endTime),
    });
  };

  useEffect(() => {
    if (
      !teacherId ||
      dayOfWeek === undefined ||
      !startTime ||
      !endTime
    ) {
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
            classId,
            teacherId,
            dayOfWeek,
            startMinute: timeToInt(startTime),
            endMinute: timeToInt(endTime),
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
  }, [
    classId,
    dayOfWeek,
    endTime,
    onConflictCheck,
    scheduleId,
    startTime,
    teacherId,
  ]);

  const conflictMessage = useMemo(() => {
    if (!conflict?.conflicts?.length) {
      return null;
    }

    const messages: string[] = [];

    if (conflict.conflicts.some((item) => item.teacher?.id === teacherId)) {
      messages.push("Giáo viên đã có lịch trùng trong khung giờ này.");
    }

    return messages.join(" ");
  }, [conflict, teacherId]);

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
          label="Chọn giáo viên"
          value={selectedTeacher}
          onOpen={teacherDialog.onOpen}
          codeLabel="Mã giáo viên"
          nameLabel="Họ tên"
          required
          error={errors.teacherId?.message}
        />

        <Controller
          name="dayOfWeek"
          control={control}
          render={({ field, fieldState }) => (
            <FormControl error={!!fieldState.error} fullWidth>
              <InputLabel>Ngày trong tuần</InputLabel>

              <Select
                {...field}
                value={field.value ?? 1}
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
              label="Giờ kết thúc"
              type="time"
              error={!!fieldState.error}
              helperText={fieldState.error?.message}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          )}
        />

        {conflictMessage && (
          <Alert severity="warning" sx={{ borderRadius: 2 }}>
            {conflictMessage}
          </Alert>
        )}
      </Stack>

      <ClassSelectDialog
        open={classDialog.open}
        onClose={classDialog.onClose}
        onSelect={handleClassSelect}
      />

      <TeacherSelectDialog
        open={teacherDialog.open}
        onClose={teacherDialog.onClose}
        onSelect={handleTeacherSelect}
      />
    </form>
  );
}
