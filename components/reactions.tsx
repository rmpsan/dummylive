"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";

const EMOJIS_PADRAO = ["❤️", "👏", "🔥", "😮", "🎉"];

interface Flutuante {
  id: number;
  emoji: string;
  left: number;
  drift: number;
}

/**
 * Barra de reações ao vivo (RF-17), posicionada ABAIXO do player. Os emojis
 * sobem numa faixa contida logo abaixo do vídeo (nunca sobre ele). A troca
 * entre espectadores usa Supabase Realtime *broadcast* (efêmero); cada reação
 * gera um evento de tracking (RF-44). Funciona também em preview (sem banco).
 */
export function Reactions({
  liveId,
  canalToken,
  emojis,
  onReact,
}: {
  liveId: string | null;
  canalToken?: string;
  emojis?: string[];
  onReact?: (tipo: string) => void;
}) {
  const lista = emojis && emojis.length > 0 ? emojis : EMOJIS_PADRAO;
  const [flutuantes, setFlutuantes] = useState<Flutuante[]>([]);
  const seq = useRef(0);
  const supabase = useMemo(() => getBrowserClient(), []);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const canalRef = useRef<any>(null);

  function spawn(emoji: string) {
    const id = ++seq.current;
    const left = 6 + Math.random() * 88; // % da largura
    const drift = Math.round((Math.random() - 0.5) * 40);
    setFlutuantes((f) => [...f, { id, emoji, left, drift }]);
    setTimeout(() => setFlutuantes((f) => f.filter((x) => x.id !== id)), 2400);
  }

  useEffect(() => {
    if (!supabase || !liveId) return;
    const canal = supabase
      .channel(canalToken ? `reactions:${canalToken}` : `reactions:${liveId}`, {
        config: { broadcast: { self: false } },
      })
      .on("broadcast", { event: "react" }, ({ payload }) => {
        if (payload?.emoji) spawn(payload.emoji);
      })
      .subscribe();
    canalRef.current = canal;
    return () => {
      supabase.removeChannel(canal);
      canalRef.current = null;
    };
  }, [supabase, liveId, canalToken]);

  function reagir(emoji: string) {
    spawn(emoji);
    onReact?.(emoji);
    canalRef.current?.send({
      type: "broadcast",
      event: "react",
      payload: { emoji },
    });
  }

  return (
    <div className="mt-3">
      {/* Faixa própria (abaixo do player) onde os emojis sobem e somem. */}
      <div className="pointer-events-none relative h-16 overflow-hidden">
        {flutuantes.map((f) => (
          <span
            key={f.id}
            className="dl-reaction"
            style={
              {
                left: `${f.left}%`,
                "--drift": `${f.drift}px`,
              } as React.CSSProperties
            }
          >
            {f.emoji}
          </span>
        ))}
      </div>

      {/* Barra de reações (logo abaixo da faixa) */}
      <div className="dl-glass flex items-center justify-between gap-3 rounded-[var(--r-md)] px-3 py-2">
        <span className="hidden text-xs font-medium text-[var(--kv-texto-secundario)] sm:inline">
          Reaja à transmissão
        </span>
        <div className="flex flex-1 justify-around gap-1 sm:flex-none sm:justify-end">
          {lista.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => reagir(e)}
              aria-label={`Reagir com ${e}`}
              className="flex h-10 w-10 items-center justify-center rounded-full text-xl transition-transform duration-150 hover:scale-125 hover:bg-[var(--kv-texto)]/5 active:scale-90"
            >
              {e}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
