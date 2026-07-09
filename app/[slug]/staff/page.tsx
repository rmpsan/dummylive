import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveTenant } from "@/lib/config/loader";
import { getStaffContext } from "@/lib/staff";
import { isServiceRoleConfigured } from "@/lib/supabase/env";
import { LiveLogo } from "@/components/live-logo";
import { StaffLoginForm } from "./staff-login-form";

export default async function StaffPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await resolveTenant(slug);
  if (!tenant) redirect("/");

  // Já logado como staff desta live → vai para a moderação.
  if (tenant.liveId) {
    const ctx = await getStaffContext(tenant.liveId);
    if (ctx) redirect(`/${slug}/moderacao`);
  }

  return (
    <main className="dl-ambient flex min-h-[var(--app-vh)] flex-col items-center justify-center px-6">
      <div className="dl-anim-up flex w-full max-w-md flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <LiveLogo config={tenant.config} className="max-h-12 w-auto" />
          <span className="dl-pill dl-badge-staff">Equipe</span>
          <h1 className="text-xl font-semibold">Área da equipe</h1>
          <p className="text-sm text-[var(--kv-texto-secundario)]">
            Login individual de moderadores e administradores.
          </p>
        </div>

        {isServiceRoleConfigured ? (
          <StaffLoginForm slug={slug} />
        ) : (
          <p className="dl-card p-6 text-center text-sm text-[var(--kv-texto-secundario)]">
            Login de staff indisponível: banco de dados não configurado (dev).
          </p>
        )}

        <Link
          href={`/${slug}`}
          className="text-xs text-[var(--kv-texto-secundario)] underline-offset-2 hover:underline"
        >
          ← Voltar à entrada
        </Link>
      </div>
    </main>
  );
}
