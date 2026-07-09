import "server-only";
import crypto from "crypto";

/**
 * Token de canal Realtime por live (A1 da auditoria). Os canais de broadcast
 * (chat/reações) não são autorizados pelo RLS; para não depender do UUID da
 * live ser secreto, derivamos um token não-adivinhável a partir do segredo do
 * servidor. Só quem está autorizado naquela live recebe o token (renderizado
 * na página da sala/moderação) — logo não dá para assinar o canal de outra live.
 */
export function canalToken(liveId: string): string {
  const secret =
    process.env.GATE_COOKIE_SECRET || "dev-insecure-secret-change-me";
  return crypto
    .createHmac("sha256", secret)
    .update("canal:" + liveId)
    .digest("base64url")
    .slice(0, 22);
}

export const topicoChat = (liveId: string) => `chat:${canalToken(liveId)}`;
export const topicoReacoes = (liveId: string) =>
  `reactions:${canalToken(liveId)}`;
