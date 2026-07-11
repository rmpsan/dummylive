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
  logo,
}: {
  canalToken: string;
  liveId: string;
  cssVars: CSSProperties;
  marca?: string;
  logo?: string;
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
      className="pointer-events-none fixed inset-0 flex items-center justify-center overflow-hidden"
    >
      {atual && (
        <div
          key={atual.id}
          className="flex w-[82vw] max-w-[1600px] flex-col"
          style={{
            transform: visivel ? "translateY(0)" : "translateY(36px)",
            opacity: visivel ? 1 : 0,
            transition: `transform ${SAIDA_MS}ms cubic-bezier(.22,.61,.36,1), opacity ${SAIDA_MS}ms ease`,
          }}
        >
          {/* Cartão grande, centralizado, CANTOS RETOS (crop no vMix). */}
          <div
            className="flex flex-col gap-8 px-[5vw] py-[5vh]"
            style={{
              background:
                "linear-gradient(135deg, color-mix(in srgb, var(--kv-superficie) 94%, black) 0%, color-mix(in srgb, var(--kv-fundo) 94%, black) 100%)",
              borderLeft: "14px solid var(--kv-primaria)",
              boxShadow: "0 30px 90px -20px rgba(0,0,0,0.8)",
            }}
          >
            {/* Cabeçalho: logo do cliente + marca */}
            <div className="flex items-center gap-6">
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logo}
                  alt={marca || ""}
                  className="h-[9vh] max-h-[110px] w-auto object-contain"
                />
              ) : (
                marca && (
                  <span
                    className="text-[2.4vh] font-semibold uppercase tracking-[0.22em]"
                    style={{ color: "color-mix(in srgb, var(--kv-texto) 60%, transparent)" }}
                  >
                    {marca}
                  </span>
                )
              )}
            </div>

            {/* Autor + mensagem */}
            <div className="flex flex-col gap-5">
              <span
                className="self-start px-6 py-2.5 text-[2.6vh] font-bold"
                style={{
                  background: "var(--kv-primaria)",
                  color: "var(--kv-sobre-primaria)",
                  fontFamily: "var(--kv-font-titulo)",
                }}
              >
                {(atual.autor || "").slice(0, 48)}
              </span>
              <p
                className="text-[5.4vh] font-semibold leading-[1.12]"
                style={{
                  color: "var(--kv-texto)",
                  fontFamily: "var(--kv-font-corpo)",
                  textShadow: "0 3px 18px rgba(0,0,0,0.55)",
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
