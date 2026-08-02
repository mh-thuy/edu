import type { Prisma } from "@prisma/client";

export type ScheduleWithRelations = Prisma.ClassScheduleGetPayload<{
  include: {
    class: true;
    teacher: true;
  };
}>;

export type ClassWithRelations = Prisma.ClassGetPayload<{
  include: {
    teacher: {
      include: {
        user: true;
      };
    };
    students: {
      include: {
        student: true;
      };
    };
    schedules: true;
  };
}>;

export type ClassListItem = Prisma.ClassGetPayload<{
  include: {
    teacher: {
      include: {
        user: true;
      };
    };
  };
}>;

export type TeacherWithUser = Prisma.TeacherGetPayload<{
  include: {
    user: true;
  };
}>;

export type StudentWithClasses = Prisma.StudentGetPayload<{
  include: {
    enrollments: {
      include: {
        class: true;
      };
    };
  };
}>;

export type ClassStudentWithRelations = Prisma.ClassStudentGetPayload<{
  include: {
    student: true;
    class: true;
  };
}>;

export type ClassStudentWithStudent = Prisma.ClassStudentGetPayload<{
  include: {
    student: true;
  };
}>;
