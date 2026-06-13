import { redirect } from "next/navigation";
import type { ReactElement } from "react";
import { LoginPageContent } from "@/modules/auth/components/LoginPageContent";
import { getCurrentUser } from "@/lib/auth";

export default async function LoginPage(): Promise<ReactElement> {
  const user = await getCurrentUser();

  if (user) {
    redirect("/");
  }

  return <LoginPageContent />;
}
