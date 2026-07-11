import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { resolveTenant } from "@/lib/config/loader";
import { canalToken } from "@/lib/channel";
import { kvToCssVars } from "@/lib/theme";
import { CgOverlay } from "@/components/cg-overlay";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Overlay CG",
  robots: { index: false, follow: false },
};

/**
 * Página de OVERLAY (CG) para o vMix. Fundo transparente, sem cabeçalho nem
 * rodapé — só as mensagens curadas pela equipe, uma de cada vez. A equipe
 * seleciona no chat de moderação e transmite; aqui elas entram em fila.
 *
 * URL para o vMix (Web Browser input): /overlay/<slug>
 */
export default async function OverlayPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await resolveTenant(slug);
  if (!tenant?.liveId) notFound();

  const token = canalToken(tenant.liveId);
  const cssVars = kvToCssVars(tenant.config);

  return (
    <>
      {/* Fundo transparente para o vMix + esconde o rodapé global. */}
      <style>{`html,body{background:transparent !important;}
        .dummy-footer{display:none !important;}`}</style>
      <CgOverlay
        canalToken={token}
        liveId={tenant.liveId}
        cssVars={cssVars}
        marca={tenant.config.evento.nome}
        logo={tenant.config.kv.logo ?? ""}
      />
    </>
  );
}
