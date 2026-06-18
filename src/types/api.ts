export interface CrudResponse {
  id: string;
  [key: string]: unknown;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
}

export type {
  ClassWithRelations,
  ScheduleWithRelations,
  StudentWithClasses,
  TeacherWithUser,
} from "@/types/prisma";
