"use client";

import { useEffect, useRef, useState } from "react";
import type { PlayerProps } from "./player-types";
import { PlayerShell } from "./player-shell";

/**
 * Player Vimeo BLINDADO: controles nativos desligados (`controls:false`),
 * autoplay mudo, título/logo/menu escondidos. Toda a operação é feita pela
 * nossa casca (PlayerShell) via SDK — o usuário não acessa o player original.
 * Nota: `controls:false` só é 100% respeitado em contas Vimeo Pro+; o escudo
 * da casca bloqueia a interação nativa de qualquer forma.
 */
export function VimeoPlayer(props: PlayerProps) {
  const { videoId, milestones, aoVivo = false } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null);
  const fired = useRef<Set<number>>(new Set());
  const lastTime = useRef(0);

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
    let pronto = false;
    let timeout: ReturnType<typeof setTimeout>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let player: any;

    (async () => {
      try {
        const { default: Player } = await import("@vimeo/player");
        if (cancelado || !containerRef.current) return;
        containerRef.current.innerHTML = "";
        player = new Player(containerRef.current, {
          id: Number(videoId),
          responsive: true,
          controls: false,
          autoplay: true,
          muted: true,
          playsinline: true,
          keyboard: false,
          title: false,
          byline: false,
          portrait: false,
          dnt: true,
        });
        playerRef.current = player;

        timeout = setTimeout(() => {
          if (!cancelado && !pronto) setErro(true);
        }, 9000);

        player
          .ready()
          .then(async () => {
            if (cancelado) return;
            pronto = true;
            clearTimeout(timeout);
            setPronto(true);
            try {
              setDuracao(await player.getDuration());
            } catch {}
            player.play().catch(() => {});
          })
          .catch(() => !cancelado && setErro(true));

        player.on("error", () => !cancelado && setErro(true));
        player.on("play", async () => {
          setPausado(false);
          const t = await player.getCurrentTime().catch(() => 0);
          cb.current.onPlay?.(t);
        });
        player.on("pause", async () => {
          setPausado(true);
          const t = await player.getCurrentTime().catch(() => 0);
          cb.current.onPause?.(t);
        });
        player.on("volumechange", async () => {
          try {
            setMudo(await player.getMuted());
          } catch {}
        });
        player.on("seeked", (d: { seconds: number }) =>
          cb.current.onSeek?.(lastTime.current, d.seconds)
        );
        player.on("timeupdate", (d: { seconds: number; percent: number; duration: number }) => {
          lastTime.current = d.seconds;
          setTempo(d.seconds);
          if (d.duration) setDuracao(d.duration);
          const pct = Math.round(d.percent * 100);
          cb.current.onTimeUpdate?.(d.seconds, pct);
          for (const m of milestones) {
            if (pct >= m && !fired.current.has(m)) {
              fired.current.add(m);
              cb.current.onMilestone?.(m);
            }
          }
        });
        player.on("ended", () => cb.current.onEnded?.());
      } catch {
        if (!cancelado) setErro(true);
      }
    })();

    return () => {
      cancelado = true;
      clearTimeout(timeout);
      if (player?.destroy) player.destroy().catch(() => {});
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
        if (pausado) p.play().catch(() => {});
        else p.pause().catch(() => {});
      }}
      onToggleMute={() => playerRef.current?.setMuted(!mudo).catch?.(() => {})}
      onSeekBy={(d) =>
        playerRef.current
          ?.getCurrentTime()
          .then((t: number) => playerRef.current.setCurrentTime(Math.max(0, t + d)))
          .catch(() => {})
      }
      onSeekTo={(t) => playerRef.current?.setCurrentTime(t).catch?.(() => {})}
      onRetry={() => {
        fired.current.clear();
        setErro(false);
        setPronto(false);
        setTentativa((t) => t + 1);
      }}
    >
      <div ref={containerRef} className="absolute inset-0 h-full w-full" />
    </PlayerShell>
  );
}
