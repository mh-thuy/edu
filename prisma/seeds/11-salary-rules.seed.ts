import type { Class, PrismaClient } from "@prisma/client";

export async function seedSalaryRules(
  prisma: PrismaClient,
  input: {
    classes: Class[];
    userId: string;
  },
): Promise<void> {
  for (const cls of input.classes) {
    await prisma.classSalaryRule.create({
      data: {
        classId: cls.id,
        teacherSharePercentage: 12,
      },
    });
  }
}
