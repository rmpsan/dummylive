"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase/client";

export function StaffLoginForm({ slug }: { slug: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setAviso(null);
    const supabase = getBrowserClient();
    if (!supabase) {
      setErro("Serviço indisponível.");
      return;
    }
    setCarregando(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: senha,
      });
      if (error) {
        setErro("Email ou senha inválidos.");
        return;
      }
      // Sincroniza a sessão nos cookies para o servidor e entra na moderação.
      router.push(`/${slug}/moderacao`);
      router.refresh();
    } catch {
      setErro("Falha de conexão.");
    } finally {
      setCarregando(false);
    }
  }

  async function resetSenha() {
    setErro(null);
    setAviso(null);
    const supabase = getBrowserClient();
    if (!supabase || !email.trim()) {
      setErro("Informe seu email para recuperar a senha.");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: `${window.location.origin}/${slug}/staff` }
    );
    if (error) setErro("Não foi possível enviar o email de recuperação.");
    else setAviso("Enviamos um link de recuperação para seu email.");
  }

  return (
    <form onSubmit={onSubmit} className="dl-glass w-full rounded-[var(--r-lg)] p-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="staff-email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="staff-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="dl-field"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="staff-senha" className="text-sm font-medium">
            Senha
          </label>
          <input
            id="staff-senha"
            type="password"
            autoComplete="current-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="dl-field"
          />
        </div>

        {erro && (
          <p role="alert" className="text-sm text-[var(--kv-erro)]">
            {erro}
          </p>
        )}
        {aviso && <p className="text-sm text-[var(--kv-sucesso)]">{aviso}</p>}

        <button type="submit" disabled={carregando} className="dl-btn dl-btn-primary w-full">
          {carregando ? "Entrando…" : "Entrar"}
        </button>
        <button
          type="button"
          onClick={resetSenha}
          className="text-xs text-[var(--kv-texto-secundario)] underline-offset-2 hover:underline"
        >
          Esqueci minha senha
        </button>
      </div>
    </form>
  );
}
