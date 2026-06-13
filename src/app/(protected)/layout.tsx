import type { ReactElement, ReactNode } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { requireAuth } from "@/lib/auth";

type ProtectedLayoutProps = {
  children: ReactNode;
};

export default async function ProtectedLayout({ children }: ProtectedLayoutProps): Promise<ReactElement> {
  const user = await requireAuth();

  return <AppLayout user={user}>{children}</AppLayout>;
}
