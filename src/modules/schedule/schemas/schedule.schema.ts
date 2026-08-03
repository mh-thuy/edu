import { z } from "zod";

const minuteSchema = z.number().int().min(0).max(1439);

const requiredClassScheduleSchema = z.object({
  classId: z.string().min(1, "Lớp học là bắt buộc"),
  teacherId: z.string().min(1, "Giáo viên là bắt buộc"),
  dayOfWeek: z.number().int().min(0).max(6),
  startMinute: minuteSchema,
  endMinute: minuteSchema,
});

export const classScheduleCreateSchema = requiredClassScheduleSchema.refine(
  (data) => data.startMinute < data.endMinute,
  {
    message: "Giờ kết thúc phải sau giờ bắt đầu",
    path: ["endMinute"],
  },
);

export const classScheduleUpdateSchema = requiredClassScheduleSchema
  .partial()
  .refine(
    (data) =>
      data.startMinute === undefined ||
      data.endMinute === undefined ||
      data.startMinute < data.endMinute,
    {
      message: "Giờ kết thúc phải sau giờ bắt đầu",
      path: ["endMinute"],
    },
  );

export const scheduleFilterSchema = z.object({
  classId: z.string().optional(),
  dayOfWeek: z.number().optional(),
  page: z.number().min(1).default(1),
  pageSize: z.number().min(1).max(100).default(20),
});

export type ClassScheduleCreate = z.infer<typeof classScheduleCreateSchema>;
export type ClassScheduleUpdate = z.infer<typeof classScheduleUpdateSchema>;
export type ScheduleFilter = z.infer<typeof scheduleFilterSchema>;
