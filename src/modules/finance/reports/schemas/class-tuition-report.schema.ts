import { z } from "zod";

export const classTuitionReportSchema = z.object({
  classId: z.string().uuid("Lớp học không hợp lệ"),
  classSubjectId: z.string().uuid("Môn học không hợp lệ"),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Kỳ báo cáo không hợp lệ"),
});

export type ClassTuitionReportInput = z.infer<
  typeof classTuitionReportSchema
>;
