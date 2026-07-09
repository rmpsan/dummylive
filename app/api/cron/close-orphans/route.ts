import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { isServiceRoleConfigured } from "@/lib/supabase/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Vercel Cron (RNF-16): fecha sessões sem heartbeat há > 60s (RF-39) e
 * consolida o tempo online. Substitui um worker persistente.
 *
 * Protegido por CRON_SECRET (a Vercel envia Authorization: Bearer <secret>).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  // Em produção, exige o secret sempre (nunca deixa o endpoint aberto — M3).
  if (!secret && process.env.NODE_ENV === "production") {
    return NextResponse.json({ erro: "cron_secret_ausente" }, { status: 401 });
  }
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ erro: "nao_autorizado" }, { status: 401 });
    }
  }

  if (!isServiceRoleConfigured) {
    return NextResponse.json({ erro: "supabase_ausente" }, { status: 503 });
  }

  const admin = getAdminClient();
  const { data, error } = await admin.rpc("fechar_sessoes_orfas", {
    p_timeout_seg: 60,
  });
  if (error) {
    console.error("[cron] fechar_sessoes_orfas:", error.message);
    return NextResponse.json({ erro: "interno" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, sessoes_fechadas: data ?? 0 });
}
