/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */

export interface CrudResponse {
  id: string;
  [key: string]: any;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface ScheduleWithRelations {
  id: string;
  classId: string;
  roomId?: string;
  teacherId?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  createdAt: Date;
  updatedAt: Date;
  class?: any;
  room?: any;
  teacher?: any;
}

export interface ClassWithRelations {
  id: string;
  code: string;
  name: string;
  teacherId?: string;
  roomId?: string;
  tuitionFee: number;
  totalSessions: number;
  maxStudents: number;
  startDate?: Date;
  endDate?: Date;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  teacher?: any;
  room?: any;
  classStudents?: any[];
  classSchedules?: any[];
}

export interface TeacherWithUser {
  id: string;
  userId: string;
  code: string;
  phone?: string;
  email?: string;
  bankAccount?: string;
  specialty?: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  user?: any;
}

export interface StudentWithClasses {
  id: string;
  code: string;
  fullName: string;
  email?: string;
  phone?: string;
  birthday?: Date;
  parentName?: string;
  address?: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  classStudents?: any[];
}
