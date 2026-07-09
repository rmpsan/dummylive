import { redirect } from "next/navigation";
import { resolveTenant } from "@/lib/config/loader";
import { getStaffContext, temPapel } from "@/lib/staff";
import { isServiceRoleConfigured } from "@/lib/supabase/env";
import { Dashboard } from "@/components/dashboard";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await resolveTenant(slug);
  if (!tenant) redirect("/");

  if (!isServiceRoleConfigured || !tenant.liveId) {
    redirect(`/${slug}/staff`);
  }
  const ctx = await getStaffContext(tenant.liveId);
  if (!ctx) redirect(`/${slug}/staff`);
  if (!temPapel(ctx, "admin")) redirect(`/${slug}/moderacao`);

  return <Dashboard slug={slug} config={tenant.config} owner={tenant.owner} />;
}
