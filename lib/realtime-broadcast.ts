import "server-only";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "./supabase/env";

/**
 * Envia um evento de broadcast do Realtime pela API REST (sem manter socket),
 * adequado a funções serverless (RNF-13). Espectadores/staff assinam o canal
 * `topic` no browser e recebem o evento.
 *
 * Usado no chat (novas mensagens + moderação) para NÃO depender de leitura
 * direta da tabela pelo anon — isolando o chat por live (nada vaza entre
 * tenants) e garantindo que apagar/fixar cheguem a quem já está assistindo.
 */
export async function broadcast(
  topic: string,
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return;
  try {
    await fetch(`${SUPABASE_URL}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages: [{ topic, event, payload }] }),
      // Não bloqueia a resposta ao usuário além do necessário.
      keepalive: true,
    });
  } catch (e) {
    console.error("[broadcast] falha:", (e as Error)?.message);
  }
}
