"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { getBrowserClient } from "@/lib/supabase/client";
import { useToast } from "./toast";
import type { ClienteConfig } from "@/lib/config/schema";

interface Mensagem {
  id: number;
  participante_id: string | null;
  autor_nome: string | null;
  texto: string;
  is_staff: boolean;
  fixada?: boolean;
  apagada?: boolean;
  created_at: string;
}

export function Chat({
  slug,
  liveId,
  config,
  podeEnviar,
  canalToken,
  staffMode = false,
  onMessageSent,
}: {
  slug: string;
  liveId: string | null;
  config: ClienteConfig;
  podeEnviar: boolean;
  canalToken?: string;
  staffMode?: boolean;
  onMessageSent?: (tamanhoTexto: number) => void;
}) {
  const toast = useToast();
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [conexao, setConexao] = useState<"conectando" | "ok" | "caiu">(() =>
    liveId && getBrowserClient() ? "conectando" : "caiu"
  );
  const [novasMsgs, setNovasMsgs] = useState(false);
  // Curadoria (staffMode): mensagens selecionadas para transmitir no overlay.
  const [sel, setSel] = useState<Set<number>>(() => new Set());

  const listaRef = useRef<HTMLDivElement>(null);
  const grudadoNoFim = useRef(true);
  const supabase = useMemo(() => getBrowserClient(), []);
  const limite = config.features.limite_caracteres_msg;

  const scrollParaFim = useCallback((suave = true) => {
    const el = listaRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: suave ? "smooth" : "auto" });
    setNovasMsgs(false);
  }, []);

  function onScroll() {
    const el = listaRef.current;
    if (!el) return;
    const perto = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    grudadoNoFim.current = perto;
    if (perto) setNovasMsgs(false);
  }

  const upsertMsg = useCallback(
    (m: Mensagem) => {
      setMensagens((prev) => {
        if (m.apagada && !staffMode) return prev.filter((x) => x.id !== m.id);
        if (prev.some((x) => x.id === m.id))
          return prev.map((x) => (x.id === m.id ? m : x));
        return [...prev, m].sort(
          (a, b) => +new Date(a.created_at) - +new Date(b.created_at)
        );
      });
      if (!m.apagada && !grudadoNoFim.current) setNovasMsgs(true);
    },
    [staffMode]
  );

  // Eventos de moderação (broadcast) — refletem ao vivo para todos (A1).
  const handleMod = useCallback(
    (p: { tipo?: string; id?: number; fixar?: boolean }) => {
      if (!p?.id) return;
      if (p.tipo === "apagar") {
        setMensagens((prev) =>
          staffMode
            ? prev.map((m) => (m.id === p.id ? { ...m, apagada: true } : m))
            : prev.filter((m) => m.id !== p.id)
        );
      } else if (p.tipo === "fixar") {
        setMensagens((prev) =>
          prev.map((m) => (m.id === p.id ? { ...m, fixada: !!p.fixar } : m))
        );
      }
    },
    [staffMode]
  );

  useEffect(() => {
    if (!liveId) return;
    let ativo = true;

    // Histórico via servidor (escopado por live + auth) — não lê a tabela
    // pelo anon (A2). Novas mensagens/moderação chegam por broadcast.
    (async () => {
      try {
        const res = await fetch(`/api/chat?slug=${encodeURIComponent(slug)}`);
        if (ativo && res.ok) {
          const d = await res.json();
          setMensagens((d.mensagens ?? []) as Mensagem[]);
        }
      } catch {
        /* degrada: fica sem histórico, mas recebe novas por broadcast */
      }
    })();

    if (!supabase) {
      return () => {
        ativo = false;
      };
    }

    const canal = supabase
      .channel(canalToken ? `chat:${canalToken}` : `chat:${liveId}`)
      .on("broadcast", { event: "msg" }, ({ payload }) => {
        const m = (payload as { mensagem?: Mensagem })?.mensagem;
        if (m) upsertMsg(m);
      })
      .on("broadcast", { event: "mod" }, ({ payload }) =>
        handleMod(payload as { tipo?: string; id?: number; fixar?: boolean })
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setConexao("ok");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT")
          setConexao("caiu");
      });

    const onVisible = () => {
      if (!document.hidden) supabase.realtime.connect();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      ativo = false;
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(canal);
    };
  }, [supabase, liveId, slug, canalToken, upsertMsg, handleMod]);

  useEffect(() => {
    if (grudadoNoFim.current && listaRef.current)
      listaRef.current.scrollTop = listaRef.current.scrollHeight;
  }, [mensagens]);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const t = texto.trim();
    if (!t || enviando) return;
    setEnviando(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: t }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const m: Record<string, string> = {
          rate_limit: `Aguarde ${config.features.rate_limit_segundos}s entre mensagens.`,
          silenciado: "Você está silenciado nesta transmissão.",
          banido: "Seu acesso foi bloqueado.",
          palavra_proibida: "Sua mensagem contém termos não permitidos.",
          supabase_ausente: "Chat indisponível (banco não configurado).",
        };
        toast.show(m[data?.erro] ?? "Não foi possível enviar.", "erro");
        return;
      }
      if (data?.mensagem) upsertMsg(data.mensagem as Mensagem);
      onMessageSent?.(t.length);
      setTexto("");
      grudadoNoFim.current = true;
      setTimeout(() => scrollParaFim(true), 0);
    } catch {
      toast.show("Falha de conexão.", "erro");
    } finally {
      setEnviando(false);
    }
  }

  async function moderar(acao: string, extra: Record<string, unknown>) {
    try {
      const res = await fetch("/api/mod", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, acao, ...extra }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.show(`Ação falhou: ${d?.erro ?? res.status}`, "erro");
      }
    } catch {
      toast.show("Falha de conexão.", "erro");
    }
  }

  const toggleSel = useCallback((id: number) => {
    setSel((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);

  async function transmitirCg() {
    const ids = [...sel];
    if (!ids.length) return;
    try {
      const res = await fetch("/api/mod", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, acao: "transmitir_cg", mensagemIds: ids }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.show(`▶ ${d.total ?? ids.length} enviada(s) ao overlay (5s cada).`, "sucesso");
        setSel(new Set());
      } else toast.show(`Falha: ${d?.erro ?? res.status}`, "erro");
    } catch {
      toast.show("Falha de conexão.", "erro");
    }
  }

  const fixadas = mensagens.filter((m) => m.fixada && !m.apagada);

  return (
    <div className="dl-card flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--borda)] px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <ChatIcon />
          {staffMode ? "Chat — moderação" : "Chat ao vivo"}
        </span>
        <span
          className={`flex items-center gap-1.5 text-xs ${
            conexao === "ok"
              ? "text-[var(--kv-sucesso)]"
              : conexao === "caiu"
                ? "text-[var(--kv-erro)]"
                : "text-[var(--kv-texto-secundario)]"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              conexao === "ok"
                ? "bg-[var(--kv-sucesso)]"
                : conexao === "caiu"
                  ? "bg-[var(--kv-erro)]"
                  : "bg-[var(--kv-texto-secundario)]"
            }`}
          />
          {conexao === "ok" ? "conectado" : conexao === "caiu" ? "reconectando" : "conectando"}
        </span>
      </div>

      {fixadas.length > 0 && (
        <div className="border-b border-[var(--kv-primaria-24)] bg-[var(--kv-primaria-08)] px-4 py-2.5">
          {fixadas.map((m) => (
            <div key={`fix-${m.id}`} className="flex items-start gap-2 text-sm">
              <span className="mt-0.5 text-xs">📌</span>
              <div className="min-w-0 flex-1">
                <span className="mr-1.5 font-semibold text-[var(--kv-primaria)]">
                  {m.autor_nome}
                </span>
                <span className="text-[var(--kv-texto)]">{m.texto}</span>
              </div>
              {staffMode && (
                <button
                  type="button"
                  onClick={() => moderar("fixar_msg", { mensagemId: m.id, fixar: false })}
                  className="shrink-0 text-xs text-[var(--kv-texto-secundario)] hover:underline"
                >
                  desafixar
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div
        ref={listaRef}
        onScroll={onScroll}
        role="log"
        aria-live="polite"
        aria-label="Mensagens do chat"
        className="dl-fade-top relative flex-1 space-y-0.5 overflow-y-auto px-2 py-3"
      >
        {mensagens.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            <ChatIcon large />
            <p className="text-sm text-[var(--kv-texto-secundario)]">
              Seja o primeiro a comentar.
            </p>
          </div>
        )}
        {mensagens.map((m) => (
          <Mensagem
            key={m.id}
            m={m}
            staffMode={staffMode}
            onModerar={moderar}
            selecionada={sel.has(m.id)}
            onToggleSel={() => toggleSel(m.id)}
          />
        ))}
      </div>

      {novasMsgs && (
        <button
          type="button"
          onClick={() => scrollParaFim(true)}
          className="dl-anim-in mx-auto -mt-10 mb-1.5 flex items-center gap-1 rounded-full bg-[var(--kv-primaria)] px-3 py-1.5 text-xs font-semibold text-[var(--kv-sobre-primaria)] shadow-[var(--sombra-md)]"
        >
          ↓ novas mensagens
        </button>
      )}

      {/* Curadoria: barra de transmissão para o overlay (vMix) */}
      {staffMode && sel.size > 0 && (
        <div className="flex items-center justify-between gap-2 border-t border-[var(--kv-primaria-24)] bg-[var(--kv-primaria-08)] p-2.5">
          <span className="text-xs text-[var(--kv-texto-secundario)]">
            {sel.size} selecionada(s) para o overlay
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSel(new Set())}
              className="dl-btn dl-btn-ghost px-3 py-1.5 text-xs"
            >
              limpar
            </button>
            <button
              type="button"
              onClick={transmitirCg}
              className="dl-btn dl-btn-primary px-3 py-1.5 text-xs"
            >
              ▶ Transmitir ({sel.size})
            </button>
          </div>
        </div>
      )}

      {!staffMode &&
        (podeEnviar ? (
          <form onSubmit={enviar} className="border-t border-[var(--borda)] p-2.5 safe-bottom">
            <div className="flex items-end gap-2">
              <div className="flex flex-1 items-end rounded-[var(--r-lg)] border border-[var(--borda)] bg-[color-mix(in_srgb,var(--kv-fundo)_55%,var(--sup-2))] px-3 transition-colors focus-within:border-[var(--kv-primaria)] focus-within:shadow-[0_0_0_3px_var(--kv-primaria-24)]">
                <textarea
                  value={texto}
                  onChange={(e) => setTexto(e.target.value.slice(0, limite))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      enviar(e);
                    }
                  }}
                  rows={1}
                  placeholder="Escreva uma mensagem…"
                  className="max-h-24 min-h-[44px] flex-1 resize-none border-0 bg-transparent py-3 text-sm outline-none placeholder:text-[var(--kv-texto-secundario)]"
                />
                <span className="pb-3 pl-1 text-[10px] tabular-nums text-[var(--kv-texto-secundario)]">
                  {texto.length}/{limite}
                </span>
              </div>
              <button
                type="submit"
                disabled={enviando || !texto.trim()}
                className="dl-btn dl-btn-primary h-11 w-11 shrink-0 rounded-full p-0"
                aria-label="Enviar mensagem"
              >
                <SendIcon />
              </button>
            </div>
          </form>
        ) : (
          <div className="border-t border-[var(--borda)] p-3.5 text-center text-xs text-[var(--kv-texto-secundario)] safe-bottom">
            {config.features.chat
              ? "Entre na transmissão para participar do chat."
              : "Chat desativado para esta transmissão."}
          </div>
        ))}
    </div>
  );
}

function Mensagem({
  m,
  staffMode,
  onModerar,
  selecionada = false,
  onToggleSel,
}: {
  m: Mensagem;
  staffMode: boolean;
  onModerar: (acao: string, extra: Record<string, unknown>) => void;
  selecionada?: boolean;
  onToggleSel?: () => void;
}) {
  const nome = m.autor_nome || "Participante";
  const curavel = staffMode && !m.apagada && !m.is_staff;
  return (
    <div
      className={`dl-msg-in group flex gap-2.5 rounded-[var(--r-sm)] px-2 py-1.5 transition-colors hover:bg-[var(--kv-texto)]/[0.03] ${
        m.is_staff ? "bg-[var(--kv-destaque)]/[0.06]" : ""
      } ${m.apagada ? "opacity-45" : ""} ${
        selecionada ? "bg-[var(--kv-primaria-08)] ring-1 ring-[var(--kv-primaria)]" : ""
      }`}
    >
      <Avatar nome={nome} staff={m.is_staff} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={`truncate text-sm font-semibold ${m.is_staff ? "text-[var(--kv-destaque)]" : ""}`}>
            {nome}
          </span>
          {m.is_staff && <span className="dl-pill dl-badge-staff">Staff</span>}
          <span className="ml-auto shrink-0 text-[10px] text-[var(--kv-texto-secundario)]">
            {formatHora(m.created_at)}
          </span>
        </div>
        {/* Texto puro (anti-XSS, RF-29). */}
        <div className={`break-words text-sm leading-snug ${m.apagada ? "line-through" : ""}`}>
          {m.apagada ? "mensagem removida" : m.texto}
        </div>

        {staffMode && !m.apagada && (
          <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-[var(--kv-texto-secundario)] opacity-0 transition-opacity group-hover:opacity-100">
            <button type="button" onClick={() => onModerar("apagar_msg", { mensagemId: m.id })} className="hover:text-[var(--kv-erro)]">
              apagar
            </button>
            <button type="button" onClick={() => onModerar("fixar_msg", { mensagemId: m.id, fixar: !m.fixada })} className="hover:text-[var(--kv-primaria)]">
              {m.fixada ? "desafixar" : "fixar"}
            </button>
            {m.participante_id && (
              <>
                <button type="button" onClick={() => onModerar("mutar", { participanteId: m.participante_id, minutos: 10 })} className="hover:text-[var(--kv-primaria)]">
                  mutar 10m
                </button>
                <button type="button" onClick={() => onModerar("banir", { participanteId: m.participante_id, banir: true })} className="hover:text-[var(--kv-erro)]">
                  banir
                </button>
              </>
            )}
          </div>
        )}
      </div>
      {curavel && onToggleSel && (
        <button
          type="button"
          onClick={onToggleSel}
          title="Selecionar para transmitir no overlay (vMix)"
          aria-label={selecionada ? "Remover do overlay" : "Selecionar para o overlay"}
          className={`mt-0.5 flex h-6 shrink-0 items-center gap-1 self-start rounded-full border px-2 text-[10px] font-bold transition-colors ${
            selecionada
              ? "border-[var(--kv-primaria)] bg-[var(--kv-primaria)] text-[var(--kv-sobre-primaria)]"
              : "border-[var(--borda)] text-[var(--kv-texto-secundario)] hover:border-[var(--kv-primaria)] hover:text-[var(--kv-primaria)]"
          }`}
        >
          {selecionada ? "✓ CG" : "CG"}
        </button>
      )}
    </div>
  );
}

function Avatar({ nome, staff }: { nome: string; staff: boolean }) {
  const inicial = nome.trim().charAt(0).toUpperCase() || "?";
  const hue = [...nome].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <div
      className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
      style={{
        background: staff
          ? "color-mix(in srgb, var(--kv-destaque) 22%, transparent)"
          : `hsl(${hue} 60% 45% / 0.28)`,
        color: staff ? "var(--kv-destaque)" : `hsl(${hue} 70% 78%)`,
      }}
    >
      {inicial}
    </div>
  );
}

function formatHora(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function ChatIcon({ large }: { large?: boolean }) {
  const s = large ? 34 : 16;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={large ? "text-[var(--kv-texto-secundario)] opacity-40" : ""}>
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}
