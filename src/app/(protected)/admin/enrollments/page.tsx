import { requireAuth } from "@/lib/auth";
import { EnrollmentRegistrationPage } from "@/modules/class/components/EnrollmentRegistrationPage";
import type { ReactElement } from "react";

export default async function EnrollmentsPage(): Promise<ReactElement> {
  await requireAuth();
  return <EnrollmentRegistrationPage />;
}
