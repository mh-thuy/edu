import type { PaymentAccount, PrismaClient } from "@prisma/client";
import { createStudentFeeFlow, type StudentFeeFlow } from "../helpers/create-student-fee-flow";
import type { EnrollmentWithRefs } from "./08-enrollments.seed";

export async function seedStudentFees(
  prisma: PrismaClient,
  input: {
    enrollments: EnrollmentWithRefs[];
    paymentAccount: PaymentAccount;
    userId: string;
  },
): Promise<StudentFeeFlow[]> {
  const flows: StudentFeeFlow[] = [];

  for (const item of input.enrollments) {
    flows.push(
      await createStudentFeeFlow(prisma, {
        student: item.student,
        class: item.class,
        paymentAccount: input.paymentAccount,
        userId: input.userId,
      }),
    );
  }

  return flows;
}
