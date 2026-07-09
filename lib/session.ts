import "server-only";
import crypto from "crypto";
import { cookies } from "next/headers";

/**
 * Sessão do espectador (não-staff). Não usa Supabase Auth: guardamos um
 * cookie httpOnly assinado (HMAC) com os ids necessários. O servidor confia
 * no cookie só após validar a assinatura; toda ação sensível revalida no
 * banco. (Staff usa Supabase Auth — F2.)
 */
export interface ViewerSession {
  slug: string;
  liveId: string;
  participanteId: string;
  sessaoId: string;
}

const COOKIE_NAME = "dl_sess";
const MAX_AGE = 60 * 60 * 12; // 12h

function secret(): string {
  const s = process.env.GATE_COOKIE_SECRET;
  if (s && s.length >= 16) return s;
  // Em produção, NUNCA usar segredo fraco/padrão — cookies de sessão seriam
  // forjáveis. Falha dura para evitar footgun de deploy (auditoria C2).
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "GATE_COOKIE_SECRET ausente ou fraco em produção. Defina um valor forte (>= 32 chars)."
    );
  }
  return "dev-insecure-secret-change-me";
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

function encode(s: ViewerSession): string {
  const payload = Buffer.from(JSON.stringify(s)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decode(token: string): ViewerSession | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  // Comparação em tempo constante.
  if (
    sig.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  ) {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf-8"));
  } catch {
    return null;
  }
}

export async function setViewerSession(s: ViewerSession): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE_NAME, encode(s), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function getViewerSession(): Promise<ViewerSession | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  return token ? decode(token) : null;
}

export async function clearViewerSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}
