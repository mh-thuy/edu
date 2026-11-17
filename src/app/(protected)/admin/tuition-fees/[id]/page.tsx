import { Metadata } from "next";
import { requireAuth } from "@/lib/auth";
import { resolveReturnTo } from "@/lib/return-to";
import { TuitionDetail } from "@/modules/finance/tuition/components/TuitionDetail";

export const metadata: Metadata = { title: "Chi tiết học phí" };
export default async function TuitionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  await requireAuth();
  const backHref = resolveReturnTo((await searchParams).returnTo, ["/admin/tuition-fees"], "/admin/tuition-fees");
  return <TuitionDetail id={(await params).id} backHref={backHref} />;
}
