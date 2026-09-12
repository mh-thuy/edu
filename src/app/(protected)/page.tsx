import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";

export default async function HomePage(): Promise<never> {
  await requireAuth();
  redirect("/admin");
}
