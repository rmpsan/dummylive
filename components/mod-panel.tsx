"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ClienteConfig } from "@/lib/config/schema";
import { getBrowserClient } from "@/lib/supabase/client";
import { useToast } from "./toast";
import { Chat } from "./chat";
import { LiveLogo } from "./live-logo";

type Papel = "moderador" | "admin" | "super_admin";
type Status = "aguardando" | "ao_vivo" | "encerrada";

interface Participante {
  id: string;
  email: string;
  nome: string | null;
  papel: string;
  banido: boolean;
  silenciado_ate: string | null;
  created_at: string;
}

export function ModPanel({
  slug,
  config,
  liveId,
  papel,
  staffEmail,
  initialStatus,
  canalToken,
}: {
  slug: string;
  config: ClienteConfig;
  liveId: string;
  papel: Papel;
  staffEmail: string;
  initialStatus: Status;
  canalToken: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const isAdmin = papel === "admin" || papel === "super_admin";
  const supabase = useMemo(() => getBrowserClient(), []);

  const [status, setStatus] = useState<Status>(initialStatus);
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [online, setOnline] = useState<number | null>(null);
  const [oficial, setOficial] = useState("");
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setOrigin(window.location.origin), 0);
    return () => clearTimeout(id);
  }, []);
  const overlayUrl = `${origin}/overlay/${slug}`;

  const moderar = useCallback(
    async (acao: string, extra: Record<string, unknown> = {}) => {
      const res = await fetch("/api/mod", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, acao, ...extra }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.show(`Ação falhou: ${data?.erro ?? res.status}`, "erro");
        return null;
      }
      return data;
    },
    [slug, toast]
  );

  const carregarParticipantes = useCallback(async () => {
    const res = await fetch(`/api/mod?slug=${encodeURIComponent(slug)}`);
    if (res.ok) {
      const data = await res.json();
      setParticipantes(data.participantes ?? []);
      setOnline(data.online ?? 0);
    }
  }, [slug]);

  // Carga inicial + refresh do online/participantes a cada 20s.
  useEffect(() => {
    let ativo = true;
    const puxar = async () => {
      const res = await fetch(`/api/mod?slug=${encodeURIComponent(slug)}`);
      if (ativo && res.ok) {
        const data = await res.json();
        setParticipantes(data.participantes ?? []);
        setOnline(data.online ?? 0);
      }
    };
    puxar();
    const id = setInterval(puxar, 20000);
    return () => {
      ativo = false;
      clearInterval(id);
    };
  }, [slug]);

  // Reflete mudança de status da live em tempo real (sem presença).
  useEffect(() => {
    if (!supabase) return;
    const estadoCh = supabase
      .channel(`estado:${liveId}:mod`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_estado", filter: `live_id=eq.${liveId}` },
        (payload) => {
          const s = (payload.new as { status?: Status })?.status;
          if (s) setStatus(s);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(estadoCh);
    };
  }, [supabase, liveId]);

  async function mudarStatus(novo: Status) {
    const r = await moderar("status", { status: novo });
    if (r) {
      setStatus(novo);
      toast.show(`Status alterado para "${novo.replace("_", " ")}".`, "sucesso");
    }
  }

  async function enviarOficial(e: FormEvent) {
    e.preventDefault();
    if (!oficial.trim()) return;
    const r = await moderar("mensagem_oficial", { texto: oficial.trim() });
    if (r) {
      setOficial("");
      toast.show("Mensagem oficial enviada.", "sucesso");
    }
  }

  async function acaoParticipante(
    acao: "mutar" | "banir",
    p: Participante,
    ativar: boolean
  ) {
    if (acao === "mutar")
      await moderar("mutar", { participanteId: p.id, minutos: ativar ? 10 : 0 });
    else await moderar("banir", { participanteId: p.id, banir: ativar });
    await carregarParticipantes();
  }

  async function sair() {
    await supabase?.auth.signOut();
    router.push(`/${slug}/staff`);
    router.refresh();
  }

  const silenciado = (p: Participante) =>
    !!p.silenciado_ate && new Date(p.silenciado_ate) > new Date();

  return (
    <div className="dl-ambient flex min-h-[var(--app-vh)] flex-col">
      <header className="dl-glass sticky top-0 z-30 flex items-center justify-between gap-3 border-b px-4 py-3 safe-top">
        <div className="flex items-center gap-2.5">
          <LiveLogo config={config} className="max-h-8 w-auto" />
          <span className="dl-pill dl-badge-staff">{papel}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-[var(--kv-texto-secundario)]">
          {online !== null && (
            <span className="dl-pill">👁 {online}</span>
          )}
          <span className="hidden md:inline">{staffEmail}</span>
          {isAdmin && (
            <>
              <Link href={`/${slug}/dashboard`} className="dl-btn dl-btn-ghost px-3 py-1.5 text-xs">
                📊 Dashboard
              </Link>
              <Link href={`/${slug}/admin`} className="dl-btn dl-btn-ghost px-3 py-1.5 text-xs">
                ⚙ Configurações
              </Link>
            </>
          )}
          <button onClick={sair} className="dl-btn dl-btn-ghost px-3 py-1.5 text-xs">
            Sair
          </button>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-4 p-4 lg:grid lg:grid-cols-[1fr_380px]">
        {/* Chat em modo moderação */}
        <section className="flex min-h-[420px] flex-col lg:h-[calc(var(--app-vh)-6rem)]">
          <Chat
            slug={slug}
            liveId={liveId}
            config={config}
            canalToken={canalToken}
            podeEnviar={false}
            staffMode
          />
        </section>

        {/* Painel de controles */}
        <aside className="flex flex-col gap-4 overflow-y-auto">
          {/* Status (admin) */}
          {isAdmin && (
            <Bloco titulo="Status da transmissão">
              <div className="grid grid-cols-3 gap-2">
                {(["aguardando", "ao_vivo", "encerrada"] as Status[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => mudarStatus(s)}
                    className={`rounded-[var(--r-md)] px-2 py-2 text-xs font-medium capitalize transition-colors ${
                      status === s
                        ? "bg-[var(--kv-primaria)] text-[var(--kv-sobre-primaria)]"
                        : "border border-[var(--borda)] hover:bg-[var(--kv-texto)]/5"
                    }`}
                  >
                    {s.replace("_", " ")}
                  </button>
                ))}
              </div>
            </Bloco>
          )}

          {/* Overlay / CG para o vMix */}
          <Bloco titulo="Overlay para o vMix (CG)">
            <p className="mb-2.5 text-xs leading-relaxed text-[var(--kv-texto-secundario)]">
              No chat, clique em <strong className="text-[var(--kv-texto)]">CG</strong>{" "}
              para selecionar mensagens e depois em{" "}
              <strong className="text-[var(--kv-texto)]">▶ Transmitir</strong>. Elas
              entram em fila no overlay, <strong className="text-[var(--kv-texto)]">5s
              cada</strong>. Use o link abaixo como <em>Web Browser input</em> no
              vMix (fundo transparente).
            </p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={overlayUrl}
                onFocus={(e) => e.currentTarget.select()}
                className="dl-field !min-h-0 flex-1 py-1.5 text-xs"
              />
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(overlayUrl).then(
                    () => toast.show("Link do overlay copiado.", "sucesso"),
                    () => toast.show("Copie o link manualmente.", "erro")
                  );
                }}
                className="dl-btn dl-btn-ghost shrink-0 px-3 py-1.5 text-xs"
              >
                Copiar
              </button>
              <a
                href={overlayUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="dl-btn dl-btn-primary shrink-0 px-3 py-1.5 text-xs"
              >
                Abrir
              </a>
            </div>
          </Bloco>

          {/* Mensagem oficial */}
          <Bloco titulo="Mensagem oficial">
            <form onSubmit={enviarOficial} className="flex flex-col gap-2.5">
              <textarea
                value={oficial}
                onChange={(e) => setOficial(e.target.value)}
                rows={2}
                placeholder="Comunicado da equipe…"
                className="dl-field resize-none"
              />
              <button type="submit" disabled={!oficial.trim()} className="dl-btn dl-btn-primary self-end">
                Enviar como staff
              </button>
            </form>
          </Bloco>

          {/* Participantes */}
          <Bloco
            titulo={`Participantes (${participantes.length})`}
            acao={
              <button onClick={carregarParticipantes} className="text-xs text-[var(--kv-texto-secundario)] hover:underline">
                atualizar
              </button>
            }
          >
            <div className="max-h-80 space-y-1 overflow-y-auto">
              {participantes.length === 0 && (
                <p className="py-4 text-center text-sm text-[var(--kv-texto-secundario)]">
                  Ninguém ainda.
                </p>
              )}
              {participantes.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2 rounded-[var(--r-sm)] px-2 py-1.5 text-sm transition-colors hover:bg-[var(--kv-texto)]/[0.04]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{p.nome || p.email}</div>
                    <div className="flex gap-1.5">
                      {p.banido && (
                        <span className="dl-pill dl-badge-live px-1.5 py-0.5 text-[9px]">banido</span>
                      )}
                      {silenciado(p) && (
                        <span className="dl-pill px-1.5 py-0.5 text-[9px]">silenciado</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => acaoParticipante("mutar", p, !silenciado(p))}
                    className="shrink-0 text-[11px] text-[var(--kv-texto-secundario)] hover:text-[var(--kv-primaria)]"
                  >
                    {silenciado(p) ? "dessilenciar" : "mutar"}
                  </button>
                  <button
                    onClick={() => acaoParticipante("banir", p, !p.banido)}
                    className="shrink-0 text-[11px] text-[var(--kv-texto-secundario)] hover:text-[var(--kv-erro)]"
                  >
                    {p.banido ? "desbanir" : "banir"}
                  </button>
                </div>
              ))}
            </div>
          </Bloco>

          {/* Promover staff (admin) */}
          {isAdmin && <PromoverStaff moderar={moderar} />}
        </aside>
      </div>
    </div>
  );
}

