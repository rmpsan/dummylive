"use client";

import { useEffect, useRef, useState } from "react";
import type { PlayerProps } from "./player-types";
import { PlayerShell } from "./player-shell";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytPromise: Promise<any> | null = null;
function carregarYT(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject();
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (ytPromise) return ytPromise;
  ytPromise = new Promise((resolve) => {
    const anterior = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      anterior?.();
      resolve(window.YT);
    };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(s);
  });
  return ytPromise;
}

/**
 * Player YouTube BLINDADO: `controls:0, disablekb:1, fs:0, modestbranding:1,
 * rel:0, iv_load_policy:3`, autoplay mudo. Coberto pela casca (escudo de
 * cliques) — o usuário não usa os controles nativos nem clica no "assistir no
 * YouTube". Toda operação vem dos nossos botões via IFrame API.
 */
export function YouTubePlayer(props: PlayerProps) {
  const { videoId, milestones, aoVivo = false } = props;
  const holderRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const fired = useRef<Set<number>>(new Set());
  const lastTime = useRef(0);
  const tocando = useRef(false);

  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState(false);
  const [pausado, setPausado] = useState(true);
  const [mudo, setMudo] = useState(true);
  const [tempo, setTempo] = useState(0);
  const [duracao, setDuracao] = useState(0);
  const [tentativa, setTentativa] = useState(0);

  const cb = useRef(props);
  useEffect(() => {
    cb.current = props;
  });

  useEffect(() => {
    let cancelado = false;
    let ok = false;
    let poll: ReturnType<typeof setInterval> | undefined;
    let timeout: ReturnType<typeof setTimeout>;

    (async () => {
      try {
        const YT = await carregarYT();
        if (cancelado || !holderRef.current) return;
        const el = document.createElement("div");
        holderRef.current.innerHTML = "";
        holderRef.current.appendChild(el);

        timeout = setTimeout(() => {
          if (!cancelado && !ok) setErro(true);
        }, 10000);

        const iniciarPoll = () => {
          if (poll) return;
          poll = setInterval(() => {
            const p = playerRef.current;
            if (!p?.getCurrentTime) return;
            try {
              setMudo(p.isMuted());
            } catch {}
            const cur = p.getCurrentTime();
            const dur = p.getDuration?.() || 0;
            setTempo(cur);
            if (dur) setDuracao(dur);
            if (!tocando.current) return; // não conta tempo em pausa (M1)
            if (Math.abs(cur - lastTime.current) > 2.5)
              cb.current.onSeek?.(lastTime.current, cur);
            lastTime.current = cur;
            const pct = dur > 0 ? Math.round((cur / dur) * 100) : 0;
            cb.current.onTimeUpdate?.(cur, pct);
            for (const m of milestones) {
              if (pct >= m && !fired.current.has(m)) {
                fired.current.add(m);
                cb.current.onMilestone?.(m);
              }
            }
          }, 600);
        };
        const pararPoll = () => {
          if (poll) {
            clearInterval(poll);
            poll = undefined;
          }
        };

        playerRef.current = new YT.Player(el, {
          videoId,
          playerVars: {
            playsinline: 1,
            autoplay: 1,
            mute: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            rel: 0,
            modestbranding: 1,
            iv_load_policy: 3,
          },
          events: {
            onReady: (e: any) => {
              if (cancelado) return;
              ok = true;
              clearTimeout(timeout);
              setPronto(true);
              try {
                setDuracao(e.target.getDuration() || 0);
                setMudo(e.target.isMuted());
              } catch {}
              e.target.playVideo?.();
            },
            onError: () => !cancelado && setErro(true),
            onStateChange: (e: any) => {
              const t = playerRef.current?.getCurrentTime?.() ?? 0;
              if (e.data === YT.PlayerState.PLAYING) {
                tocando.current = true;
                setPausado(false);
                cb.current.onPlay?.(t);
                iniciarPoll();
              } else if (e.data === YT.PlayerState.PAUSED) {
                tocando.current = false;
                setPausado(true);
                cb.current.onPause?.(t);
              } else if (e.data === YT.PlayerState.ENDED) {
                tocando.current = false;
                setPausado(true);
                pararPoll();
                cb.current.onEnded?.();
              }
            },
          },
        });
      } catch {
        if (!cancelado) setErro(true);
      }
    })();

    return () => {
      cancelado = true;
      clearTimeout(timeout);
      if (poll) clearInterval(poll);
      if (playerRef.current?.destroy) {
        try {
          playerRef.current.destroy();
        } catch {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, tentativa]);

  return (
    <PlayerShell
      aoVivo={aoVivo}
      pronto={pronto}
      erro={erro}
      pausado={pausado}
      mudo={mudo}
      tempo={tempo}
      duracao={duracao}
      onPlayPause={() => {
        const p = playerRef.current;
        if (!p) return;
        if (pausado) p.playVideo?.();
        else p.pauseVideo?.();
      }}
      onToggleMute={() => {
        const p = playerRef.current;
        if (!p) return;
        try {
          if (p.isMuted()) {
            p.unMute();
            setMudo(false);
          } else {
            p.mute();
            setMudo(true);
          }
        } catch {}
      }}
      onSeekBy={(d) => {
        const p = playerRef.current;
        if (!p?.getCurrentTime) return;
        p.seekTo(Math.max(0, p.getCurrentTime() + d), true);
      }}
      onSeekTo={(t) => playerRef.current?.seekTo?.(t, true)}
      onRetry={() => {
        fired.current.clear();
        setErro(false);
        setPronto(false);
        setTentativa((t) => t + 1);
      }}
    >
      <div
        ref={holderRef}
        className="pointer-events-none absolute inset-0 h-full w-full [&>iframe]:h-full [&>iframe]:w-full"
      />
    </PlayerShell>
  );
}
