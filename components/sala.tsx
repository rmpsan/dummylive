"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ClienteConfig } from "@/lib/config/schema";
import type { LiveStatus } from "@/lib/config/loader";
import type { VideoResolvido } from "@/lib/video";
import { Player } from "./player";
import { Chat } from "./chat";
import { Reactions } from "./reactions";
import { LiveLogo } from "./live-logo";
import { useTracking } from "@/lib/tracking/use-tracking";
import { coletarDeviceInfo } from "@/lib/device";
import { getBrowserClient } from "@/lib/supabase/client";

export function Sala({
  slug,
  config,
  liveId,
  sessaoId,
  initialStatus,
  video,
  canalToken,
}: {
  slug: string;
  config: ClienteConfig;
  liveId: string | null;
  sessaoId: string | null;
  initialStatus: LiveStatus;
  video: VideoResolvido;
  canalToken: string;
}) {
  const trackingAtivo = Boolean(sessaoId && liveId);
  const tracker = useTracking({
    sessaoId,
    liveId,
    heartbeatSeg: config.tracking.heartbeat_seg,
    enabled: trackingAtivo,
  });

  const router = useRouter();
  const [status, setStatus] = useState<LiveStatus>(initialStatus);
  const maxPercent = useRef(0);
  const supabase = useMemo(() => getBrowserClient(), []);

  async function sairEspectador() {
    try {
      await fetch("/api/logout", { method: "POST" });
    } catch {
      /* ignora */
    }
    router.push(`/${slug}`);
    router.refresh();
  }

  useEffect(() => {
    if (!trackingAtivo) return;
    tracker.track("session_start", { payload: { ...coletarDeviceInfo() } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackingAtivo]);

  useEffect(() => {
    if (!supabase || !liveId) return;
    const canal = supabase
      .channel(`estado:${liveId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "live_estado",
          filter: `live_id=eq.${liveId}`,
        },
        (payload) => {
          const s = (payload.new as { status?: LiveStatus })?.status;
          if (s) setStatus(s);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [supabase, liveId]);

  const mostrarChat = config.features.chat;
  const chatDireita = config.kv.layout.posicao_chat !== "esquerda";
  const cta = config.features.cta;
  const conteudo = config.conteudo;

  function onCtaClick() {
    if (trackingAtivo)
      tracker.track("cta_click", {
        payload: { cta_url: cta.url, texto: cta.texto },
      });
  }

  const ctaBloco =
    cta.ativo && cta.url ? (
      <a
        href={cta.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onCtaClick}
        className="dl-btn dl-btn-primary w-full"
      >
        {cta.texto || "Saiba mais"}
        <span aria-hidden>→</span>
      </a>
    ) : null;

  return (
    <div className="dl-ambient flex min-h-[var(--app-vh)] flex-col">
      {/* Header */}
      <header className="dl-glass sticky top-0 z-30 flex items-center justify-between gap-3 border-b px-4 py-2.5 safe-top">
        <div className="flex min-w-0 items-center gap-3">
          <LiveLogo config={config} className="max-h-8 w-auto shrink-0" />
          <span className="hidden h-6 w-px bg-[var(--borda-forte)] sm:block" />
          <span className="hidden truncate text-sm font-medium text-[var(--kv-texto-secundario)] sm:block">
            {config.evento.nome}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {status === "ao_vivo" && (
            <span className="dl-pill dl-badge-live">
              <span className="dl-live-dot" /> {config.textos.ao_vivo_label}
            </span>
          )}
          <a
            href={`/${slug}/ajuda`}
            target="_blank"
            rel="noopener noreferrer"
            className="dl-btn dl-btn-ghost px-3 py-1.5 text-xs"
            aria-label="Ajuda e dúvidas"
          >
            <span aria-hidden>?</span>
            <span className="hidden sm:inline">Ajuda</span>
          </a>
          {trackingAtivo && (
            <button
              onClick={sairEspectador}
              className="dl-btn dl-btn-ghost px-3 py-1.5 text-xs"
            >
              Sair
            </button>
          )}
        </div>
      </header>

      {/* Hero editorial (acima do player) */}
      {conteudo.hero_titulo && (
        <section className="dl-anim-up mx-auto w-full max-w-[1400px] px-4 pt-6 text-center lg:px-5">
          <h2 className="font-[family-name:var(--kv-font-titulo)] text-2xl font-bold sm:text-3xl">
            {conteudo.hero_titulo}
          </h2>
          {conteudo.hero_texto && (
            <p className="mx-auto mt-2 max-w-2xl whitespace-pre-line text-sm text-[var(--kv-texto-secundario)] sm:text-base">
              {conteudo.hero_texto}
            </p>
          )}
        </section>
      )}

      {/* Corpo */}
      <div
        className={`mx-auto flex w-full flex-1 flex-col lg:gap-5 lg:p-5 ${
          mostrarChat
            ? `max-w-[1400px] lg:grid ${
                chatDireita
                  ? "lg:grid-cols-[1fr_380px]"
                  : "lg:grid-cols-[380px_1fr]"
              }`
            : "max-w-5xl"
        }`}
      >
        {/* Coluna do vídeo */}
        <section
          className={`${
            chatDireita ? "lg:order-1" : "lg:order-2"
          } sticky top-[57px] z-20 bg-[var(--kv-fundo)]/80 p-3 backdrop-blur lg:static lg:z-auto lg:bg-transparent lg:p-0 lg:backdrop-blur-none`}
        >
          <div className="dl-anim-in relative overflow-hidden rounded-[var(--r-lg)] shadow-[0_24px_70px_-20px_rgba(0,0,0,0.75)] ring-1 ring-[var(--kv-primaria-40)]">
            {status === "encerrada" ? (
              <Aviso emoji="🎬" texto={config.textos.encerrada} />
            ) : status === "aguardando" ? (
              <Aguardando config={config} />
            ) : (
              <Player
                fonte={video.fonte}
                videoId={video.id}
                aoVivo={video.aoVivo}
                milestones={config.tracking.milestones_percentuais}
                onPlay={(t) =>
                  trackingAtivo && tracker.track("video_play", { videoTime: t })
                }
                onPause={(t) => {
                  tracker.setVideoState({ playing: false });
                  if (trackingAtivo)
                    tracker.track("video_pause", { videoTime: t });
                }}
                onSeek={(from, to) => {
                  if (trackingAtivo)
                    tracker.track("video_seek", {
                      payload: { de: from, para: to },
                      videoTime: to,
                    });
                }}
                onTimeUpdate={(sec, pct) => {
                  if (pct > maxPercent.current) maxPercent.current = pct;
                  tracker.setVideoState({
                    time: sec,
                    playing: true,
                    maxPercent: maxPercent.current,
                  });
                }}
                onMilestone={(pct) => {
                  if (trackingAtivo)
                    tracker.track("video_milestone", {
                      payload: { percentual: pct, max_percent: pct },
                    });
                }}
                onEnded={() => tracker.setVideoState({ playing: false })}
              />
            )}
          </div>

          {/* Reações ao vivo — barra ABAIXO do player (RF-17). */}
          {status === "ao_vivo" && config.features.reacoes && (
            <Reactions
              liveId={liveId}
              canalToken={canalToken}
              emojis={config.features.emojis}
              onReact={(tipo) =>
                trackingAtivo && tracker.track("reaction", { payload: { tipo } })
              }
            />
          )}

          {ctaBloco && cta.posicao === "abaixo_do_video" && (
            <div className="mt-3 hidden lg:block">{ctaBloco}</div>
          )}
          {/* Sem chat: CTA também aparece no mobile aqui. */}
          {ctaBloco && !mostrarChat && (
            <div className="mt-3 lg:hidden">{ctaBloco}</div>
          )}
        </section>

        {/* Coluna do chat (só se habilitado) */}
        {mostrarChat && (
          <aside
            className={`${
              chatDireita ? "lg:order-2" : "lg:order-1"
            } flex min-h-0 flex-1 flex-col gap-3 p-3 lg:p-0`}
          >
            {ctaBloco && <div className="lg:hidden">{ctaBloco}</div>}
            <div className="h-[62vh] min-h-[340px] lg:h-[calc(var(--app-vh)-2.5rem-40px)]">
              <Chat
                slug={slug}
                liveId={liveId}
                config={config}
                canalToken={canalToken}
                podeEnviar={trackingAtivo && status !== "encerrada"}
                onMessageSent={(len) =>
                  trackingAtivo &&
                  tracker.track("chat_message", {
                    payload: { tamanho_texto: len },
                  })
                }
              />
            </div>
          </aside>
        )}
      </div>

      {/* Blocos editoriais (retenção) abaixo do player/chat */}
      {conteudo.blocos.length > 0 && (
        <section className="mx-auto grid w-full max-w-[1400px] gap-4 px-4 py-6 sm:grid-cols-2 lg:px-5">
          {conteudo.blocos.map((b, i) => (
            <div key={i} className="dl-card p-5">
              {b.titulo && (
                <h3 className="mb-2 font-[family-name:var(--kv-font-titulo)] text-lg font-semibold text-[var(--kv-primaria)]">
                  {b.titulo}
                </h3>
              )}
              <div className="whitespace-pre-line text-sm leading-relaxed text-[var(--kv-texto-secundario)]">
                {b.corpo}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Vitrine (galeria de imagens — ex.: artesanato) */}
      {conteudo.galeria.filter((g) => g.imagem).length > 0 && (
        <section className="mx-auto w-full max-w-[1400px] px-4 py-8 lg:px-5">
          {conteudo.galeria_titulo && (
            <div className="mb-6 flex flex-col items-center gap-3 text-center">
              <span className="inline-flex items-center gap-3">
                <span className="h-px w-10 bg-gradient-to-r from-transparent to-[var(--kv-primaria)]" />
                <span className="h-2 w-2 rotate-45 bg-[var(--kv-primaria)]" />
                <span className="h-px w-10 bg-gradient-to-l from-transparent to-[var(--kv-primaria)]" />
              </span>
              <h2 className="font-[family-name:var(--kv-font-titulo)] text-2xl font-bold sm:text-3xl">
                {conteudo.galeria_titulo}
              </h2>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5">
            {conteudo.galeria
              .filter((g) => g.imagem)
              .map((g, i) => (
                <figure
                  key={i}
                  className="dl-card flex flex-col items-center gap-3 p-5"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={g.imagem}
                    alt={g.legenda || ""}
                    className="dl-float h-36 w-auto object-contain sm:h-44"
                    style={{ animationDelay: `${(i % 3) * 0.5}s` }}
                  />
                  {g.legenda && (
                    <figcaption className="text-center text-sm text-[var(--kv-texto-secundario)]">
                      {g.legenda}
                    </figcaption>
                  )}
                </figure>
              ))}
          </div>
        </section>
      )}

      {config.textos.rodape && (
        <footer className="px-4 py-3 text-center text-xs text-[var(--kv-texto-secundario)] safe-bottom">
          {config.textos.rodape}
        </footer>
      )}
    </div>
  );
}

function Aviso({ emoji, texto }: { emoji: string; texto: string }) {
  return (
    <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 bg-[var(--sup-1)] p-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--kv-texto)]/5 text-3xl">
        {emoji}
      </div>
      <p className="max-w-sm text-lg">{texto}</p>
    </div>
  );
}

function Aguardando({ config }: { config: ClienteConfig }) {
  const [restante, setRestante] = useState<string | null>(null);

  useEffect(() => {
    const alvo = config.evento.data_inicio
      ? new Date(config.evento.data_inicio).getTime()
      : null;
    if (!alvo) return;
    const tick = () => {
      const diff = alvo - Date.now();
      if (diff <= 0) return setRestante(null);
      const h = Math.floor(diff / 3.6e6);
      const m = Math.floor((diff % 3.6e6) / 6e4);
      const s = Math.floor((diff % 6e4) / 1000);
      setRestante(
        `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(
          s
        ).padStart(2, "0")}`
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [config.evento.data_inicio]);

  const thumb = config.kv.imagem_aguardando;

  // Com thumb: imagem preenche a área do player (16:9), com a contagem/aviso
  // sobrepostos no rodapé.
  if (thumb) {
    return (
      <div className="relative aspect-video w-full overflow-hidden bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumb}
          alt={config.evento.nome}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 p-4 text-center sm:p-6">
          <span className="dl-pill">● Aguardando</span>
          <p className="max-w-md text-sm font-medium text-white sm:text-base">
            {config.textos.aguardando}
          </p>
          {restante && (
            <div className="font-[family-name:var(--kv-font-mono)] text-3xl font-bold tabular-nums text-[var(--kv-primaria)] sm:text-4xl">
              {restante}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="dl-ambient flex aspect-video w-full flex-col items-center justify-center gap-4 p-6 text-center">
      <span className="dl-pill">● Aguardando</span>
      <p className="max-w-sm text-lg font-medium">{config.textos.aguardando}</p>
      {restante && (
        <div className="flex items-center gap-2 font-[family-name:var(--kv-font-mono)] text-4xl font-bold tabular-nums text-[var(--kv-primaria)] sm:text-5xl">
          {restante}
        </div>
      )}
    </div>
  );
}

