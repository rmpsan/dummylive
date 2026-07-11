"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { getBrowserClient } from "@/lib/supabase/client";

interface CgItem {
  id: number;
  autor: string;
  texto: string;
}

const DURACAO_MS = 5000; // tempo visível de cada mensagem
const SAIDA_MS = 500; // animação de saída

/**
 * Overlay (CG) para o vMix. Recebe por Realtime as mensagens curadas pela
 * equipe e as exibe UMA a UMA (fila), cada uma por 5s, num lower-third
 * diagramado. Fundo transparente — o vMix sobrepõe na transmissão.
 *
 * A fila fica num ref e é consumida por timers (não por setState em effect),
 * o que evita renders em cascata e mantém a animação previsível.
 */
export function CgOverlay({
  canalToken,
  liveId,
  cssVars,
  marca,
}: {
  canalToken: string;
  liveId: string;
  cssVars: CSSProperties;
  marca?: string;
}) {
  const supabase = useMemo(() => getBrowserClient(), []);
  const filaRef = useRef<CgItem[]>([]);
  const rodando = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [atual, setAtual] = useState<CgItem | null>(null);
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    if (!supabase || !liveId) return;

    // Consome a fila; toda alteração de estado ocorre em callbacks de
    // timer/broadcast (nunca no corpo síncrono do effect).
    function tocar() {
      const prox = filaRef.current.shift();
      if (!prox) {
        rodando.current = false;
        setAtual(null);
        return;
      }
      rodando.current = true;
      setAtual(prox);
      setVisivel(false);
      requestAnimationFrame(() => setVisivel(true)); // dispara a entrada
      timers.current.push(
        setTimeout(() => setVisivel(false), DURACAO_MS),
        setTimeout(() => tocar(), DURACAO_MS + SAIDA_MS)
      );
    }

    const canal = supabase
      .channel(`overlay:${canalToken}`, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "cg" }, ({ payload }) => {
        const novas = (payload as { mensagens?: CgItem[] })?.mensagens;
        if (Array.isArray(novas) && novas.length) {
          filaRef.current.push(...novas.filter((m) => m && m.texto));
          if (!rodando.current) tocar();
        }
      })
      .on("broadcast", { event: "cg_clear" }, () => {
        filaRef.current = [];
        rodando.current = false;
        setAtual(null);
      })
      .subscribe();
    const snapshot = timers.current;
    return () => {
      supabase.removeChannel(canal);
      snapshot.forEach(clearTimeout);
      snapshot.length = 0;
    };
  }, [supabase, liveId, canalToken]);

  return (
    <div
      style={cssVars}
      className="pointer-events-none fixed inset-0 overflow-hidden"
    >
      {atual && (
        <div
          key={atual.id}
          className="absolute bottom-[7vh] left-[5vw] right-[5vw] flex justify-start"
          style={{
            transform: visivel ? "translateY(0)" : "translateY(28px)",
            opacity: visivel ? 1 : 0,
            transition: `transform ${SAIDA_MS}ms cubic-bezier(.22,.61,.36,1), opacity ${SAIDA_MS}ms ease`,
          }}
        >
          <div
            className="flex max-w-[70vw] items-stretch overflow-hidden rounded-[16px] shadow-[0_20px_60px_-12px_rgba(0,0,0,0.7)]"
            style={{
              background:
                "linear-gradient(135deg, color-mix(in srgb, var(--kv-superficie) 92%, black) 0%, color-mix(in srgb, var(--kv-fundo) 92%, black) 100%)",
              border: "1px solid color-mix(in srgb, var(--kv-primaria) 35%, transparent)",
              backdropFilter: "blur(6px)",
            }}
          >
            {/* Barra de destaque */}
            <div
              className="w-[8px] shrink-0"
              style={{
                background:
                  "linear-gradient(180deg, var(--kv-primaria), color-mix(in srgb, var(--kv-primaria) 55%, var(--kv-destaque)))",
              }}
            />
            <div className="flex flex-col gap-2 px-7 py-5">
              <div className="flex items-center gap-3">
                <span
                  className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[15px] font-bold"
                  style={{
                    background: "var(--kv-primaria)",
                    color: "var(--kv-sobre-primaria)",
                    fontFamily: "var(--kv-font-titulo)",
                  }}
                >
                  {(atual.autor || "").slice(0, 42)}
                </span>
                {marca && (
                  <span
                    className="text-[12px] font-semibold uppercase tracking-[0.18em]"
                    style={{ color: "color-mix(in srgb, var(--kv-texto) 55%, transparent)" }}
                  >
                    {marca}
                  </span>
                )}
              </div>
              <p
                className="max-w-[62vw] text-[26px] font-medium leading-snug"
                style={{
                  color: "var(--kv-texto)",
                  fontFamily: "var(--kv-font-corpo)",
                  textShadow: "0 2px 12px rgba(0,0,0,0.5)",
                }}
              >
                {atual.texto}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
