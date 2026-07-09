import { redirect } from "next/navigation";
import { resolveTenant } from "@/lib/config/loader";
import { getStaffContext, temPapel } from "@/lib/staff";
import { isServiceRoleConfigured } from "@/lib/supabase/env";
import { ConfigEditor } from "@/components/config-editor";

export default async function AdminPage({
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
  // Configuração da live é exclusiva de admin (RF-68).
  if (!temPapel(ctx, "admin")) redirect(`/${slug}/moderacao`);

  return <ConfigEditor slug={slug} config={tenant.config} owner={tenant.owner} />;
}
