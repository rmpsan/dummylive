import { redirect } from "next/navigation";
import { resolveTenant } from "@/lib/config/loader";
import { getViewerSession } from "@/lib/session";
import { isServiceRoleConfigured } from "@/lib/supabase/env";
import { canalToken } from "@/lib/channel";
import { Sala } from "@/components/sala";

export default async function SalaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await resolveTenant(slug);
  if (!tenant) redirect("/");

  const sess = await getViewerSession();
  const autenticado =
    !!sess && sess.slug === slug && sess.liveId === tenant.liveId;

  // Com banco: exige sessão válida. Sem banco (dev): modo preview da UI.
  if (isServiceRoleConfigured && !autenticado) {
    redirect(`/${slug}`);
  }

  return (
    <Sala
      slug={slug}
      config={tenant.config}
      liveId={autenticado ? tenant.liveId : null}
      sessaoId={autenticado ? sess!.sessaoId : null}
      initialStatus={tenant.status}
      video={tenant.video}
      canalToken={tenant.liveId ? canalToken(tenant.liveId) : ""}
    />
  );
}
