import { z } from "zod";

const requiredClassScheduleSchema = z.object({
  classId: z.string().min(1, "Lớp học là bắt buộc"),
  roomId: z.string().min(1, "Phòng học là bắt buộc"),
  teacherId: z.string().min(1, "Giáo viên là bắt buộc"),
  dayOfWeek: z.number().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
});

export const classScheduleFormSchema = requiredClassScheduleSchema.extend({
  classCode: z.string().optional(),
  className: z.string().optional(),
  roomCode: z.string().optional(),
  roomName: z.string().optional(),
}).refine((data) => data.startTime < data.endTime, {
  message: "Giờ kết thúc phải sau giờ bắt đầu",
  path: ["endTime"],
});

export const classScheduleCreateSchema = requiredClassScheduleSchema.refine(
  (data) => data.startTime < data.endTime,
  {
  message: "Giờ kết thúc phải sau giờ bắt đầu",
  path: ["endTime"],
});

export const classScheduleUpdateSchema = requiredClassScheduleSchema.partial().refine(
  (data) =>
    !data.startTime || !data.endTime || data.startTime < data.endTime,
  {
    message: "Giờ kết thúc phải sau giờ bắt đầu",
    path: ["endTime"],
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
export type ClassScheduleFormData = z.infer<typeof classScheduleFormSchema>;
