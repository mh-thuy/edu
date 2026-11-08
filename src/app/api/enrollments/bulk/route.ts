import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, handleApiError } from "@/lib/api";
import { requireApiUser } from "@/lib/api-auth";
import { getAuditContext } from "@/lib/audit";
import {
  getStudentEnrollmentPreview,
  registerStudentToClasses,
} from "@/modules/class/services/bulk-enrollment.service";

const previewQuerySchema = z.object({
  studentId: z.string().uuid(),
  classIds: z.array(z.string().uuid()).min(1).max(50),
}).superRefine((data, context) => {
  if (new Set(data.classIds).size !== data.classIds.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["classIds"], message: "Không chọn lớp trùng lặp" });
  }
});

const requestSchema = z.object({
  studentId: z.string().uuid(),
  classes: z.array(z.object({
    classId: z.string().uuid(),
    classSubjectIds: z.array(z.string().uuid()).min(1),
  })).min(1).max(50),
}).superRefine((data, context) => {
  if (new Set(data.classes.map((item) => item.classId)).size !== data.classes.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["classes"], message: "Không chọn lớp trùng lặp" });
  }
  data.classes.forEach((item, index) => {
    if (new Set(item.classSubjectIds).size !== item.classSubjectIds.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["classes", index, "classSubjectIds"], message: "Không chọn môn trùng lặp" });
    }
  });
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) return user;
    const rawClassIds = request.nextUrl.searchParams.get("classIds") ?? "";
    const query = previewQuerySchema.parse({
      studentId: request.nextUrl.searchParams.get("studentId"),
      classIds: rawClassIds.split(",").filter(Boolean),
    });
    const results = await getStudentEnrollmentPreview(query.studentId, query.classIds);
    return apiSuccess({ results });
  } catch (error: unknown) {
    return handleApiError(error, "Không thể tải enrollment hiện tại");
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser();
    if (user instanceof Response) return user;
    const input = requestSchema.parse(await request.json());
    const results = await registerStudentToClasses(input, user.id, getAuditContext(request));
    return apiSuccess({ results });
  } catch (error: unknown) {
    return handleApiError(error, "Không thể đăng ký học viên vào các lớp");
  }
}
