"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getBrowserClient } from "@/lib/supabase/client";

interface Job {
  id: string;
  nome: string;
  codigo: string | null;
}
interface Cliente {
  id: string;
  nome: string;
  slug: string | null;
  jobs: Job[];
}
interface Live {
  id: string;
  cliente_slug: string;
  nome: string;
  status: string;
  video_fonte: string;
  video_url: string;
  cliente_id: string | null;
  job_id: string | null;
}

export function SuperConsole({
  autorizado,
  email,
  semBanco,
}: {
  autorizado: boolean;
  email: string | null;
  semBanco: boolean;
}) {
  if (semBanco) {
    return (
      <Shell>
        <p className="dl-card p-6 text-center text-sm text-[var(--kv-texto-secundario)]">
          Banco de dados não configurado (dev).
        </p>
      </Shell>
    );
  }
  return autorizado ? <Console email={email} /> : <Login />;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="dl-ambient min-h-[var(--app-vh)]">
      <header className="dl-glass sticky top-0 z-30 flex items-center justify-between border-b px-4 py-3 safe-top">
        <h1 className="flex items-center gap-2 text-sm font-semibold sm:text-base">
          <span className="dl-pill dl-badge-staff">Super-admin</span> Dummy Live
        </h1>
      </header>
      <div className="mx-auto max-w-5xl px-4 py-6">{children}</div>
    </main>
  );
}

function Login() {
  const router = useRouter();
  const [em, setEm] = useState("");
  const [pw, setPw] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [load, setLoad] = useState(false);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    const supabase = getBrowserClient();
    if (!supabase) return;
    setLoad(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: em.trim().toLowerCase(),
      password: pw,
    });
    setLoad(false);
    if (error) setErro("Email ou senha inválidos.");
    else router.refresh();
  }

  return (
    <Shell>
      <form onSubmit={entrar} className="dl-glass mx-auto mt-10 flex max-w-sm flex-col gap-4 rounded-[var(--r-lg)] p-6">
        <h2 className="text-lg font-semibold">Acesso do super-admin</h2>
        <input className="dl-field" type="email" placeholder="Email" value={em} onChange={(e) => setEm(e.target.value)} />
        <input className="dl-field" type="password" placeholder="Senha" value={pw} onChange={(e) => setPw(e.target.value)} />
        {erro && <p className="text-sm text-[var(--kv-erro)]">{erro}</p>}
        <button className="dl-btn dl-btn-primary" disabled={load}>
          {load ? "Entrando…" : "Entrar"}
        </button>
        <p className="text-xs text-[var(--kv-texto-secundario)]">
          Somente contas cadastradas em <code>super_admins</code> têm acesso.
        </p>
      </form>
    </Shell>
  );
}

