import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { resolveTenant } from "@/lib/config/loader";
import { kvToCssVars, googleFontsUrl } from "@/lib/theme";
import { ToastProvider } from "@/components/toast";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tenant = await resolveTenant(slug);
  if (!tenant) return { title: "Live não encontrada" };
  const { config } = tenant;
  return {
    title: `${config.evento.nome} — ${config.cliente}`,
    description: config.evento.subtitulo || config.textos.boas_vindas,
    icons: config.kv.favicon ? { icon: config.kv.favicon } : undefined,
  };
}

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await resolveTenant(slug);
  if (!tenant) notFound();

  const cssVars = kvToCssVars(tenant.config);
  const fontsUrl = googleFontsUrl(tenant.config);

  return (
    <>
      {fontsUrl && (
        // font-display: swap para carga rápida em 4G (RF-79)
        <link
          rel="stylesheet"
          href={
            fontsUrl.includes("display=")
              ? fontsUrl
              : `${fontsUrl}${fontsUrl.includes("?") ? "&" : "?"}display=swap`
          }
        />
      )}
      <div
        style={cssVars}
        className="min-h-[var(--app-vh)] bg-[var(--kv-fundo)] text-[var(--kv-texto)]"
        data-tema={tenant.config.kv.layout.tema}
      >
        <ToastProvider>{children}</ToastProvider>
      </div>
    </>
  );
}
