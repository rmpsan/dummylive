import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveTenant } from "@/lib/config/loader";
import { getAdminClient } from "@/lib/supabase/admin";
import { isServiceRoleConfigured } from "@/lib/supabase/env";
import { getStaffContext, temPapel, type PapelStaff } from "@/lib/staff";
import { sanitizeMessage } from "@/lib/chat";
import { safeParseClienteConfig } from "@/lib/config/schema";
import { broadcast } from "@/lib/realtime-broadcast";
import { topicoChat, topicoOverlay } from "@/lib/channel";
import { resolverVideo } from "@/lib/video";
import { contarOnline } from "@/lib/online";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  slug: z.string().min(1),
  acao: z.enum([
    "apagar_msg",
    "fixar_msg",
    "mutar",
    "banir",
    "mensagem_oficial",
    "status",
    "promover",
    "salvar_config",
    "metricas_desde",
    "transmitir_cg",
    "limpar_cg",
  ]),
  mensagemId: z.number().int().optional(),
  mensagemIds: z.array(z.number().int()).max(50).optional(),
  participanteId: z.string().uuid().optional(),
  fixar: z.boolean().optional(),
  minutos: z.number().int().nullable().optional(),
  banir: z.boolean().optional(),
  texto: z.string().optional(),
  status: z.enum(["aguardando", "ao_vivo", "encerrada"]).optional(),
  email: z.string().email().optional(),
  papel: z.enum(["moderador", "admin"]).optional(),
  senha: z.string().min(6).optional(),
  // metricas_desde: ISO 8601, ou null/"" para limpar
  metricas_desde: z.string().nullable().optional(),
  // salvar_config
  config: z.unknown().optional(),
  senha_espectador: z.string().optional(),
  cliente_nome: z.string().optional(),
  job_nome: z.string().optional(),
  job_codigo: z.string().optional(),
});

const PERMANENTE = "9999-12-31T00:00:00Z";