function Bloco({
  titulo,
  acao,
  children,
}: {
  titulo: string;
  acao?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="dl-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{titulo}</h2>
        {acao}
      </div>
      {children}
    </div>
  );
}

function PromoverStaff({
  moderar,
}: {
  moderar: (acao: string, extra?: Record<string, unknown>) => Promise<unknown>;
}) {
  const [email, setEmail] = useState("");
  const [papel, setPapel] = useState<"moderador" | "admin">("moderador");
  const [senha, setSenha] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function promover(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    const r = await moderar("promover", {
      email: email.trim().toLowerCase(),
      papel,
      ...(senha ? { senha } : {}),
    });
    if (r) {
      setMsg("Staff atualizado.");
      setEmail("");
      setSenha("");
    }
  }

  return (
    <Bloco titulo="Promover equipe">
      <form onSubmit={promover} className="flex flex-col gap-2.5">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@equipe.com"
          className="dl-field"
        />
        <div className="flex gap-2">
          <select
            value={papel}
            onChange={(e) => setPapel(e.target.value as "moderador" | "admin")}
            className="dl-field flex-1"
          >
            <option value="moderador">Moderador</option>
            <option value="admin">Admin</option>
          </select>
          <input
            type="text"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="senha (opcional)"
            className="dl-field flex-1"
          />
        </div>
        <button type="submit" disabled={!email.trim()} className="dl-btn dl-btn-primary self-end">
          Salvar
        </button>
        {msg && <p className="text-xs text-[var(--kv-sucesso)]">{msg}</p>}
        <p className="text-[11px] text-[var(--kv-texto-secundario)]">
          Preencha a senha para já criar o acesso de login; sem senha, apenas
          registra o papel (a conta é criada depois).
        </p>
      </form>
    </Bloco>
  );
}
