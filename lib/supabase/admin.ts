import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  isServiceRoleConfigured,
} from "./env";

/**
 * Client com service role. Uso EXCLUSIVO em rotas de servidor (API Routes,
 * Edge Functions, Cron). Ignora RLS — nunca exponha ao browser (RNF-14).
 *
 * Usado para: validar senha única, criar participante/sessão, ingerir
 * tracking em batch, inserir mensagens de chat com validação, exportações.
 */
let cached: SupabaseClient | null = null;

export function getAdminClient(): SupabaseClient {
  if (!isServiceRoleConfigured) {
    throw new Error(
      "Supabase service role não configurado. Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  if (!cached) {
    cached = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}
