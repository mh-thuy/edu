"use client";

import {
  TextField,
  Stack,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormHelperText,
  Box,
} from "@mui/material";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { roomCreateSchema } from "@/modules/room/schemas/room.schema";
import type { z } from "zod";
import type { ReactElement } from "react";

type RoomFormData = z.infer<typeof roomCreateSchema>;

export interface RoomFormProps {
  formId?: string;
  onSubmit: (data: RoomFormData) => void;
  defaultValues?: Partial<RoomFormData>;
}

export function RoomForm({
  formId,
  onSubmit,
  defaultValues,
}: RoomFormProps): ReactElement {
  const { control, handleSubmit } = useForm<RoomFormData>({
    resolver: zodResolver(roomCreateSchema),
    defaultValues: {
      code: "",
      name: "",
      capacity: 30,
      floor: "1",
      location: "",
      status: "AVAILABLE",
      note: "",
      ...defaultValues,
    },
  });

  return (
    <Box component="form" id={formId} onSubmit={handleSubmit(onSubmit)}>
      <Stack spacing={2.5}>
        {/* Hàng 1 */}
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <Controller
            name="code"
            control={control}
            render={({ field, fieldState: { error } }) => (
              <TextField
                {...field}
                label="Mã phòng"
                placeholder="Ví dụ: A101"
                error={!!error}
                helperText={error?.message}
                fullWidth
                size="small"
              />
            )}
          />

          <Controller
            name="name"
            control={control}
            render={({ field, fieldState: { error } }) => (
              <TextField
                {...field}
                label="Tên phòng"
                placeholder="Ví dụ: Phòng học 1"
                error={!!error}
                helperText={error?.message}
                fullWidth
                size="small"
              />
            )}
          />
        </Stack>

        {/* Hàng 2 */}
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <Controller
            name="capacity"
            control={control}
            render={({ field, fieldState: { error } }) => (
              <TextField
                {...field}
                label="Sức chứa"
                type="number"
                error={!!error}
                helperText={error?.message}
                fullWidth
                size="small"
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
                label="Tầng"
                error={!!error}
                helperText={error?.message}
                fullWidth
                size="small"
                onChange={(e) => field.onChange(Number(e.target.value))}
              />
            )}
          />
        </Stack>

        {/* Hàng 3 */}
        <Controller
          name="location"
          control={control}
          render={({ field, fieldState: { error } }) => (
            <TextField
              {...field}
              label="Khu vực"
              placeholder="Ví dụ: Tòa A"
              error={!!error}
              helperText={error?.message}
              fullWidth
              size="small"
            />
          )}
        />

        {/* Hàng 4 */}
        <Controller
          name="status"
          control={control}
          render={({ field, fieldState: { error } }) => (
            <FormControl fullWidth size="small" error={!!error}>
              <InputLabel>Trạng thái</InputLabel>
              <Select {...field} label="Trạng thái">
                <MenuItem value="AVAILABLE">Còn trống</MenuItem>
                <MenuItem value="OCCUPIED">Đang sử dụng</MenuItem>
                <MenuItem value="MAINTENANCE">Đang bảo trì</MenuItem>
              </Select>

              {error?.message && (
                <FormHelperText>{error.message}</FormHelperText>
              )}
            </FormControl>
          )}
        />

        {/* Hàng 5 */}
        <Controller
          name="note"
          control={control}
          render={({ field, fieldState: { error } }) => (
            <TextField
              {...field}
              label="Ghi chú"
              placeholder="Thông tin bổ sung..."
              error={!!error}
              helperText={error?.message}
              fullWidth
              multiline
              rows={3}
              size="small"
            />
          )}
        />
      </Stack>
    </Box>
  );
}
