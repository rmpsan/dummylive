import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveTenant } from "@/lib/config/loader";
import { getAdminClient } from "@/lib/supabase/admin";
import { isServiceRoleConfigured } from "@/lib/supabase/env";
import { getViewerSession } from "@/lib/session";
import { getStaffContext } from "@/lib/staff";
import { sanitizeMessage } from "@/lib/chat";
import { broadcast } from "@/lib/realtime-broadcast";
import { topicoChat } from "@/lib/channel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ texto: z.string().min(1).max(2000) });

/**
 * Histórico do chat, escopado por live e autorizado (A2). O anon não lê a
 * tabela direto: viewer usa o cookie de sessão; staff usa Supabase Auth.
 * Staff vê mensagens apagadas (para moderar); espectador não.
 */
export async function GET(req: Request) {
  if (!isServiceRoleConfigured) {
    return NextResponse.json({ mensagens: [] });
  }
  const slug = new URL(req.url).searchParams.get("slug") ?? "";
  const tenant = await resolveTenant(slug);
  if (!tenant?.liveId) {
    return NextResponse.json({ erro: "live_inexistente" }, { status: 404 });
  }

  const sess = await getViewerSession();
  const ehViewer = !!sess && sess.slug === slug && sess.liveId === tenant.liveId;
  const staff = ehViewer ? null : await getStaffContext(tenant.liveId);
  if (!ehViewer && !staff) {
    return NextResponse.json({ erro: "nao_autorizado" }, { status: 403 });
  }

  const admin = getAdminClient();
  let q = admin
    .from("mensagens_chat")
    .select("id, participante_id, autor_nome, texto, is_staff, fixada, apagada, created_at")
    .eq("live_id", tenant.liveId)
    .order("created_at", { ascending: true })
    .limit(100);
  if (!staff) q = q.eq("apagada", false); // espectador não vê apagadas
  const { data } = await q;
  return NextResponse.json({ mensagens: data ?? [] });
}

export async function POST(req: Request) {
  if (!isServiceRoleConfigured) {
    return NextResponse.json({ erro: "supabase_ausente" }, { status: 503 });
  }

  const sess = await getViewerSession();
  if (!sess) {
    return NextResponse.json({ erro: "nao_autenticado" }, { status: 401 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ erro: "payload" }, { status: 400 });
  }

  const tenant = await resolveTenant(sess.slug);
  if (!tenant || tenant.liveId !== sess.liveId) {
    return NextResponse.json({ erro: "live_inexistente" }, { status: 404 });
  }
  if (tenant.status === "encerrada") {
    return NextResponse.json({ erro: "encerrada" }, { status: 403 });
  }

  const { features } = tenant.config;
  if (!features.chat) {
    return NextResponse.json({ erro: "chat_desativado" }, { status: 403 });
  }

  const san = sanitizeMessage(body.texto, {
    maxLen: features.limite_caracteres_msg,
    palavrasProibidas: features.palavras_proibidas,
  });
  if (!san.ok || !san.texto) {
    return NextResponse.json({ erro: san.motivo ?? "invalido" }, { status: 400 });
  }

  const admin = getAdminClient();

  const { data: part, error: partErr } = await admin
    .from("participantes")
    .select("id, nome, email, papel, banido, silenciado_ate")
    .eq("id", sess.participanteId)
    .single();

  if (partErr || !part) {
    return NextResponse.json({ erro: "participante" }, { status: 404 });
  }
  if (part.banido) {
    return NextResponse.json({ erro: "banido" }, { status: 403 });
  }
  if (part.silenciado_ate && new Date(part.silenciado_ate) > new Date()) {
    return NextResponse.json({ erro: "silenciado" }, { status: 403 });
  }

  const janelaSeg = features.rate_limit_segundos;
  if (janelaSeg > 0) {
    const desde = new Date(Date.now() - janelaSeg * 1000).toISOString();
    const { count } = await admin
      .from("mensagens_chat")
      .select("id", { count: "exact", head: true })
      .eq("participante_id", part.id)
      .gte("created_at", desde);
    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { erro: "rate_limit" },
        { status: 429, headers: { "Retry-After": String(janelaSeg) } }
      );
    }
  }

  const autorNome =
    part.nome?.trim() || part.email.split("@")[0] || "Participante";
  const isStaff = part.papel === "moderador" || part.papel === "admin";

  const { data: msg, error: msgErr } = await admin
    .from("mensagens_chat")
    .insert({
      live_id: sess.liveId,
      participante_id: part.id,
      autor_nome: autorNome,
      texto: san.texto,
      is_staff: isStaff,
    })
    .select("id, participante_id, autor_nome, texto, is_staff, fixada, apagada, created_at")
    .single();

  if (msgErr || !msg) {
    console.error("[chat] erro inserindo mensagem:", msgErr?.message);
    return NextResponse.json({ erro: "interno" }, { status: 500 });
  }

  // Entrega a mensagem a todos por broadcast (canal não-adivinhável desta live).
  await broadcast(topicoChat(sess.liveId), "msg", { mensagem: msg });

  return NextResponse.json({ ok: true, mensagem: msg });
}
