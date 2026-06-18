import type { Class, ClassStudent, PrismaClient, Student } from "@prisma/client";
import { pick, takeRandom } from "../helpers/random";

export interface EnrollmentWithRefs {
  enrollment: ClassStudent;
  student: Student;
  class: Class;
}

export async function seedEnrollments(
  prisma: PrismaClient,
  input: {
    classes: Class[];
    students: Student[];
    userId: string;
  },
): Promise<EnrollmentWithRefs[]> {
  const result: EnrollmentWithRefs[] = [];

  for (const cls of input.classes) {
    const enrollCount = Math.min(cls.maxStudents, pick([8, 10, 12, 15]));
    const selectedStudents = takeRandom(input.students, enrollCount);

    for (const student of selectedStudents) {
      const enrollment = await prisma.classStudent.create({
        data: {
          classId: cls.id,
          studentId: student.id,
          createdBy: input.userId,
          updatedBy: input.userId,
        },
      });

      result.push({ enrollment, student, class: cls });
    }
  }

  return result;
}