function Console({ email }: { email: string | null }) {
  const router = useRouter();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [lives, setLives] = useState<Live[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    const res = await fetch("/api/super");
    if (res.ok) {
      const d = await res.json();
      setClientes(d.clientes ?? []);
      setLives(d.lives ?? []);
    }
    setCarregando(false);
  }, []);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const res = await fetch("/api/super");
      if (ativo && res.ok) {
        const d = await res.json();
        setClientes(d.clientes ?? []);
        setLives(d.lives ?? []);
      }
      if (ativo) setCarregando(false);
    })();
    return () => {
      ativo = false;
    };
  }, []);

  const acao = useCallback(
    async (payload: Record<string, unknown>) => {
      setMsg(null);
      const res = await fetch("/api/super", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(`Falhou: ${d?.erro ?? res.status}`);
        return false;
      }
      await carregar();
      setMsg("Salvo.");
      return true;
    },
    [carregar]
  );

  async function sair() {
    await getBrowserClient()?.auth.signOut();
    router.refresh();
  }

  return (
    <main className="dl-ambient min-h-[var(--app-vh)]">
      <header className="dl-glass sticky top-0 z-30 flex items-center justify-between gap-3 border-b px-4 py-3 safe-top">
        <h1 className="flex items-center gap-2 text-sm font-semibold sm:text-base">
          <span className="dl-pill dl-badge-staff">Super-admin</span> Dummy Live
        </h1>
        <div className="flex items-center gap-2 text-xs text-[var(--kv-texto-secundario)]">
          <span className="hidden sm:inline">{email}</span>
          <button onClick={sair} className="dl-btn dl-btn-ghost px-3 py-1.5 text-xs">
            Sair
          </button>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-5 px-4 py-6">
        {msg && (
          <p className="dl-card p-3 text-sm">{msg}</p>
        )}

        <NovaLive clientes={clientes} onCriar={acao} />

        <section className="dl-card p-5">
          <h2 className="mb-3 text-base font-semibold">
            Lives ({lives.length})
          </h2>
          {carregando ? (
            <p className="text-sm text-[var(--kv-texto-secundario)]">Carregando…</p>
          ) : lives.length === 0 ? (
            <p className="text-sm text-[var(--kv-texto-secundario)]">Nenhuma live ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--borda)] text-xs text-[var(--kv-texto-secundario)]">
                    <th className="pb-2 pr-3 font-medium">Live</th>
                    <th className="pb-2 pr-3 font-medium">Cliente / Job</th>
                    <th className="pb-2 pr-3 font-medium">Fonte</th>
                    <th className="pb-2 pr-3 font-medium">Status</th>
                    <th className="pb-2 pr-3 font-medium">Links</th>
                  </tr>
                </thead>
                <tbody>
                  {lives.map((l) => {
                    const cli = clientes.find((c) => c.id === l.cliente_id);
                    return (
                      <tr key={l.id} className="border-b border-[var(--borda)]/50">
                        <td className="py-2 pr-3">
                          <div className="font-medium">{l.nome}</div>
                          <div className="text-xs text-[var(--kv-texto-secundario)]">/{l.cliente_slug}</div>
                        </td>
                        <td className="py-2 pr-3">
                          <div className="flex flex-col gap-1">
                            <select
                              className="dl-field !min-h-0 py-1 text-xs"
                              value={l.cliente_id ?? ""}
                              onChange={(e) =>
                                acao({ acao: "vincular_live", live_id: l.id, cliente_id: e.target.value || undefined, job_id: undefined })
                              }
                            >
                              <option value="">— cliente —</option>
                              {clientes.map((c) => (
                                <option key={c.id} value={c.id}>{c.nome}</option>
                              ))}
                            </select>
                            <select
                              className="dl-field !min-h-0 py-1 text-xs"
                              value={l.job_id ?? ""}
                              disabled={!l.cliente_id}
                              onChange={(e) =>
                                acao({ acao: "vincular_live", live_id: l.id, cliente_id: l.cliente_id ?? undefined, job_id: e.target.value || undefined })
                              }
                            >
                              <option value="">— job —</option>
                              {(cli?.jobs ?? []).map((j) => (
                                <option key={j.id} value={j.id}>{j.nome}</option>
                              ))}
                            </select>
                          </div>
                        </td>
                        <td className="py-2 pr-3 text-xs capitalize">{l.video_fonte}</td>
                        <td className="py-2 pr-3 text-xs">{l.status.replace("_", " ")}</td>
                        <td className="py-2 pr-3 text-xs">
                          <Link href={`/${l.cliente_slug}`} target="_blank" className="underline">live</Link>
                          {" · "}
                          <Link href={`/${l.cliente_slug}/admin`} target="_blank" className="underline">config</Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <Clientes clientes={clientes} onAcao={acao} />
      </div>
    </main>
  );
}

function NovaLive({
  clientes,
  onCriar,
}: {
  clientes: Cliente[];
  onCriar: (p: Record<string, unknown>) => Promise<boolean>;
}) {
  const [slug, setSlug] = useState("");
  const [nome, setNome] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [jobId, setJobId] = useState("");
  const [fonte, setFonte] = useState("vimeo");
  const [url, setUrl] = useState("");
  const [senha, setSenha] = useState("");
  const jobs = clientes.find((c) => c.id === clienteId)?.jobs ?? [];

  async function criar(e: FormEvent) {
    e.preventDefault();
    const ok = await onCriar({
      acao: "criar_live",
      slug: slug.trim(),
      nome: nome.trim(),
      cliente_id: clienteId || undefined,
      job_id: jobId || undefined,
      video_fonte: fonte,
      video_url: url.trim(),
      senha: senha.trim(),
    });
    if (ok) {
      setSlug(""); setNome(""); setUrl(""); setSenha("");
    }
  }

  return (
    <section className="dl-card p-5">
      <h2 className="mb-3 text-base font-semibold">Nova live</h2>
      <form onSubmit={criar} className="grid gap-3 sm:grid-cols-2">
        <Campo label="Slug (URL)"><input className="dl-field" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} placeholder="cliente-2026" /></Campo>
        <Campo label="Nome do evento"><input className="dl-field" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Convenção 2026" /></Campo>
        <Campo label="Cliente">
          <select className="dl-field" value={clienteId} onChange={(e) => { setClienteId(e.target.value); setJobId(""); }}>
            <option value="">—</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </Campo>
        <Campo label="Job">
          <select className="dl-field" value={jobId} onChange={(e) => setJobId(e.target.value)} disabled={!clienteId}>
            <option value="">—</option>
            {jobs.map((j) => <option key={j.id} value={j.id}>{j.nome}</option>)}
          </select>
        </Campo>
        <Campo label="Fonte do vídeo">
          <select className="dl-field" value={fonte} onChange={(e) => setFonte(e.target.value)}>
            <option value="vimeo">Vimeo</option>
            <option value="youtube">YouTube</option>
          </select>
        </Campo>
        <Campo label="Link do vídeo"><input className="dl-field" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" /></Campo>
        <Campo label="Senha do espectador"><input className="dl-field" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="SENHA2026" /></Campo>
        <div className="flex items-end">
          <button className="dl-btn dl-btn-primary w-full" disabled={!slug.trim() || !nome.trim() || !clienteId || !senha.trim()}>
            Criar live
          </button>
        </div>
      </form>
    </section>
  );
}

function Clientes({
  clientes,
  onAcao,
}: {
  clientes: Cliente[];
  onAcao: (p: Record<string, unknown>) => Promise<boolean>;
}) {
  const [novo, setNovo] = useState("");
  const [jobNome, setJobNome] = useState<Record<string, string>>({});
  const [jobCod, setJobCod] = useState<Record<string, string>>({});

  return (
    <section className="dl-card p-5">
      <h2 className="mb-3 text-base font-semibold">Clientes & jobs ({clientes.length})</h2>
      <form
        onSubmit={async (e) => { e.preventDefault(); if (await onAcao({ acao: "criar_cliente", nome: novo.trim() })) setNovo(""); }}
        className="mb-4 flex gap-2"
      >
        <input className="dl-field" value={novo} onChange={(e) => setNovo(e.target.value)} placeholder="Novo cliente (ex.: ACME Corp)" />
        <button className="dl-btn dl-btn-primary shrink-0" disabled={!novo.trim()}>Adicionar</button>
      </form>

      <div className="space-y-3">
        {clientes.map((c) => (
          <div key={c.id} className="rounded-[var(--r-md)] border border-[var(--borda)] p-3">
            <div className="mb-2 font-medium">{c.nome}</div>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {c.jobs.length === 0 && <span className="text-xs text-[var(--kv-texto-secundario)]">sem jobs</span>}
              {c.jobs.map((j) => (
                <span key={j.id} className="dl-pill">{j.nome}{j.codigo ? ` · ${j.codigo}` : ""}</span>
              ))}
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const ok = await onAcao({ acao: "criar_job", cliente_id: c.id, nome: (jobNome[c.id] ?? "").trim(), codigo: (jobCod[c.id] ?? "").trim() || undefined });
                if (ok) { setJobNome((p) => ({ ...p, [c.id]: "" })); setJobCod((p) => ({ ...p, [c.id]: "" })); }
              }}
              className="flex flex-wrap gap-2"
            >
              <input className="dl-field flex-1" value={jobNome[c.id] ?? ""} onChange={(e) => setJobNome((p) => ({ ...p, [c.id]: e.target.value }))} placeholder="Novo job" />
              <input className="dl-field w-32" value={jobCod[c.id] ?? ""} onChange={(e) => setJobCod((p) => ({ ...p, [c.id]: e.target.value }))} placeholder="Código" />
              <button className="dl-btn dl-btn-ghost shrink-0" disabled={!(jobNome[c.id] ?? "").trim()}>+ Job</button>
            </form>
          </div>
        ))}
      </div>
    </section>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
