import { redirect } from "next/navigation";
import { resolveTenant } from "@/lib/config/loader";
import { getStaffContext } from "@/lib/staff";
import { isServiceRoleConfigured } from "@/lib/supabase/env";
import { canalToken } from "@/lib/channel";
import { ModPanel } from "@/components/mod-panel";

export default async function ModeracaoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await resolveTenant(slug);
  if (!tenant) redirect("/");

  // Sem banco não há como autenticar staff → manda para o login.
  if (!isServiceRoleConfigured || !tenant.liveId) {
    redirect(`/${slug}/staff`);
  }

  const ctx = await getStaffContext(tenant.liveId);
  if (!ctx) redirect(`/${slug}/staff`);

  return (
    <ModPanel
      slug={slug}
      config={tenant.config}
      liveId={tenant.liveId}
      papel={ctx.papel}
      staffEmail={ctx.email}
      initialStatus={tenant.status}
      canalToken={canalToken(tenant.liveId)}
    />
  );
}