/**
 * Lista participantes da live para o painel de moderação (RF-36).
 * GET /api/mod?slug=<slug> — só staff autenticado da live.
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
  if (!ctx) {
    return NextResponse.json({ erro: "nao_autorizado" }, { status: 403 });
  }

  const admin = getAdminClient();
  const { data } = await admin
    .from("participantes")
    .select("id, email, nome, papel, banido, silenciado_ate, created_at")
    .eq("live_id", tenant.liveId)
    .order("created_at", { ascending: false })
    .limit(500);

  const online = await contarOnline(admin, tenant.liveId);
  return NextResponse.json({ participantes: data ?? [], online });
}

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

  const tenant = await resolveTenant(body.slug);
  if (!tenant?.liveId) {
    return NextResponse.json({ erro: "live_inexistente" }, { status: 404 });
  }
  const liveId = tenant.liveId;

  const ctx = await getStaffContext(liveId);
  if (!ctx) {
    return NextResponse.json({ erro: "nao_autorizado" }, { status: 403 });
  }

  // Ações que exigem admin.
  const exigeAdmin = new Set([
    "status",
    "promover",
    "salvar_config",
    "metricas_desde",
  ]);
  const minimo: PapelStaff = exigeAdmin.has(body.acao) ? "admin" : "moderador";
  if (!temPapel(ctx, minimo)) {
    return NextResponse.json({ erro: "papel_insuficiente" }, { status: 403 });
  }

  const admin = getAdminClient();

  async function log(acao: string, alvo: string | null, detalhe: object = {}) {
    await admin.from("log_moderacao").insert({
      live_id: liveId,
      staff_email: ctx!.email,
      acao,
      alvo,
      detalhe,
    });
  }

  switch (body.acao) {
    // ----- Apagar mensagem (soft-delete, RF-31) -----
    case "apagar_msg": {
      if (!body.mensagemId)
        return NextResponse.json({ erro: "faltou_id" }, { status: 400 });
      const { error } = await admin
        .from("mensagens_chat")
        .update({ apagada: true })
        .eq("id", body.mensagemId)
        .eq("live_id", liveId);
      if (error) return NextResponse.json({ erro: "interno" }, { status: 500 });
      await log("apagar_msg", String(body.mensagemId));
      await broadcast(topicoChat(liveId), "mod", {
        tipo: "apagar",
        id: body.mensagemId,
      });
      return NextResponse.json({ ok: true });
    }

    // ----- Fixar / desafixar (RF-34) -----
    case "fixar_msg": {
      if (!body.mensagemId)
        return NextResponse.json({ erro: "faltou_id" }, { status: 400 });
      const { error } = await admin
        .from("mensagens_chat")
        .update({ fixada: body.fixar ?? true })
        .eq("id", body.mensagemId)
        .eq("live_id", liveId);
      if (error) return NextResponse.json({ erro: "interno" }, { status: 500 });
      await log(body.fixar === false ? "desafixar_msg" : "fixar_msg", String(body.mensagemId));
      await broadcast(topicoChat(liveId), "mod", {
        tipo: "fixar",
        id: body.mensagemId,
        fixar: body.fixar ?? true,
      });
      return NextResponse.json({ ok: true });
    }

    // ----- Silenciar / dessilenciar (RF-32) -----
    case "mutar": {
      if (!body.participanteId)
        return NextResponse.json({ erro: "faltou_id" }, { status: 400 });
      // minutos null = permanente; 0 = remover silêncio; N = por N minutos.
      let ate: string | null;
      if (body.minutos === 0) ate = null;
      else if (body.minutos == null) ate = PERMANENTE;
      else ate = new Date(Date.now() + body.minutos * 60_000).toISOString();

      const { error } = await admin
        .from("participantes")
        .update({ silenciado_ate: ate })
        .eq("id", body.participanteId)
        .eq("live_id", liveId);
      if (error) return NextResponse.json({ erro: "interno" }, { status: 500 });
      await log(ate ? "silenciar" : "dessilenciar", body.participanteId, {
        minutos: body.minutos ?? "permanente",
      });
      return NextResponse.json({ ok: true });
    }

    // ----- Banir / desbanir (RF-33) -----
    case "banir": {
      if (!body.participanteId)
        return NextResponse.json({ erro: "faltou_id" }, { status: 400 });
      const banir = body.banir ?? true;
      const { error } = await admin
        .from("participantes")
        .update({ banido: banir })
        .eq("id", body.participanteId)
        .eq("live_id", liveId);
      if (error) return NextResponse.json({ erro: "interno" }, { status: 500 });
      await log(banir ? "banir" : "desbanir", body.participanteId);
      return NextResponse.json({ ok: true });
    }

    // ----- Mensagem oficial (RF-35) -----
    case "mensagem_oficial": {
      const san = sanitizeMessage(body.texto ?? "", {
        maxLen: tenant.config.features.limite_caracteres_msg,
        palavrasProibidas: [],
      });
      if (!san.ok || !san.texto)
        return NextResponse.json({ erro: "texto_invalido" }, { status: 400 });
      const autor = ctx.email.split("@")[0] || "Equipe";
      const { data: msg, error } = await admin
        .from("mensagens_chat")
        .insert({
          live_id: liveId,
          participante_id: null,
          autor_nome: autor,
          texto: san.texto,
          is_staff: true,
        })
        .select("id, autor_nome, texto, is_staff, fixada, apagada, created_at")
        .single();
      if (error) return NextResponse.json({ erro: "interno" }, { status: 500 });
      await log("mensagem_oficial", String(msg.id));
      await broadcast(topicoChat(liveId), "msg", { mensagem: msg });
      return NextResponse.json({ ok: true, mensagem: msg });
    }

    // ----- Mudar status da live (RF-59, admin) -----
    case "status": {
      if (!body.status)
        return NextResponse.json({ erro: "faltou_status" }, { status: 400 });
      const { error } = await admin
        .from("lives")
        .update({ status: body.status })
        .eq("id", liveId);
      if (error) return NextResponse.json({ erro: "interno" }, { status: 500 });
      await log("status", null, { status: body.status });
      return NextResponse.json({ ok: true, status: body.status });
    }

    // ----- Definir início oficial dos dados (métricas) — admin -----
    case "metricas_desde": {
      const valor =
        body.metricas_desde && body.metricas_desde.trim()
          ? body.metricas_desde.trim()
          : undefined;
      // Grava no config_json (fonte da verdade da config visual/comportamental).
      const cfg = {
        ...tenant.config,
        evento: { ...tenant.config.evento, metricas_desde: valor },
      };
      const { error } = await admin
        .from("lives")
        .update({ config_json: cfg })
        .eq("id", liveId);
      if (error) {
        console.error("[mod] metricas_desde:", error.message);
        return NextResponse.json({ erro: "interno" }, { status: 500 });
      }
      await log("metricas_desde", null, { metricas_desde: valor ?? null });
      return NextResponse.json({ ok: true, metricas_desde: valor ?? null });
    }

    // ----- Curadoria → transmite mensagens para o overlay (CG do vMix) -----
    case "transmitir_cg": {
      const ids = (body.mensagemIds ?? []).filter((n) => Number.isInteger(n));
      if (!ids.length)
        return NextResponse.json({ erro: "faltou_ids" }, { status: 400 });
      const { data: msgs, error } = await admin
        .from("mensagens_chat")
        .select("id, autor_nome, texto, apagada")
        .eq("live_id", liveId)
        .in("id", ids);
      if (error) return NextResponse.json({ erro: "interno" }, { status: 500 });
      // Preserva a ordem em que o operador selecionou.
      const porId = new Map(
        (msgs ?? [])
          .filter((m) => !m.apagada)
          .map((m) => [m.id, { id: m.id, autor: m.autor_nome ?? "Participante", texto: m.texto }])
      );
      const mensagens = ids
        .map((id) => porId.get(id))
        .filter((m): m is { id: number; autor: string; texto: string } => Boolean(m));
      if (!mensagens.length)
        return NextResponse.json({ erro: "nenhuma_valida" }, { status: 400 });

      // 1) Overlay em tempo real (browser source do vMix).
      await broadcast(topicoOverlay(liveId), "cg", { mensagens });

      // 2) Persiste no config_json.cg → data source JSON/XML do vMix.
      const anteriores = tenant.config.cg?.mensagens ?? [];
      const novas = mensagens.map((m) => ({ id: m.id, nome: m.autor, mensagem: m.texto }));
      // Evita duplicar ids já na fila; mantém as últimas 60.
      const idsNovos = new Set(novas.map((n) => n.id));
      const combinado = [...anteriores.filter((a) => !idsNovos.has(a.id)), ...novas].slice(-60);
      const cfg = {
        ...tenant.config,
        cg: { atualizado: new Date().toISOString(), mensagens: combinado },
      };
      await admin.from("lives").update({ config_json: cfg }).eq("id", liveId);

      await log("transmitir_cg", null, { total: mensagens.length });
      return NextResponse.json({ ok: true, total: mensagens.length });
    }

    // ----- Limpa a fila do overlay/data source (staff/moderador) -----
    case "limpar_cg": {
      await broadcast(topicoOverlay(liveId), "cg_clear", {});
      const cfg = {
        ...tenant.config,
        cg: { atualizado: new Date().toISOString(), mensagens: [] },
      };
      const { error } = await admin
        .from("lives")
        .update({ config_json: cfg })
        .eq("id", liveId);
      if (error) return NextResponse.json({ erro: "interno" }, { status: 500 });
      await log("limpar_cg", null, {});
      return NextResponse.json({ ok: true });
    }

    // ----- Promover staff (RF-50, admin) -----
    case "promover": {
      if (!body.email || !body.papel)
        return NextResponse.json({ erro: "faltou_dados" }, { status: 400 });
      const email = body.email.toLowerCase();

      // Cria o acesso de Auth se uma senha foi fornecida (opcional).
      let senhaGerada: string | null = null;
      if (body.senha) {
        const { error: authErr } = await admin.auth.admin.createUser({
          email,
          password: body.senha,
          email_confirm: true,
        });
        if (authErr && !/already/i.test(authErr.message)) {
          return NextResponse.json(
            { erro: "auth", detalhe: authErr.message },
            { status: 400 }
          );
        }
        senhaGerada = body.senha;
      }

      const { error } = await admin.from("staff").upsert(
        { live_id: liveId, email, papel: body.papel },
        { onConflict: "live_id,email" }
      );
      if (error) return NextResponse.json({ erro: "interno" }, { status: 500 });
      await log("promover", email, { papel: body.papel });
      return NextResponse.json({ ok: true, senha_definida: Boolean(senhaGerada) });
    }

    // ----- Salvar configuração da live (RF-68 / administração do cliente) -----
    case "salvar_config": {
      const parsed = safeParseClienteConfig(body.config);
      if (!parsed.success) {
        return NextResponse.json(
          { erro: "config_invalida", issues: parsed.error.issues.slice(0, 8) },
          { status: 400 }
        );
      }
      const cfg = parsed.data;
      const v = resolverVideo(cfg.evento);
      const videoUrl = (cfg.evento.video_url || v.id || "").trim();

      // Colunas são a fonte da verdade (banco). Tenta com as colunas novas;
      // se ainda não existirem (pré-0004), reaplica só o subconjunto legado.
      const updateNovo = {
        config_json: cfg,
        nome: cfg.evento.nome,
        status: cfg.evento.status,
        video_fonte: v.fonte,
        video_url: videoUrl,
        vimeo_video_id: v.id || cfg.evento.vimeo_video_id || "",
      };
      let { error } = await admin.from("lives").update(updateNovo).eq("id", liveId);
      if (error && /column|schema cache|does not exist/i.test(error.message)) {
        ({ error } = await admin
          .from("lives")
          .update({
            config_json: cfg,
            nome: cfg.evento.nome,
            status: cfg.evento.status,
            vimeo_video_id: v.id || cfg.evento.vimeo_video_id || "",
          })
          .eq("id", liveId));
      }
      if (error) {
        console.error("[mod] salvar_config:", error.message);
        return NextResponse.json({ erro: "interno" }, { status: 500 });
      }

      // Vínculo Cliente → Job (upsert por nome). Silencioso se pré-0004.
      if (body.cliente_nome?.trim()) {
        try {
          const { data: cli } = await admin
            .from("clientes")
            .upsert({ nome: body.cliente_nome.trim() }, { onConflict: "nome" })
            .select("id")
            .single();
          let jobId: string | null = null;
          if (cli && body.job_nome?.trim()) {
            const { data: job } = await admin
              .from("jobs")
              .upsert(
                {
                  cliente_id: cli.id,
                  nome: body.job_nome.trim(),
                  codigo: body.job_codigo?.trim() || null,
                },
                { onConflict: "cliente_id,nome" }
              )
              .select("id")
              .single();
            jobId = job?.id ?? null;
          }
          await admin
            .from("lives")
            .update({ cliente_id: cli?.id ?? null, job_id: jobId })
            .eq("id", liveId);
        } catch (e) {
          console.error("[mod] vínculo cliente/job:", (e as Error)?.message);
        }
      }
      // Atualiza a senha única só se uma nova foi informada.
      if (body.senha_espectador && body.senha_espectador.trim()) {
        await admin.rpc("definir_senha_unica", {
          p_live_id: liveId,
          p_senha: body.senha_espectador.trim(),
        });
      }
      await log("salvar_config", null, { status: cfg.evento.status });
      return NextResponse.json({ ok: true });
    }
  }
}
