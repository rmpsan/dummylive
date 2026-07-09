"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { ClienteConfig } from "@/lib/config/schema";
import { useToast } from "./toast";
import { LineChart, BarChart, SegmentStrip } from "./charts";

type Status = "aguardando" | "ao_vivo" | "encerrada";

interface DashData {
  kpis: {
    participantes_unicos: number;
    online_agora: number;
    pico: number;
    tempo_medio_seg: number;
    conclusao_media: number;
    total_mensagens: number;
    msgs_min: number;
  };
  curva: { t: string; online: number }[];
  retencao: { marco: number; qtd: number; pct: number }[];
  trechos: { seg: number; hits: number }[];
  participantes: {
    email: string;
    nome: string;
    papel: string;
    banido: boolean;
    tempo_online_seg: number;
    percentual: number;
    dispositivo: string;
    interacoes: number;
  }[];
  status: Status;
  truncado?: boolean;
}

export function Dashboard({
  slug,
  config,
  owner,
}: {
  slug: string;
  config: ClienteConfig;
  owner?: { clienteNome: string; jobNome: string; jobCodigo: string | null } | null;
}) {
  const toast = useToast();
  const [data, setData] = useState<DashData | null>(null);
  const [erro, setErro] = useState(false);
  const [status, setStatus] = useState<Status>(config.evento.status);
  const [atualizado, setAtualizado] = useState<number>(0);

  const carregar = useCallback(async () => {
    try {
      const res = await fetch(`/api/dashboard?slug=${encodeURIComponent(slug)}`);
      if (!res.ok) {
        setErro(true);
        return;
      }
      const d = (await res.json()) as DashData;
      setData(d);
      setStatus(d.status);
      setErro(false);
      setAtualizado(Date.now());
    } catch {
      setErro(true);
    }
  }, [slug]);

  // Carga inicial + auto-refresh a cada 15s (tempo real aproximado — RF-54).
  useEffect(() => {
    let ativo = true;
    (async () => {
      await carregar();
    })();
    const id = setInterval(() => ativo && carregar(), 15000);
    return () => {
      ativo = false;
      clearInterval(id);
    };
  }, [carregar]);

  async function mudarStatus(novo: Status) {
    const res = await fetch("/api/mod", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, acao: "status", status: novo }),
    });
    if (res.ok) {
      setStatus(novo);
      toast.show(`Status: ${novo.replace("_", " ")}.`, "sucesso");
    } else toast.show("Não foi possível mudar o status.", "erro");
  }

  const k = data?.kpis;
  const onlineMostrar = k?.online_agora ?? 0;

  return (
    <div className="dl-ambient min-h-[var(--app-vh)]">
      <header className="dl-glass sticky top-0 z-30 flex items-center justify-between gap-3 border-b px-4 py-3 safe-top">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="dl-pill dl-badge-staff">Admin</span>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold sm:text-base">
              Dashboard · {config.evento.nome}
            </h1>
            {owner?.clienteNome && (
              <p className="truncate text-[11px] text-[var(--kv-texto-secundario)]">
                {owner.clienteNome}
                {owner.jobNome ? ` · ${owner.jobNome}` : ""}
                {owner.jobCodigo ? ` (${owner.jobCodigo})` : ""}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={carregar} className="dl-btn dl-btn-ghost px-3 py-1.5 text-xs">
            ↻ Atualizar
          </button>
          <Link href={`/${slug}/moderacao`} className="dl-btn dl-btn-ghost px-3 py-1.5 text-xs">
            Moderação
          </Link>
          <Link href={`/${slug}/admin`} className="dl-btn dl-btn-ghost px-3 py-1.5 text-xs">
            ⚙ Config
          </Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-5 px-4 py-5">
        {erro && (
          <p className="dl-card p-4 text-sm text-[var(--kv-erro)]">
            Não foi possível carregar os dados (é necessário Supabase + permissão de admin).
          </p>
        )}
        {data?.truncado && (
          <p className="dl-card border-[color-mix(in_srgb,var(--kv-erro)_40%,transparent)] p-3 text-xs">
            ⚠️ Esta live é muito grande: os números abaixo usam uma amostra
            (limite atingido). Para métricas exatas em lives enormes, exporte os
            dados ou peça a agregação no banco.
          </p>
        )}

        {/* Controle de status (RF-59) */}
        <section className="dl-card flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <h2 className="text-sm font-semibold">Status da transmissão</h2>
            <p className="text-xs text-[var(--kv-texto-secundario)]">
              Controle o estado que os espectadores veem.
            </p>
          </div>
          <div className="flex gap-2">
            {(["aguardando", "ao_vivo", "encerrada"] as Status[]).map((s) => (
              <button
                key={s}
                onClick={() => mudarStatus(s)}
                className={`rounded-[var(--r-md)] px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  status === s
                    ? "bg-[var(--kv-primaria)] text-[var(--kv-sobre-primaria)]"
                    : "border border-[var(--borda)] hover:bg-[var(--kv-texto)]/5"
                }`}
              >
                {s.replace("_", " ")}
              </button>
            ))}
          </div>
        </section>

        {/* KPIs (RF-61) */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Kpi label="Online agora" valor={onlineMostrar} destaque />
          <Kpi label="Pico" valor={k?.pico ?? 0} />
          <Kpi label="Participantes" valor={k?.participantes_unicos ?? 0} />
          <Kpi label="Tempo médio" valor={mmss(k?.tempo_medio_seg ?? 0)} />
          <Kpi label="Conclusão média" valor={`${k?.conclusao_media ?? 0}%`} />
          <Kpi label="Mensagens" valor={k?.total_mensagens ?? 0} sub={`${k?.msgs_min ?? 0}/min`} />
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          {/* Curva de audiência (RF-55) */}
          <section className="dl-card p-5">
            <h2 className="mb-4 text-sm font-semibold">Curva de audiência</h2>
            <LineChart data={data?.curva ?? []} />
          </section>

          {/* Retenção de vídeo (RF-57) */}
          <section className="dl-card p-5">
            <h2 className="mb-4 text-sm font-semibold">Retenção por marco</h2>
            <BarChart
              bars={(data?.retencao ?? []).map((r) => ({
                label: `${r.marco}%`,
                value: r.pct,
              }))}
              formatValue={(v) => `${v}%`}
            />
          </section>
        </div>

        {/* Trechos consumidos (RF-43) */}
        <section className="dl-card p-5">
          <h2 className="mb-1 text-sm font-semibold">Trechos mais assistidos</h2>
          <p className="mb-4 text-xs text-[var(--kv-texto-secundario)]">
            Intensidade por posição do vídeo (amostrada por heartbeat). Vales indicam abandono.
          </p>
          <SegmentStrip trechos={data?.trechos ?? []} />
        </section>

        {/* Tabela de participantes (RF-56) + export (RF-58) */}
        <section className="dl-card p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">
              Participantes ({data?.participantes.length ?? 0})
            </h2>
            <div className="flex gap-2">
              <a href={`/api/export?slug=${slug}&formato=csv`} className="dl-btn dl-btn-ghost px-3 py-1.5 text-xs">
                ↓ CSV
              </a>
              <a href={`/api/export?slug=${slug}&formato=xlsx`} className="dl-btn dl-btn-primary px-3 py-1.5 text-xs">
                ↓ XLSX
              </a>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--borda)] text-xs text-[var(--kv-texto-secundario)]">
                  <Th>Participante</Th>
                  <Th>Tempo online</Th>
                  <Th>% assistido</Th>
                  <Th>Interações</Th>
                  <Th>Dispositivo</Th>
                </tr>
              </thead>
              <tbody>
                {(data?.participantes ?? []).slice(0, 200).map((p, i) => (
                  <tr key={i} className="border-b border-[var(--borda)]/50">
                    <td className="py-2 pr-3">
                      <div className="font-medium">{p.nome || p.email}</div>
                      <div className="text-xs text-[var(--kv-texto-secundario)]">{p.email}</div>
                    </td>
                    <td className="py-2 pr-3 tabular-nums">{mmss(p.tempo_online_seg)}</td>
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--kv-texto)]/10">
                          <div className="h-full rounded-full bg-[var(--kv-primaria)]" style={{ width: `${p.percentual}%` }} />
                        </div>
                        <span className="tabular-nums text-xs">{p.percentual}%</span>
                      </div>
                    </td>
                    <td className="py-2 pr-3 tabular-nums">{p.interacoes}</td>
                    <td className="py-2 pr-3 text-xs text-[var(--kv-texto-secundario)]">{p.dispositivo || "—"}</td>
                  </tr>
                ))}
                {(!data || data.participantes.length === 0) && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-sm text-[var(--kv-texto-secundario)]">
                      Nenhum participante ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <p className="text-center text-xs text-[var(--kv-texto-secundario)]">
          {atualizado ? `Atualizado ${new Date(atualizado).toLocaleTimeString("pt-BR")}` : "Carregando…"} · atualiza a cada 15s
        </p>
      </div>
    </div>
  );
}

function Kpi({
  label,
  valor,
  sub,
  destaque,
}: {
  label: string;
  valor: string | number;
  sub?: string;
  destaque?: boolean;
}) {
  return (
    <div className={`dl-card p-4 ${destaque ? "ring-1 ring-[var(--kv-primaria-40)]" : ""}`}>
      <div className="text-xs text-[var(--kv-texto-secundario)]">{label}</div>
      <div className="mt-1 flex items-end gap-1.5">
        <span className="text-2xl font-bold tabular-nums">{valor}</span>
        {sub && <span className="pb-1 text-[10px] text-[var(--kv-texto-secundario)]">{sub}</span>}
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="pb-2 pr-3 font-medium">{children}</th>;
}

function mmss(seg: number) {
  const m = Math.floor(seg / 60);
  const s = Math.floor(seg % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
