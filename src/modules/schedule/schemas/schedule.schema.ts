import { timeToInt } from "@/utils/date";
import { z } from "zod";

const minuteSchema = z.number().int().min(0).max(1439);

const timeStringSchema = z
  .string()
  .min(1, "Vui lòng chọn giờ")
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Giờ không hợp lệ");

const requiredClassScheduleSchema = z.object({
  classId: z.string().min(1, "Lớp học là bắt buộc"),
  roomId: z.string().min(1, "Phòng học là bắt buộc"),
  teacherId: z.string().min(1, "Giáo viên là bắt buộc"),
  dayOfWeek: z.number().int().min(0).max(6),
  startMinute: minuteSchema,
  endMinute: minuteSchema,
});

export const classScheduleFormSchema = z
  .object({
    classId: z.string().min(1, "Lớp học là bắt buộc"),
    classCode: z.string().optional(),
    className: z.string().optional(),
    roomId: z.string().min(1, "Phòng học là bắt buộc"),
    roomCode: z.string().optional(),
    roomName: z.string().optional(),
    teacherId: z.string().min(1, "Giáo viên là bắt buộc"),
    teacherCode: z.string().optional(),
    teacherName: z.string().optional(),
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: timeStringSchema.describe("Giờ bắt đầu"),
    endTime: timeStringSchema.describe("Giờ kết thúc"),
  })
  .refine((data) => timeToInt(data.startTime) < timeToInt(data.endTime), {
    message: "Giờ kết thúc phải sau giờ bắt đầu",
    path: ["endTime"],
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
export type ClassScheduleFormData = z.infer<typeof classScheduleFormSchema>;
