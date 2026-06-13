import type { ReactElement } from "react";
import { requireAuth } from "@/lib/auth";
import { HomePageClient } from "@/modules/dashboard/components/HomePageClient";
import type { SessionUser } from "@/types/auth";

export default async function HomePage(): Promise<ReactElement> {
  const user: SessionUser = await requireAuth();

  return <HomePageClient user={user} />;
}
