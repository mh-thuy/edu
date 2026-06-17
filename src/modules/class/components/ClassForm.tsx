"use client";

import {
  Box,
  TextField,
  Stack,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormHelperText,
} from "@mui/material";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { classCreateSchema } from "@/modules/class/schemas/class.schema";
import type { z } from "zod";
import { useState, type ReactElement } from "react";
import { TeacherSelectDialog } from "@/components/shared/TeacherSelectDialog";
import { RoomSelectDialog } from "@/components/shared/RoomSelectDialog";
import {
  MasterSelectField,
  type MasterSelectValue,
} from "@/components/shared/MasterSelectField";
import { useDisclosure } from "@/hooks/useDisclosure";

type ClassFormData = z.infer<typeof classCreateSchema>;

type ClassFormDefaultValues = Partial<ClassFormData> & {
  teacherCode?: string;
  teacherName?: string;
  roomCode?: string;
  roomName?: string;
};

type TeacherSelectData = {
  id: string;
  code: string;
  name: string;
};

type RoomSelectData = {
  id: string;
  code: string;
  name: string;
};

export interface ClassFormProps {
  formId?: string;
  onSubmit: (data: ClassFormData) => void | Promise<void>;
  defaultValues?: ClassFormDefaultValues;
}

export function ClassForm({
  formId,
  onSubmit,
  defaultValues,
}: ClassFormProps): ReactElement {
  const teacherDialog = useDisclosure();
  const roomDialog = useDisclosure();
  const [selectedTeacher, setSelectedTeacher] = useState<MasterSelectValue | null>(
    defaultValues?.teacherId
      ? {
          id: defaultValues.teacherId,
          code: defaultValues.teacherCode ?? "",
          name: defaultValues.teacherName ?? "",
        }
      : null,
  );
  const [selectedRoom, setSelectedRoom] = useState<MasterSelectValue | null>(
    defaultValues?.roomId
      ? {
          id: defaultValues.roomId,
          code: defaultValues.roomCode ?? "",
          name: defaultValues.roomName ?? "",
        }
      : null,
  );

  const { control, handleSubmit, setValue } = useForm<ClassFormData>({
    resolver: zodResolver(classCreateSchema),
    defaultValues: {
      code: defaultValues?.code ?? "",
      name: defaultValues?.name ?? "",
      teacherId: defaultValues?.teacherId ?? null,
      roomId: defaultValues?.roomId ?? null,
      tuitionFee: defaultValues?.tuitionFee ?? 0,
      totalSessions: defaultValues?.totalSessions ?? 0,
      maxStudents: defaultValues?.maxStudents ?? 30,
      startDate: defaultValues?.startDate ?? undefined,
      endDate: defaultValues?.endDate ?? undefined,
      status: defaultValues?.status ?? "DRAFT",
    },
  });

  const handleTeacherSelect = (teacher: TeacherSelectData) => {
    setValue("teacherId", teacher.id, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setSelectedTeacher(teacher);
    teacherDialog.onClose();
  };

  const handleRoomSelect = (room: RoomSelectData) => {
    setValue("roomId", room.id, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setSelectedRoom(room);
    roomDialog.onClose();
  };

  const toInputDateValue = (value?: string) => value?.slice(0, 10) ?? "";

  const toIsoDateTime = (value: string) =>
    value ? new Date(`${value}T00:00:00.000Z`).toISOString() : undefined;

  return (
    <form id={formId} onSubmit={handleSubmit(onSubmit)}>
      <Stack spacing={2}>
        <Box>
          <MasterSelectField
            label="Giáo viên"
            value={selectedTeacher}
            onOpen={teacherDialog.onOpen}
            codeLabel="Mã giáo viên"
            nameLabel="Thông tin hiển thị"
          />
        </Box>

        <Box>
          <MasterSelectField
            label="Phòng học"
            value={selectedRoom}
            onOpen={roomDialog.onOpen}
            codeLabel="Mã phòng"
            nameLabel="Tên phòng"
          />
        </Box>

        <Controller
          name="code"
          control={control}
          render={({ field, fieldState: { error } }) => (
            <TextField
              {...field}
              label="Mã lớp"
              error={!!error}
              helperText={error?.message}
              fullWidth
              placeholder="VD: C001"
            />
          )}
        />

        <Controller
          name="name"
          control={control}
          render={({ field, fieldState: { error } }) => (
            <TextField
              {...field}
              label="Tên lớp"
              error={!!error}
              helperText={error?.message}
              fullWidth
              placeholder="VD: Toán 101"
            />
          )}
        />

        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <Controller
            name="startDate"
            control={control}
            render={({ field, fieldState: { error } }) => (
              <TextField
                label="Ngày bắt đầu"
                type="date"
                value={toInputDateValue(field.value)}
                error={!!error}
                helperText={error?.message}
                fullWidth
                InputLabelProps={{ shrink: true }}
                onChange={(event) => {
                  field.onChange(toIsoDateTime(event.target.value));
                }}
              />
            )}
          />

          <Controller
            name="endDate"
            control={control}
            render={({ field, fieldState: { error } }) => (
              <TextField
                label="Ngày kết thúc"
                type="date"
                value={toInputDateValue(field.value)}
                error={!!error}
                helperText={error?.message}
                fullWidth
                InputLabelProps={{ shrink: true }}
                onChange={(event) => {
                  field.onChange(toIsoDateTime(event.target.value));
                }}
              />
            )}
          />
        </Stack>

        <Controller
          name="tuitionFee"
          control={control}
          render={({ field, fieldState: { error } }) => (
            <TextField
              {...field}
              label="Học phí"
              type="number"
              error={!!error}
              helperText={error?.message}
              fullWidth
              onChange={(event) => {
                field.onChange(Number(event.target.value || 0));
              }}
            />
          )}
        />

        <Controller
          name="totalSessions"
          control={control}
          render={({ field, fieldState: { error } }) => (
            <TextField
              {...field}
              label="Tổng số buổi"
              type="number"
              error={!!error}
              helperText={error?.message}
              fullWidth
              onChange={(event) => {
                field.onChange(Number(event.target.value || 0));
              }}
            />
          )}
        />

        <Controller
          name="maxStudents"
          control={control}
          render={({ field, fieldState: { error } }) => (
            <TextField
              {...field}
              label="Sĩ số tối đa"
              type="number"
              error={!!error}
              helperText={error?.message}
              fullWidth
              onChange={(event) => {
                field.onChange(Number(event.target.value || 0));
              }}
            />
          )}
        />

        <Controller
          name="status"
          control={control}
          render={({ field, fieldState: { error } }) => (
            <FormControl error={!!error} fullWidth>
              <InputLabel>Trạng thái</InputLabel>
              <Select {...field} label="Trạng thái">
                <MenuItem value="DRAFT">Nháp</MenuItem>
                <MenuItem value="ACTIVE">Hoạt động</MenuItem>
                <MenuItem value="COMPLETED">Hoàn thành</MenuItem>
                <MenuItem value="CANCELLED">Đã hủy</MenuItem>
              </Select>
              <FormHelperText>{error?.message}</FormHelperText>
            </FormControl>
          )}
        />
      </Stack>

      <TeacherSelectDialog
        open={teacherDialog.open}
        onClose={teacherDialog.onClose}
        onSelect={handleTeacherSelect}
      />

      <RoomSelectDialog
        open={roomDialog.open}
        onClose={roomDialog.onClose}
        onSelect={handleRoomSelect}
      />
    </form>
  );
}
