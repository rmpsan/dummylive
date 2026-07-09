import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase/admin";
import { isServiceRoleConfigured } from "@/lib/supabase/env";
import { getViewerSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const eventoSchema = z.object({
  tipo: z.string().min(1),
  payload: z.record(z.unknown()).optional(),
  video_time: z.number().nullable().optional(),
  aba_visivel: z.boolean().nullable().optional(),
  ts: z.string().optional(),
});

const bodySchema = z.object({
  sessaoId: z.string().uuid(),
  liveId: z.string().uuid(),
  eventos: z.array(eventoSchema).min(1).max(200),
});

export async function POST(req: Request) {
  if (!isServiceRoleConfigured) {
    return NextResponse.json({ erro: "supabase_ausente" }, { status: 503 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ erro: "payload" }, { status: 400 });
  }

  // Só a própria sessão (cookie assinado) pode gravar seus eventos (RNF-05).
  const sess = await getViewerSession();
  if (!sess || sess.sessaoId !== body.sessaoId || sess.liveId !== body.liveId) {
    return NextResponse.json({ erro: "nao_autorizado" }, { status: 403 });
  }

  const admin = getAdminClient();

  // 1) Insere os eventos granulares (RF-46). Idempotência best-effort: o
  // insert é aditivo; retries duplicam pouco e não corrompem agregados.
  const rows = body.eventos.map((e) => ({
    sessao_id: body.sessaoId,
    live_id: body.liveId,
    tipo: e.tipo,
    payload: e.payload ?? {},
    video_time: e.video_time ?? null,
    aba_visivel: e.aba_visivel ?? null,
    ts: e.ts ?? new Date().toISOString(),
  }));

  const { error: insErr } = await admin.from("eventos_tracking").insert(rows);
  if (insErr) {
    console.error("[track] erro inserindo eventos:", insErr.message);
    // Não falha o beacon; devolve 200 para o cliente não reenfileirar loop.
  }

  // 2) Atualiza agregados de sessão a partir do batch.
  const patch: Record<string, unknown> = {};
  let sawHeartbeat = false;
  let sawStart = false;
  let ended = false;
  let maxPercent = 0;
  let watched = 0;

  for (const e of body.eventos) {
    const p = (e.payload ?? {}) as Record<string, unknown>;
    if (typeof p.max_percent === "number") {
      maxPercent = Math.max(maxPercent, p.max_percent);
    }
    if (typeof p.watched_seconds === "number") {
      watched = Math.max(watched, p.watched_seconds);
    }
    if (e.tipo === "heartbeat") sawHeartbeat = true;
    if (e.tipo === "session_start") sawStart = true;
    if (e.tipo === "session_start") {
      patch.dispositivo = p.dispositivo ?? null;
      patch.sistema_operacional = p.sistema_operacional ?? null;
      patch.navegador = p.navegador ?? null;
      patch.resolucao = p.resolucao ?? null;
      patch.timezone = p.timezone ?? null;
    }
    if (e.tipo === "video_milestone" && typeof p.percentual === "number") {
      maxPercent = Math.max(maxPercent, p.percentual);
    }
    if (e.tipo === "session_end") ended = true;
  }

  if (sawHeartbeat || ended) {
    patch.ultimo_heartbeat = new Date().toISOString();
  }
  // M1: espectador que recarregou reusa a sessão — se ela havia sido
  // encerrada (pagehide), reabrimos ao receber start/heartbeat sem end.
  if ((sawStart || sawHeartbeat) && !ended) {
    patch.encerrada = false;
    patch.saiu_em = null;
  }
  if (maxPercent > 0) patch.percentual_concluido = Math.round(maxPercent);
  if (watched > 0) patch.tempo_video_assistido_seg = Math.round(watched);

  if (ended) {
    patch.encerrada = true;
    patch.saiu_em = new Date().toISOString();
    // tempo_online a partir de entrou_em (fonte da verdade no servidor).
    const { data: s } = await admin
      .from("sessoes")
      .select("entrou_em")
      .eq("id", body.sessaoId)
      .single();
    if (s?.entrou_em) {
      const secs = Math.max(
        0,
        Math.round((Date.now() - new Date(s.entrou_em).getTime()) / 1000)
      );
      patch.tempo_online_seg = secs;
    }
  }

  if (Object.keys(patch).length > 0) {
    const { error: updErr } = await admin
      .from("sessoes")
      .update(patch)
      .eq("id", body.sessaoId);
    if (updErr) console.error("[track] erro atualizando sessão:", updErr.message);
  }

  return NextResponse.json({ ok: true });
}
