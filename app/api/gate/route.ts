import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveTenant } from "@/lib/config/loader";
import { getAdminClient } from "@/lib/supabase/admin";
import { isServiceRoleConfigured } from "@/lib/supabase/env";
import { setViewerSession } from "@/lib/session";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { cpfValido } from "@/lib/cpf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  slug: z.string().min(1),
  email: z.string().email(),
  senha: z.string().min(1),
  extras: z.record(z.string()).default({}),
  lgpd: z.literal(true),
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  if (!isServiceRoleConfigured) {
    return NextResponse.json({ erro: "supabase_ausente" }, { status: 503 });
  }

  // RF-10: limite de tentativas por IP (10/min best-effort).
  const ip = clientIp(req.headers);
  const rl = checkRateLimit(`gate:${ip}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { erro: "rate_limit" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ erro: "payload" }, { status: 400 });
  }

  const email = body.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ erro: "email" }, { status: 400 });
  }

  const tenant = await resolveTenant(body.slug);
  if (!tenant || !tenant.liveId) {
    return NextResponse.json({ erro: "live_inexistente" }, { status: 404 });
  }
  if (tenant.status === "encerrada") {
    return NextResponse.json({ erro: "encerrada" }, { status: 403 });
  }

  // Valida campos extras exigidos pela config (obrigatórios + CPF) — RF-01/07.
  for (const campo of tenant.config.acesso.campos_extras) {
    const val = (body.extras[campo.id] ?? "").trim();
    if (campo.obrigatorio && !val) {
      return NextResponse.json(
        { erro: "campo_obrigatorio", campo: campo.id },
        { status: 400 }
      );
    }
    if (campo.tipo === "cpf" && val && !cpfValido(val)) {
      return NextResponse.json({ erro: "cpf" }, { status: 400 });
    }
  }

  const admin = getAdminClient();

  // Valida a senha única sem trafegar o hash (RPC no banco).
  const { data: senhaOk, error: senhaErr } = await admin.rpc(
    "verificar_senha_unica",
    { p_live_id: tenant.liveId, p_senha: body.senha }
  );
  if (senhaErr) {
    console.error("[gate] erro verificando senha:", senhaErr.message);
    return NextResponse.json({ erro: "interno" }, { status: 500 });
  }
  if (!senhaOk) {
    return NextResponse.json({ erro: "senha" }, { status: 401 });
  }

  // Registra/recupera participante (RF-03). Nome vem dos campos extras se houver.
  const nome = body.extras["nome"]?.trim() || null;
  const { data: participante, error: partErr } = await admin
    .from("participantes")
    .upsert(
      {
        live_id: tenant.liveId,
        email,
        nome,
        campos_extras: body.extras,
      },
      { onConflict: "live_id,email" }
    )
    .select("id, banido")
    .single();

  if (partErr || !participante) {
    console.error("[gate] erro upsert participante:", partErr?.message);
    return NextResponse.json({ erro: "interno" }, { status: 500 });
  }
  if (participante.banido) {
    return NextResponse.json({ erro: "banido" }, { status: 403 });
  }

  // Cria a sessão de presença (RF-38). Metadados de device chegam via
  // o evento session_start (/api/track) quando a sala monta.
  const { data: sessao, error: sessErr } = await admin
    .from("sessoes")
    .insert({ participante_id: participante.id, live_id: tenant.liveId })
    .select("id")
    .single();

  if (sessErr || !sessao) {
    console.error("[gate] erro criando sessão:", sessErr?.message);
    return NextResponse.json({ erro: "interno" }, { status: 500 });
  }

  await setViewerSession({
    slug: body.slug,
    liveId: tenant.liveId,
    participanteId: participante.id,
    sessaoId: sessao.id,
  });

  return NextResponse.json({ ok: true, sessaoId: sessao.id });
}
