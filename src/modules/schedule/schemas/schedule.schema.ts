import { z } from "zod";

export const classScheduleFormSchema = z.object({
  classId: z.string().min(1, "Lớp học là bắt buộc"),
  classCode: z.string().optional(),
  className: z.string().optional(),

  roomId: z.string().optional(),
  roomCode: z.string().optional(),
  roomName: z.string().optional(),

  teacherId: z.string().optional(),

  dayOfWeek: z.number().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
});

export const classScheduleCreateSchema = z.object({
  classId: z.string().min(1, "Lớp học là bắt buộc"),
  roomId: z.string().optional(),
  teacherId: z.string().optional(),
  dayOfWeek: z.number().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
});

export const classScheduleUpdateSchema = classScheduleCreateSchema.partial();

export const scheduleFilterSchema = z.object({
  classId: z.string().optional(),
  dayOfWeek: z.number().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
});

export type ClassScheduleCreate = z.infer<typeof classScheduleCreateSchema>;
export type ClassScheduleUpdate = z.infer<typeof classScheduleUpdateSchema>;
export type ScheduleFilter = z.infer<typeof scheduleFilterSchema>;
