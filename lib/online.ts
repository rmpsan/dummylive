import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Janela (s) sem heartbeat que ainda conta como "online". Deve ser > 2x o
 * heartbeat (20s) para tolerar 1 batida perdida. */
export const ONLINE_JANELA_SEG = 60;

/**
 * Conta usuários ÚNICOS realmente ao vivo: sessões não encerradas com
 * heartbeat recente. Deduplica por participante (2 abas = 1 usuário).
 * Não conta staff (staff não cria sessão de participante).
 */
export async function contarOnline(
  admin: SupabaseClient,
  liveId: string
): Promise<number> {
  const desde = new Date(Date.now() - ONLINE_JANELA_SEG * 1000).toISOString();
  const { data, error } = await admin
    .from("sessoes")
    .select("participante_id")
    .eq("live_id", liveId)
    .eq("encerrada", false)
    .gte("ultimo_heartbeat", desde)
    .limit(20000);
  if (error || !data) return 0;
  const unicos = new Set<string>();
  for (const s of data) if (s.participante_id) unicos.add(s.participante_id);
  return unicos.size;
}
