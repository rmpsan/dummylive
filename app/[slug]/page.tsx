import { redirect } from "next/navigation";
import Link from "next/link";
import { resolveTenant } from "@/lib/config/loader";
import { getViewerSession } from "@/lib/session";
import { GateForm } from "./gate-form";
import { LiveLogo } from "@/components/live-logo";

function Diamante({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <span className="h-px w-12 bg-gradient-to-r from-transparent to-[var(--kv-primaria)]" />
      <span className="h-2.5 w-2.5 rotate-45 bg-[var(--kv-primaria)] shadow-[0_0_12px_var(--kv-primaria)]" />
      <span className="h-px w-12 bg-gradient-to-l from-transparent to-[var(--kv-primaria)]" />
    </span>
  );
}

export default async function GatePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await resolveTenant(slug);
  if (!tenant) redirect("/");

  const { config, status } = tenant;
  const sess = await getViewerSession();
  if (sess && sess.slug === slug) redirect(`/${slug}/sala`);

  const bg = config.kv.imagem_fundo_entrada;
  const ticket = config.kv.destaque_imagem;
  const palestrantes = config.kv.imagem_showcase;

  return (
    <main
      className={`relative flex min-h-[var(--app-vh)] flex-col overflow-hidden ${
        bg ? "" : "dl-ambient"
      }`}
      style={
        bg
          ? {
              backgroundImage: `url(${bg})`,
              backgroundSize: "cover",
              backgroundPosition: "center top",
            }
          : undefined
      }
    >
      {bg && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(130% 80% at 50% 0%, transparent 35%, color-mix(in srgb, var(--kv-secundaria) 78%, transparent) 100%), linear-gradient(to bottom, transparent 60%, color-mix(in srgb, var(--kv-fundo) 94%, transparent))",
          }}
        />
      )}

      <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col items-center gap-9 px-5 py-10 text-center safe-top safe-bottom">
        {status === "encerrada" ? (
          <div className="dl-anim-up mt-6 flex w-full max-w-lg flex-col items-center gap-7 text-center">
            <LiveLogo config={config} className="dl-logo-glow max-h-28 w-auto sm:max-h-36" />
            {ticket && (
              <div className="dl-halo">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ticket} alt="" className="dl-float w-[min(64%,300px)] select-none" />
              </div>
            )}
            <Diamante />
            <p className="dl-shine max-w-md font-[family-name:var(--kv-font-titulo)] text-2xl font-bold leading-snug sm:text-3xl">
              {config.textos.encerrada}
            </p>
          </div>
        ) : (
          <>
            {/* 1 — LOGO GRANDE */}
            <LiveLogo
              config={config}
              className="dl-logo-glow dl-anim-up mt-2 max-h-28 w-auto sm:max-h-36"
            />

            {/* Badges + título */}
            <div className="dl-anim-up flex flex-col items-center gap-4">
              <div className="flex flex-wrap items-center justify-center gap-2">
                {status === "ao_vivo" && (
                  <span className="dl-pill dl-badge-live">
                    <span className="dl-live-dot" /> {config.textos.ao_vivo_label}
                  </span>
                )}
                {status === "aguardando" && <span className="dl-pill">● Em breve</span>}
                {config.evento.subtitulo && (
                  <span className="dl-pill">{config.evento.subtitulo}</span>
                )}
              </div>
              <h1 className="dl-shine font-[family-name:var(--kv-font-titulo)] text-4xl font-bold leading-[1.05] sm:text-5xl">
                {config.textos.titulo_entrada}
              </h1>
              <p className="max-w-xl text-[var(--kv-texto-secundario)] sm:text-lg">
                {config.textos.boas_vindas}
              </p>
            </div>

            {/* 2 — IMAGEM DOS PALESTRANTES (inteira, sem cortar) */}
            {palestrantes && (
              <div className="dl-anim-in w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={palestrantes}
                  alt="Palestrantes do evento"
                  className="mx-auto w-full max-w-2xl select-none [mask-image:radial-gradient(120%_115%_at_50%_45%,#000_78%,transparent_100%)]"
                />
              </div>
            )}

            {/* 3 — LOGIN */}
            <div className="dl-anim-up w-full max-w-md text-left">
              <GateForm slug={slug} config={config} compacto />
            </div>

            {/* 4 — INGRESSO (elemento de fecho) */}
            {ticket && (
              <div className="dl-anim-up flex flex-col items-center gap-3">
                <Diamante />
                <div className="dl-halo">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={ticket}
                    alt=""
                    className="dl-float w-[min(72%,360px)] select-none"
                  />
                </div>
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--kv-texto-secundario)]">
                  Seu acesso exclusivo
                </p>
              </div>
            )}
          </>
        )}

        {/* Rodapé */}
        <div className="mt-auto flex flex-col items-center gap-2 pt-4">
          {config.textos.rodape && (
            <p className="text-center text-xs text-[var(--kv-texto-secundario)]">
              {config.textos.rodape}
            </p>
          )}
          <div className="flex items-center gap-4">
            <Link
              href={`/${slug}/ajuda`}
              className="text-xs text-[var(--kv-texto-secundario)] underline-offset-4 transition-colors hover:text-[var(--kv-texto)] hover:underline"
            >
              Ajuda / Dúvidas
            </Link>
            <span className="h-3 w-px bg-[var(--borda-forte)]" />
            <Link
              href={`/${slug}/staff`}
              className="text-xs text-[var(--kv-texto-secundario)] underline-offset-4 transition-colors hover:text-[var(--kv-texto)] hover:underline"
            >
              Sou da equipe
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
