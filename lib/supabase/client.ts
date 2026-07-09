"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY, isSupabaseConfigured } from "./env";

/**
 * Client de browser (chave anon). O espectador conecta DIRETO ao Supabase
 * para o Realtime do chat + contador online (RNF-11) — nunca via socket na
 * função da Vercel.
 *
 * Escrita de dados sensíveis (mensagens, tracking) NÃO passa por aqui: vai
 * por Route Handlers no servidor, que validam e usam service role.
 */
let cached: SupabaseClient | null = null;

export function getBrowserClient(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!cached) {
    cached = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      realtime: { params: { eventsPerSecond: 10 } },
    });
  }
  return cached;
}

export { isSupabaseConfigured };
