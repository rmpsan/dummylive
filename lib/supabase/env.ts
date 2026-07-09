/**
 * Presença de variáveis de ambiente do Supabase.
 *
 * Em dev local sem banco (sem Docker/Supabase), estas podem estar ausentes.
 * Neste caso a UI ainda renderiza (config vem de arquivo JSON local), mas os
 * fluxos que dependem do banco (gate, chat, tracking) retornam 503 claro em
 * vez de estourar. Ver README → "Rodando localmente".
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
export const isServiceRoleConfigured = Boolean(
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
);
