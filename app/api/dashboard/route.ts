import { NextResponse } from "next/server";
import { resolveTenant } from "@/lib/config/loader";
import { getAdminClient } from "@/lib/supabase/admin";
import { isServiceRoleConfigured } from "@/lib/supabase/env";
import { getStaffContext, temPapel } from "@/lib/staff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Agregados do dashboard (RF-54→61). Admin-only. Computa em JS a partir dos
 * dados já capturados na F1 (sessões, mensagens, eventos de tracking) — sem
 * tabelas novas. Consultas limitadas para caber no timeout serverless.
 */
export async function GET(req: Request) {
  if (!isServiceRoleConfigured) {
    return NextResponse.json({ erro: "supabase_ausente" }, { status: 503 });
  }
  const slug = new URL(req.url).searchParams.get("slug") ?? "";
  const tenant = await resolveTenant(slug);
  if (!tenant?.liveId) {
    return NextResponse.json({ erro: "live_inexistente" }, { status: 404 });
  }
  const ctx = await getStaffContext(tenant.liveId);
  if (!ctx || !temPapel(ctx, "admin")) {
    return NextResponse.json({ erro: "nao_autorizado" }, { status: 403 });
  }

  const liveId = tenant.liveId;
  const admin = getAdminClient();
  const agora = Date.now();

  // --- Buscas (limitadas) ---
  const [sessRes, partRes, msgsRes, hbRes, intRes] = await Promise.all([
    admin
      .from("sessoes")
      .select(
        "id, participante_id, entrou_em, saiu_em, ultimo_heartbeat, encerrada, tempo_online_seg, percentual_concluido, dispositivo"
      )
      .eq("live_id", liveId)
      .limit(5000),
    admin
      .from("participantes")
      .select("id, email, nome, papel, banido")
      .eq("live_id", liveId)
      .limit(5000),
    admin
      .from("mensagens_chat")
      .select("participante_id, created_at, apagada")
      .eq("live_id", liveId)
      .limit(20000),
    admin
      .from("eventos_tracking")
      .select("video_time")
      .eq("live_id", liveId)
      .eq("tipo", "heartbeat")
      .not("video_time", "is", null)
      .limit(50000),
    admin
      .from("eventos_tracking")
      .select("sessao_id, tipo")
      .eq("live_id", liveId)
      .in("tipo", ["reaction", "cta_click"])
      .limit(50000),
  ]);

  const sessoes = sessRes.data ?? [];
  const participantes = partRes.data ?? [];
  const mensagens = (msgsRes.data ?? []).filter((m) => !m.apagada);
  const heartbeats = hbRes.data ?? [];
  const interacoesEvt = intRes.data ?? [];

  // Sinaliza truncamento (lives muito grandes) — evita métrica silenciosamente
  // incompleta (M2). Para escala real, migrar agregação p/ RPCs no banco.
  const truncado =
    sessoes.length >= 5000 ||
    participantes.length >= 5000 ||
    (msgsRes.data?.length ?? 0) >= 20000 ||
    heartbeats.length >= 50000 ||
    interacoesEvt.length >= 50000;

  // --- KPIs ---
  const totalMensagens = mensagens.length;
  const msgsMin = mensagens.filter(
    (m) => agora - new Date(m.created_at).getTime() <= 60_000
  ).length;
  // Usuários ÚNICOS ao vivo (dedup por participante; 2 abas = 1 usuário).
  const ativos = sessoes.filter(
    (s) =>
      !s.encerrada &&
      s.ultimo_heartbeat &&
      agora - new Date(s.ultimo_heartbeat).getTime() <= 60_000
  );
  const onlineAgora = new Set(
    ativos.map((s) => s.participante_id).filter(Boolean)
  ).size;
  const participantesUnicos = participantes.filter((p) => !p.banido).length;
  const tempos = sessoes.map((s) => s.tempo_online_seg ?? 0).filter((n) => n > 0);
  const tempoMedio = tempos.length
    ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length)
    : 0;
  const concl = sessoes.map((s) => s.percentual_concluido ?? 0);
  const conclusaoMedia = concl.length
    ? Math.round(concl.reduce((a, b) => a + b, 0) / concl.length)
    : 0;

  // --- Curva de audiência (concorrência por bucket) ---
  const intervalos = sessoes
    .map((s) => {
      const ini = s.entrou_em ? new Date(s.entrou_em).getTime() : null;
      const fim = s.saiu_em
        ? new Date(s.saiu_em).getTime()
        : s.ultimo_heartbeat
          ? new Date(s.ultimo_heartbeat).getTime()
          : ini;
      return ini ? { ini, fim: Math.max(fim ?? ini, ini) } : null;
    })
    .filter(Boolean) as { ini: number; fim: number }[];

  const curva: { t: string; online: number }[] = [];
  let pico = 0;
  if (intervalos.length) {
    const min = Math.min(...intervalos.map((i) => i.ini));
    const max = Math.max(...intervalos.map((i) => i.fim));
    const spanMin = Math.max(1, Math.ceil((max - min) / 60_000));
    const passos = Math.min(120, spanMin);
    const bucketMs = Math.ceil((max - min) / passos) || 60_000;
    for (let t = min; t <= max; t += bucketMs) {
      const online = intervalos.filter((i) => i.ini <= t && i.fim >= t).length;
      pico = Math.max(pico, online);
      curva.push({ t: new Date(t).toISOString(), online });
    }
  }

  // --- Retenção por marco ---
  const marcos = tenant.config.tracking.milestones_percentuais;
  const totalSess = sessoes.length || 1;
  const retencao = marcos.map((marco) => {
    const qtd = concl.filter((p) => p >= marco).length;
    return { marco, qtd, pct: Math.round((qtd / totalSess) * 100) };
  });

  // --- Trechos consumidos (histograma de posição por heartbeat) ---
  const tempos_video = heartbeats
    .map((h) => Number(h.video_time))
    .filter((n) => Number.isFinite(n) && n >= 0);
  const trechos: { seg: number; hits: number }[] = [];
  if (tempos_video.length) {
    const maxT = Math.max(...tempos_video);
    const gran = Math.max(
      tenant.config.tracking.granularidade_trecho_seg,
      Math.ceil(maxT / 120) || 1
    );
    const bins = Math.max(1, Math.ceil(maxT / gran));
    const arr = new Array(bins).fill(0);
    for (const t of tempos_video) {
      const i = Math.min(bins - 1, Math.floor(t / gran));
      arr[i] += 1;
    }
    arr.forEach((hits, i) => trechos.push({ seg: i * gran, hits }));
  }

  // --- Tabela de participantes ---
  const msgPorPart = new Map<string, number>();
  for (const m of mensagens) {
    if (m.participante_id)
      msgPorPart.set(m.participante_id, (msgPorPart.get(m.participante_id) ?? 0) + 1);
  }
  const sessPorId = new Map(sessoes.map((s) => [s.id, s.participante_id]));
  const evtPorPart = new Map<string, number>();
  for (const e of interacoesEvt) {
    const pid = sessPorId.get(e.sessao_id);
    if (pid) evtPorPart.set(pid, (evtPorPart.get(pid) ?? 0) + 1);
  }
  // Melhor sessão por participante (maior tempo online).
  const sessPorPart = new Map<string, (typeof sessoes)[number]>();
  for (const s of sessoes) {
    if (!s.participante_id) continue;
    const atual = sessPorPart.get(s.participante_id);
    if (!atual || (s.tempo_online_seg ?? 0) > (atual.tempo_online_seg ?? 0))
      sessPorPart.set(s.participante_id, s);
  }
  const tabela = participantes.map((p) => {
    const s = sessPorPart.get(p.id);
    const interacoes = (msgPorPart.get(p.id) ?? 0) + (evtPorPart.get(p.id) ?? 0);
    return {
      email: p.email,
      nome: p.nome ?? "",
      papel: p.papel,
      banido: p.banido,
      tempo_online_seg: s?.tempo_online_seg ?? 0,
      percentual: s?.percentual_concluido ?? 0,
      dispositivo: s?.dispositivo ?? "",
      interacoes,
    };
  });
  tabela.sort((a, b) => b.tempo_online_seg - a.tempo_online_seg);

  return NextResponse.json({
    kpis: {
      participantes_unicos: participantesUnicos,
      online_agora: onlineAgora,
      pico,
      tempo_medio_seg: tempoMedio,
      conclusao_media: conclusaoMedia,
      total_mensagens: totalMensagens,
      msgs_min: msgsMin,
    },
    curva,
    retencao,
    trechos,
    participantes: tabela,
    status: tenant.status,
    truncado,
  });
}
