"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Casca de player blindado: NÓS controlamos; o player nativo (Vimeo/YouTube)
 * fica coberto por um "escudo de cliques" transparente que captura toda
 * interação — o usuário nunca clica no player original, no menu de contexto,
 * nem em links "assistir na origem". Toda a operação vai pelos nossos botões.
 *
 * - Ao vivo: mutar/desmutar + tela cheia.
 * - Playback (VOD): play/pause, −10s/+10s, seek, mutar, tela cheia.
 * - Tela cheia é do NOSSO container (o escudo e os controles seguem por cima).
 * - Autoplay mudo: overlay "Ativar som" enquanto estiver mudo.
 */
export interface ShellProps {
  aoVivo: boolean;
  pronto: boolean;
  erro: boolean;
  pausado: boolean;
  mudo: boolean;
  tempo: number;
  duracao: number;
  onPlayPause: () => void;
  onToggleMute: () => void;
  onSeekBy: (delta: number) => void;
  onSeekTo: (t: number) => void;
  onRetry: () => void;
  children: ReactNode;
}

function fmt(s: number) {
  s = Math.max(0, Math.floor(s || 0));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

export function PlayerShell(p: ShellProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [fs, setFs] = useState(false);

  useEffect(() => {
    const h = () => setFs(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", h);
    return () => document.removeEventListener("fullscreenchange", h);
  }, []);

  async function toggleFs() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (wrapRef.current) await wrapRef.current.requestFullscreen();
    } catch {
      /* ignora */
    }
  }

  const btn =
    "flex h-9 w-9 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/15";

  return (
    <div
      ref={wrapRef}
      onContextMenu={(e) => e.preventDefault()}
      className="relative aspect-video w-full select-none overflow-hidden bg-black"
    >
      {p.children}

      {/* ESCUDO: cobre o player nativo, captura todos os cliques/menu. */}
      <div
        className="absolute inset-0 z-10"
        onContextMenu={(e) => e.preventDefault()}
        aria-hidden
      />

      {/* Loading */}
      {!p.pronto && !p.erro && (
        <div className="dl-skeleton absolute inset-0 z-30 flex items-center justify-center text-sm text-white/60">
          Carregando…
        </div>
      )}

      {/* Erro / fallback */}
      {p.erro && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-[var(--sup-1)] px-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--kv-erro)]/15 text-2xl">
            📡
          </div>
          <p className="text-sm text-[var(--kv-texto-secundario)]">
            Não foi possível carregar o vídeo. Verifique sua conexão.
          </p>
          <button type="button" onClick={p.onRetry} className="dl-btn dl-btn-ghost text-sm">
            Tentar novamente
          </button>
        </div>
      )}

      {/* Ativar som (autoplay começa mudo) */}
      {p.pronto && !p.erro && p.mudo && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <button
            type="button"
            onClick={p.onToggleMute}
            className="pointer-events-auto flex items-center gap-2 rounded-full bg-[var(--kv-primaria)] px-5 py-3 text-sm font-semibold text-[var(--kv-sobre-primaria)] shadow-[var(--glow)]"
          >
            <SomOff /> Ativar som
          </button>
        </div>
      )}

      {/* Barra de controles NOSSA */}
      {p.pronto && !p.erro && (
        <div className="absolute inset-x-0 bottom-0 z-20 flex items-center gap-2 bg-gradient-to-t from-black/75 via-black/30 to-transparent px-3 pb-2 pt-8 text-white">
          {p.aoVivo ? (
            <span className="dl-pill dl-badge-live">
              <span className="dl-live-dot" /> AO VIVO
            </span>
          ) : (
            <>
              <button type="button" onClick={p.onPlayPause} className={btn} aria-label={p.pausado ? "Reproduzir" : "Pausar"}>
                {p.pausado ? <Play /> : <Pause />}
              </button>
              <button type="button" onClick={() => p.onSeekBy(-10)} className={btn} aria-label="Voltar 10s">
                <Rewind />
              </button>
              <button type="button" onClick={() => p.onSeekBy(10)} className={btn} aria-label="Avançar 10s">
                <Forward />
              </button>
              <input
                type="range"
                min={0}
                max={Math.max(1, p.duracao)}
                value={Math.min(p.tempo, p.duracao || 0)}
                onChange={(e) => p.onSeekTo(Number(e.target.value))}
                className="mx-1 h-1 flex-1 cursor-pointer accent-[var(--kv-primaria)]"
                aria-label="Progresso"
              />
              <span className="hidden shrink-0 text-xs tabular-nums text-white/80 sm:block">
                {fmt(p.tempo)} / {fmt(p.duracao)}
              </span>
            </>
          )}

          <div className="ml-auto flex items-center gap-1">
            <button type="button" onClick={p.onToggleMute} className={btn} aria-label={p.mudo ? "Ativar som" : "Silenciar"}>
              {p.mudo ? <SomOff /> : <SomOn />}
            </button>
            <button type="button" onClick={toggleFs} className={btn} aria-label="Tela cheia">
              {fs ? <FsExit /> : <FsEnter />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ícones */
const ic = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "currentColor" } as const;
const Play = () => (<svg {...ic}><path d="M8 5v14l11-7z" /></svg>);
const Pause = () => (<svg {...ic}><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>);
const Rewind = () => (<svg {...ic}><path d="M11 18V6l-8.5 6 8.5 6zM11.5 12l8.5 6V6l-8.5 6z" /></svg>);
const Forward = () => (<svg {...ic}><path d="M13 6v12l8.5-6L13 6zM4 6v12l8.5-6L4 6z" /></svg>);
const SomOn = () => (<svg {...ic}><path d="M3 10v4h4l5 5V5L7 10H3zm13.5 2a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z" /></svg>);
const SomOff = () => (<svg {...ic}><path d="M3 10v4h4l5 5V5L7 10H3zm13 2 3 3 1.4-1.4L17.4 12l3-3L19 7.6l-3 3-3-3L11.6 9l3 3-3 3L13 16.4l3-3z" /></svg>);
const FsEnter = () => (<svg {...ic}><path d="M4 4h6v2H6v4H4V4zm10 0h6v6h-2V6h-4V4zM4 14h2v4h4v2H4v-6zm14 0h2v6h-6v-2h4v-4z" /></svg>);
const FsExit = () => (<svg {...ic}><path d="M8 4h2v6H4V8h4V4zm6 0h2v4h4v2h-6V4zM4 14h6v6H8v-4H4v-2zm10 0h6v2h-4v4h-2v-6z" /></svg>);
