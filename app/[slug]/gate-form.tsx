"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { ClienteConfig } from "@/lib/config/schema";
import { formatarCPF, cpfValido } from "@/lib/cpf";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function GateForm({
  slug,
  config,
  compacto = false,
}: {
  slug: string;
  config: ClienteConfig;
  /** No layout de herói, o título/boas-vindas já aparecem fora do card. */
  compacto?: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [extras, setExtras] = useState<Record<string, string>>({});
  const [lgpd, setLgpd] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  const camposExtras = config.acesso.campos_extras;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);

    const emailNorm = email.trim().toLowerCase();
    if (!EMAIL_RE.test(emailNorm)) {
      setErro("Informe um email válido.");
      return;
    }
    if (!senha) {
      setErro("Informe a senha de acesso.");
      return;
    }
    for (const campo of camposExtras) {
      const val = extras[campo.id]?.trim();
      if (campo.obrigatorio && !val) {
        setErro(`Preencha o campo "${campo.label}".`);
        return;
      }
      if (campo.tipo === "cpf" && val && !cpfValido(val)) {
        setErro("CPF inválido. Confira os números.");
        return;
      }
    }
    if (!lgpd) {
      setErro("É necessário aceitar o consentimento para continuar.");
      return;
    }

    setCarregando(true);
    try {
      const res = await fetch("/api/gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, email: emailNorm, senha, extras, lgpd }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 503)
          setErro("Serviço indisponível: banco de dados não configurado. (dev)");
        else if (data?.erro === "senha") setErro(config.textos.erro_senha);
        else if (data?.erro === "banido")
          setErro("Seu acesso a esta transmissão foi bloqueado.");
        else if (data?.erro === "encerrada") setErro(config.textos.encerrada);
        else if (data?.erro === "rate_limit")
          setErro("Muitas tentativas. Aguarde um instante e tente novamente.");
        else if (data?.erro === "cpf") setErro("CPF inválido. Confira os números.");
        else if (data?.erro === "campo_obrigatorio")
          setErro("Preencha todos os campos obrigatórios.");
        else setErro("Não foi possível entrar. Tente novamente.");
        return;
      }
      router.push(`/${slug}/sala`);
    } catch {
      setErro("Falha de conexão. Verifique sua internet e tente novamente.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="dl-glass rounded-[var(--r-lg)] p-6 sm:p-7" noValidate>
      {compacto ? (
        <h2 className="mb-5 text-base font-semibold">Faça login para entrar</h2>
      ) : (
        <>
          <h2 className="text-lg font-semibold">{config.textos.titulo_entrada}</h2>
          <p className="mb-5 mt-1 text-sm text-[var(--kv-texto-secundario)]">
            {config.textos.boas_vindas}
          </p>
        </>
      )}

      <div className="flex flex-col gap-4">
        <Campo
          id="email"
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={setEmail}
          placeholder="voce@empresa.com"
        />
        <Campo
          id="senha"
          label="Senha de acesso"
          type="password"
          autoComplete="off"
          value={senha}
          onChange={setSenha}
          placeholder="Senha do evento"
        />

        {camposExtras.map((campo) => {
          const cpf = campo.tipo === "cpf";
          return (
            <Campo
              key={campo.id}
              id={campo.id}
              label={campo.label + (campo.obrigatorio ? "" : " (opcional)")}
              type={campo.tipo === "email" ? "email" : "text"}
              inputMode={cpf || campo.tipo === "tel" ? "numeric" : undefined}
              placeholder={cpf ? "000.000.000-00" : undefined}
              value={extras[campo.id] ?? ""}
              onChange={(v) =>
                setExtras((p) => ({
                  ...p,
                  [campo.id]: cpf ? formatarCPF(v) : v,
                }))
              }
            />
          );
        })}

        <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed text-[var(--kv-texto-secundario)]">
          <input
            type="checkbox"
            checked={lgpd}
            onChange={(e) => setLgpd(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--kv-primaria)]"
          />
          <span>
            {config.acesso.consentimento_lgpd_texto}{" "}
            {config.acesso.link_politica_privacidade && (
              <a
                href={config.acesso.link_politica_privacidade}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--kv-texto)] underline underline-offset-2"
              >
                Política de Privacidade
              </a>
            )}
          </span>
        </label>

        {erro && (
          <p
            role="alert"
            className="dl-anim-in rounded-[var(--r-sm)] border border-[color-mix(in_srgb,var(--kv-erro)_40%,transparent)] bg-[color-mix(in_srgb,var(--kv-erro)_12%,transparent)] px-3 py-2.5 text-sm text-[var(--kv-erro)]"
          >
            {erro}
          </p>
        )}

        <button type="submit" disabled={carregando} className="dl-btn dl-btn-primary mt-1 w-full">
          {carregando ? (
            <>
              <Spinner /> Entrando…
            </>
          ) : (
            "Entrar na transmissão"
          )}
        </button>
      </div>
    </form>
  );
}

function Campo({
  id,
  label,
  value,
  onChange,
  ...rest
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "id" | "value" | "onChange">) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input id={id} value={value} onChange={(e) => onChange(e.target.value)} className="dl-field" {...rest} />
    </div>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-90" fill="currentColor" d="M12 2a10 10 0 0 1 10 10h-3a7 7 0 0 0-7-7V2z" />
    </svg>
  );
}
