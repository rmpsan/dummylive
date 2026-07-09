"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ClienteConfig } from "@/lib/config/schema";
import { useToast } from "./toast";

/**
 * Painel de administração da live (RF-68). O cliente (admin) liga/desliga
 * funcionalidades e edita textos, aparência, CTA, reações e acesso — sem
 * tocar em JSON. Salva em `lives.config_json` via /api/mod (salvar_config).
 */
export function ConfigEditor({
  slug,
  config,
  owner,
}: {
  slug: string;
  config: ClienteConfig;
  owner?: {
    clienteNome: string;
    jobNome: string;
    jobCodigo: string | null;
  } | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [cfg, setCfg] = useState<ClienteConfig>(config);
  const [senha, setSenha] = useState("");
  const [clienteNome, setClienteNome] = useState(owner?.clienteNome ?? "");
  const [jobNome, setJobNome] = useState(owner?.jobNome ?? "");
  const [jobCodigo, setJobCodigo] = useState(owner?.jobCodigo ?? "");
  const [salvando, setSalvando] = useState(false);

  type C = ClienteConfig;
  const upEvento = (p: Partial<C["evento"]>) =>
    setCfg((c) => ({ ...c, evento: { ...c.evento, ...p } }));
  const upFeatures = (p: Partial<C["features"]>) =>
    setCfg((c) => ({ ...c, features: { ...c.features, ...p } }));
  const upCta = (p: Partial<C["features"]["cta"]>) =>
    setCfg((c) => ({
      ...c,
      features: { ...c.features, cta: { ...c.features.cta, ...p } },
    }));
  const upTextos = (p: Partial<C["textos"]>) =>
    setCfg((c) => ({ ...c, textos: { ...c.textos, ...p } }));
  const upCores = (p: Partial<C["kv"]["cores"]>) =>
    setCfg((c) => ({ ...c, kv: { ...c.kv, cores: { ...c.kv.cores, ...p } } }));
  const upLayout = (p: Partial<C["kv"]["layout"]>) =>
    setCfg((c) => ({ ...c, kv: { ...c.kv, layout: { ...c.kv.layout, ...p } } }));

  async function salvar() {
    setSalvando(true);
    try {
      const res = await fetch("/api/mod", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          acao: "salvar_config",
          config: cfg,
          senha_espectador: senha.trim() || undefined,
          cliente_nome: clienteNome.trim() || undefined,
          job_nome: jobNome.trim() || undefined,
          job_codigo: jobCodigo.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 503)
          toast.show("Banco não configurado (dev).", "erro");
        else if (data?.erro === "config_invalida")
          toast.show(
            `Config inválida: ${data.issues?.[0]?.path?.join(".") ?? ""}`,
            "erro"
          );
        else if (data?.erro === "papel_insuficiente")
          toast.show("Apenas administradores podem salvar.", "erro");
        else toast.show("Não foi possível salvar.", "erro");
        return;
      }
      setSenha("");
      toast.show("Configuração salva. Espectadores veem ao recarregar.", "sucesso");
      router.refresh();
    } catch {
      toast.show("Falha de conexão.", "erro");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="dl-ambient min-h-[var(--app-vh)]">
      <header className="dl-glass sticky top-0 z-30 flex items-center justify-between gap-3 border-b px-4 py-3 safe-top">
        <div className="flex items-center gap-2.5">
          <span className="dl-pill dl-badge-staff">Admin</span>
          <h1 className="text-sm font-semibold sm:text-base">
            Configuração da live
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/${slug}/dashboard`}
            className="dl-btn dl-btn-ghost px-3 py-1.5 text-xs"
          >
            📊 Dashboard
          </Link>
          <Link
            href={`/${slug}/moderacao`}
            className="dl-btn dl-btn-ghost px-3 py-1.5 text-xs"
          >
            Moderação
          </Link>
          <Link
            href={`/${slug}`}
            target="_blank"
            className="dl-btn dl-btn-ghost px-3 py-1.5 text-xs"
          >
            Ver a live ↗
          </Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-3xl gap-5 px-4 pb-28 pt-5">
        <Bloco titulo="Geral" desc="Identificação e vídeo da transmissão.">
          <Text label="Nome do evento" value={cfg.evento.nome} onChange={(v) => upEvento({ nome: v })} />
          <Text label="Subtítulo" value={cfg.evento.subtitulo} onChange={(v) => upEvento({ subtitulo: v })} />
          <Row>
            <Select
              label="Fonte do vídeo"
              value={cfg.evento.video_fonte ?? "vimeo"}
              options={[
                ["vimeo", "Vimeo"],
                ["youtube", "YouTube"],
              ]}
              onChange={(v) => upEvento({ video_fonte: v as "vimeo" | "youtube" })}
            />
            <Toggle label="É transmissão ao vivo (Live)" value={cfg.evento.vimeo_is_live} onChange={(v) => upEvento({ vimeo_is_live: v })} />
          </Row>
          <Text
            label="Link do vídeo"
            value={cfg.evento.video_url ?? ""}
            onChange={(v) => upEvento({ video_url: v })}
            placeholder="https://youtube.com/watch?v=…  ou  https://vimeo.com/123456789"
          />
          <Select
            label="Status"
            value={cfg.evento.status}
            options={[
              ["aguardando", "Aguardando"],
              ["ao_vivo", "Ao vivo"],
              ["encerrada", "Encerrada"],
            ]}
            onChange={(v) => upEvento({ status: v as C["evento"]["status"] })}
          />
        </Bloco>

        <Bloco titulo="Cliente & Job" desc="A quem esta live pertence (organização e faturamento).">
          <Text label="Cliente" value={clienteNome} onChange={setClienteNome} placeholder="Ex.: ACME Corp" />
          <Row>
            <Text label="Job / Projeto" value={jobNome} onChange={setJobNome} placeholder="Ex.: Convenção Anual" />
            <Text label="Código do job" value={jobCodigo} onChange={setJobCodigo} placeholder="Ex.: JOB-2026-014" />
          </Row>
        </Bloco>

        <Bloco titulo="Funcionalidades" desc="Ligue ou desligue cada recurso.">
          <Toggle label="Chat ao vivo" value={cfg.features.chat} onChange={(v) => upFeatures({ chat: v })} />
          <Toggle label="Reações (emojis)" value={cfg.features.reacoes} onChange={(v) => upFeatures({ reacoes: v })} />
          <Toggle label="Contador de espectadores online" value={cfg.features.contador_online} onChange={(v) => upFeatures({ contador_online: v })} />
          <Toggle label="Enquetes ao vivo (em breve)" value={cfg.features.enquetes} onChange={(v) => upFeatures({ enquetes: v })} disabled />
        </Bloco>

        <Bloco titulo="Reações" desc="Emojis exibidos na barra de reações (separados por espaço).">
          <Text
            label="Emojis"
            value={cfg.features.emojis.join(" ")}
            onChange={(v) =>
              upFeatures({ emojis: v.split(/\s+/).filter(Boolean).slice(0, 8) })
            }
            placeholder="❤️ 👏 🔥 😮 🎉"
          />
        </Bloco>

        <Bloco titulo="Chat" desc="Limites e moderação automática.">
          <Row>
            <Num label="Intervalo entre mensagens (s)" value={cfg.features.rate_limit_segundos} onChange={(v) => upFeatures({ rate_limit_segundos: v })} min={0} />
            <Num label="Limite de caracteres" value={cfg.features.limite_caracteres_msg} onChange={(v) => upFeatures({ limite_caracteres_msg: v })} min={1} />
          </Row>
          <Area
            label="Palavras proibidas (uma por linha)"
            value={cfg.features.palavras_proibidas.join("\n")}
            onChange={(v) =>
              upFeatures({
                palavras_proibidas: v.split(/[\n,]/).map((s) => s.trim()).filter(Boolean),
              })
            }
          />
        </Bloco>

        <Bloco titulo="CTA (chamada para ação)" desc="Botão de conversão exibido na sala.">
          <Toggle label="Exibir CTA" value={cfg.features.cta.ativo} onChange={(v) => upCta({ ativo: v })} />
          <Text label="Texto do botão" value={cfg.features.cta.texto} onChange={(v) => upCta({ texto: v })} />
          <Text label="URL de destino" value={cfg.features.cta.url ?? ""} onChange={(v) => upCta({ url: v })} placeholder="https://…" />
        </Bloco>

        <Bloco titulo="Textos" desc="Mensagens exibidas ao espectador.">
          <Text label="Título da entrada" value={cfg.textos.titulo_entrada} onChange={(v) => upTextos({ titulo_entrada: v })} />
          <Text label="Boas-vindas" value={cfg.textos.boas_vindas} onChange={(v) => upTextos({ boas_vindas: v })} />
          <Text label="Rótulo 'ao vivo'" value={cfg.textos.ao_vivo_label} onChange={(v) => upTextos({ ao_vivo_label: v })} />
          <Text label="Tela de espera" value={cfg.textos.aguardando} onChange={(v) => upTextos({ aguardando: v })} />
          <Text label="Tela de encerramento" value={cfg.textos.encerrada} onChange={(v) => upTextos({ encerrada: v })} />
          <Text label="Rodapé" value={cfg.textos.rodape} onChange={(v) => upTextos({ rodape: v })} />
        </Bloco>

        <Bloco titulo="Aparência" desc="Cores e layout — trocar aqui re-skina a live inteira.">
          <Row>
            <Color label="Primária" value={cfg.kv.cores.primaria} onChange={(v) => upCores({ primaria: v })} />
            <Color label="Texto sobre a primária" value={cfg.kv.cores.sobre_primaria} onChange={(v) => upCores({ sobre_primaria: v })} />
          </Row>
          <Row>
            <Color label="Fundo" value={cfg.kv.cores.fundo} onChange={(v) => upCores({ fundo: v })} />
            <Color label="Superfície" value={cfg.kv.cores.superficie} onChange={(v) => upCores({ superficie: v })} />
          </Row>
          <Row>
            <Color label="Texto" value={cfg.kv.cores.texto} onChange={(v) => upCores({ texto: v })} />
            <Color label="Destaque (staff)" value={cfg.kv.cores.destaque} onChange={(v) => upCores({ destaque: v })} />
          </Row>
          <Row>
            <Text label="Raio das bordas" value={cfg.kv.layout.raio_borda} onChange={(v) => upLayout({ raio_borda: v })} placeholder="14px" />
            <Select
              label="Posição do chat"
              value={cfg.kv.layout.posicao_chat}
              options={[["direita", "Direita"], ["esquerda", "Esquerda"]]}
              onChange={(v) => upLayout({ posicao_chat: v as C["kv"]["layout"]["posicao_chat"] })}
            />
          </Row>
        </Bloco>

        <Bloco titulo="Acesso" desc="Senha única do espectador. Deixe em branco para manter a atual.">
          <Text label="Nova senha de acesso" value={senha} onChange={setSenha} placeholder="•••••• (em branco = mantém)" />
        </Bloco>
      </div>

      {/* Barra de salvar fixa */}
      <div className="dl-glass fixed inset-x-0 bottom-0 z-40 border-t px-4 py-3 safe-bottom">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <span className="text-xs text-[var(--kv-texto-secundario)]">
            As mudanças valem para novos acessos (o espectador recarrega).
          </span>
          <button onClick={salvar} disabled={salvando} className="dl-btn dl-btn-primary">
            {salvando ? "Salvando…" : "Salvar alterações"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- primitivos ---------- */

function Bloco({ titulo, desc, children }: { titulo: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="dl-card p-5">
      <h2 className="text-base font-semibold">{titulo}</h2>
      {desc && <p className="mb-4 mt-0.5 text-xs text-[var(--kv-texto-secundario)]">{desc}</p>}
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

function Text({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <Campo label={label}>
      <input className="dl-field" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </Campo>
  );
}

function Area({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Campo label={label}>
      <textarea rows={3} className="dl-field resize-none" value={value} onChange={(e) => onChange(e.target.value)} />
    </Campo>
  );
}

function Num({
  label,
  value,
  onChange,
  min,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
}) {
  return (
    <Campo label={label}>
      <input
        type="number"
        min={min}
        className="dl-field"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </Campo>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (v: string) => void;
}) {
  return (
    <Campo label={label}>
      <select className="dl-field" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </Campo>
  );
}

function Color({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Campo label={label}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-11 w-12 shrink-0 cursor-pointer rounded-[var(--r-sm)] border border-[var(--borda)] bg-transparent p-1"
          aria-label={label}
        />
        <input className="dl-field font-[family-name:var(--kv-font-mono)]" value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    </Campo>
  );
}

function Toggle({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      disabled={disabled}
      onClick={() => onChange(!value)}
      className={`flex items-center justify-between gap-3 rounded-[var(--r-md)] border border-[var(--borda)] px-3.5 py-2.5 text-left text-sm transition-colors disabled:opacity-45 ${
        value ? "bg-[var(--kv-primaria-08)]" : "hover:bg-[var(--kv-texto)]/[0.03]"
      }`}
    >
      <span className="font-medium">{label}</span>
      <span
        className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${
          value ? "bg-[var(--kv-primaria)]" : "bg-[var(--borda-forte)]"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
            value ? "translate-x-[18px]" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
}
