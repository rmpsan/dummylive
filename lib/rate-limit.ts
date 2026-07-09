/**
 * Rate limiter em memória (best-effort) para endpoints sensíveis (RF-10).
 *
 * ATENÇÃO: funções serverless são efêmeras (RNF-13) — este contador não é
 * compartilhado entre instâncias e reinicia a frio. Serve como primeira
 * barreira anti-abuso. Para limites duros em escala, migrar para Postgres
 * (contagem por janela) ou Upstash/Redis. Documentado no README.
 */
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { ok: boolean; retryAfterMs: number } {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterMs: 0 };
  }
  if (b.count >= limit) {
    return { ok: false, retryAfterMs: b.resetAt - now };
  }
  b.count += 1;
  return { ok: true, retryAfterMs: 0 };
}

/** Extrai um IP razoável dos headers (Vercel/proxy). */
export function clientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "desconhecido"
  );
}
