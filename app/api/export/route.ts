import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { resolveTenant } from "@/lib/config/loader";
import { getAdminClient } from "@/lib/supabase/admin";
import { isServiceRoleConfigured } from "@/lib/supabase/env";
import { getStaffContext, temPapel } from "@/lib/staff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Exportação da tabela de participantes (RF-58): CSV (abre no Excel) ou XLSX.
 * Admin-only. GET /api/export?slug=<slug>&formato=csv|xlsx
 */
export async function GET(req: Request) {
  if (!isServiceRoleConfigured) {
    return NextResponse.json({ erro: "supabase_ausente" }, { status: 503 });
  }
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug") ?? "";
  const formato = url.searchParams.get("formato") === "xlsx" ? "xlsx" : "csv";

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

  const [partRes, sessRes, msgsRes, intRes] = await Promise.all([
    admin
      .from("participantes")
      .select("id, email, nome, papel, banido, campos_extras")
      .eq("live_id", liveId)
      .limit(20000),
    admin
      .from("sessoes")
      .select("id, participante_id, tempo_online_seg, tempo_video_assistido_seg, percentual_concluido, dispositivo, sistema_operacional, navegador, entrou_em, saiu_em")
      .eq("live_id", liveId)
      .limit(20000),
    admin
      .from("mensagens_chat")
      .select("participante_id, apagada")
      .eq("live_id", liveId)
      .limit(50000),
    admin
      .from("eventos_tracking")
      .select("sessao_id, tipo")
      .eq("live_id", liveId)
      .in("tipo", ["reaction", "cta_click"])
      .limit(50000),
  ]);

  const participantes = partRes.data ?? [];
  const sessoes = sessRes.data ?? [];
  const mensagens = (msgsRes.data ?? []).filter((m) => !m.apagada);

  const msgPorPart = new Map<string, number>();
  for (const m of mensagens)
    if (m.participante_id)
      msgPorPart.set(m.participante_id, (msgPorPart.get(m.participante_id) ?? 0) + 1);
  const sessPorId = new Map(sessoes.map((s) => [s.id, s.participante_id]));
  const evtPorPart = new Map<string, number>();
  for (const e of intRes.data ?? []) {
    const pid = sessPorId.get(e.sessao_id);
    if (pid) evtPorPart.set(pid, (evtPorPart.get(pid) ?? 0) + 1);
  }
  const sessPorPart = new Map<string, (typeof sessoes)[number]>();
  for (const s of sessoes) {
    if (!s.participante_id) continue;
    const atual = sessPorPart.get(s.participante_id);
    if (!atual || (s.tempo_online_seg ?? 0) > (atual.tempo_online_seg ?? 0))
      sessPorPart.set(s.participante_id, s);
  }

  const rows = participantes.map((p) => {
    const s = sessPorPart.get(p.id);
    return {
      email: p.email,
      nome: p.nome ?? "",
      papel: p.papel,
      banido: p.banido ? "sim" : "não",
      tempo_online_seg: s?.tempo_online_seg ?? 0,
      tempo_video_seg: s?.tempo_video_assistido_seg ?? 0,
      percentual_assistido: s?.percentual_concluido ?? 0,
      interacoes: (msgPorPart.get(p.id) ?? 0) + (evtPorPart.get(p.id) ?? 0),
      dispositivo: s?.dispositivo ?? "",
      sistema: s?.sistema_operacional ?? "",
      navegador: s?.navegador ?? "",
      entrou_em: s?.entrou_em ?? "",
      saiu_em: s?.saiu_em ?? "",
    };
  });

  const base = `participantes-${slug}`;

  if (formato === "xlsx") {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Participantes");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    return new NextResponse(buf, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${base}.xlsx"`,
      },
    });
  }

  // CSV com BOM (acentos corretos no Excel).
  const cols = Object.keys(
    rows[0] ?? {
      email: "",
      nome: "",
      papel: "",
      banido: "",
      tempo_online_seg: "",
      tempo_video_seg: "",
      percentual_assistido: "",
      interacoes: "",
      dispositivo: "",
      sistema: "",
      navegador: "",
      entrou_em: "",
      saiu_em: "",
    }
  );
  const esc = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv =
    "﻿" +
    [cols.join(","), ...rows.map((r) => cols.map((c) => esc((r as Record<string, unknown>)[c])).join(","))].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${base}.csv"`,
    },
  });
}
