import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase/admin";
import { isServiceRoleConfigured } from "@/lib/supabase/env";
import { getSuperAdmin } from "@/lib/super";
import { parseClienteConfig } from "@/lib/config/schema";
import { resolverVideo } from "@/lib/video";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lista clientes (com jobs) e lives — só super-admin. */
export async function GET() {
  if (!isServiceRoleConfigured) {
    return NextResponse.json({ erro: "supabase_ausente" }, { status: 503 });
  }
  if (!(await getSuperAdmin())) {
    return NextResponse.json({ erro: "nao_autorizado" }, { status: 403 });
  }
  const admin = getAdminClient();
  const [cli, lives] = await Promise.all([
    admin
      .from("clientes")
      .select("id, nome, slug, jobs:jobs(id, nome, codigo)")
      .order("nome"),
    admin
      .from("lives")
      .select("id, cliente_slug, nome, status, video_fonte, video_url, cliente_id, job_id")
      .order("created_at", { ascending: false }),
  ]);
  return NextResponse.json({
    clientes: cli.data ?? [],
    lives: lives.data ?? [],
  });
}

const bodySchema = z.object({
  acao: z.enum(["criar_cliente", "criar_job", "criar_live", "vincular_live"]),
  nome: z.string().optional(),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  codigo: z.string().optional(),
  cliente_id: z.string().uuid().optional(),
  job_id: z.string().uuid().optional(),
  live_id: z.string().uuid().optional(),
  video_fonte: z.enum(["vimeo", "youtube"]).optional(),
  video_url: z.string().optional(),
  senha: z.string().min(1).optional(),
});

export async function POST(req: Request) {
  if (!isServiceRoleConfigured) {
    return NextResponse.json({ erro: "supabase_ausente" }, { status: 503 });
  }
  if (!(await getSuperAdmin())) {
    return NextResponse.json({ erro: "nao_autorizado" }, { status: 403 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ erro: "payload" }, { status: 400 });
  }
  const admin = getAdminClient();

  switch (body.acao) {
    case "criar_cliente": {
      if (!body.nome?.trim())
        return NextResponse.json({ erro: "faltou_nome" }, { status: 400 });
      const { data, error } = await admin
        .from("clientes")
        .upsert({ nome: body.nome.trim(), slug: body.slug ?? null }, { onConflict: "nome" })
        .select("id, nome")
        .single();
      if (error)
        return NextResponse.json({ erro: error.message }, { status: 400 });
      return NextResponse.json({ ok: true, cliente: data });
    }

    case "criar_job": {
      if (!body.cliente_id || !body.nome?.trim())
        return NextResponse.json({ erro: "faltou_dados" }, { status: 400 });
      const { data, error } = await admin
        .from("jobs")
        .upsert(
          {
            cliente_id: body.cliente_id,
            nome: body.nome.trim(),
            codigo: body.codigo?.trim() || null,
          },
          { onConflict: "cliente_id,nome" }
        )
        .select("id, nome, codigo")
        .single();
      if (error)
        return NextResponse.json({ erro: error.message }, { status: 400 });
      return NextResponse.json({ ok: true, job: data });
    }

    case "criar_live": {
      if (!body.slug || !body.nome?.trim() || !body.cliente_id || !body.senha)
        return NextResponse.json({ erro: "faltou_dados" }, { status: 400 });

      // Nome do cliente para o rótulo da config.
      const { data: cli } = await admin
        .from("clientes")
        .select("nome")
        .eq("id", body.cliente_id)
        .single();

      const videoFonte = body.video_fonte ?? "vimeo";
      const videoUrl = (body.video_url ?? "").trim();
      const cfg = parseClienteConfig({
        cliente: cli?.nome ?? body.nome,
        slug: body.slug,
        evento: {
          nome: body.nome.trim(),
          video_fonte: videoFonte,
          video_url: videoUrl,
          status: "aguardando",
        },
      });
      const v = resolverVideo(cfg.evento);

      const { data: live, error } = await admin
        .from("lives")
        .insert({
          cliente_slug: body.slug,
          nome: body.nome.trim(),
          vimeo_video_id: v.id || "",
          senha_unica_hash: "",
          status: "aguardando",
          config_json: cfg,
          cliente_id: body.cliente_id,
          job_id: body.job_id ?? null,
          video_fonte: videoFonte,
          video_url: videoUrl,
        })
        .select("id, cliente_slug")
        .single();
      if (error)
        return NextResponse.json({ erro: error.message }, { status: 400 });

      await admin.rpc("definir_senha_unica", {
        p_live_id: live.id,
        p_senha: body.senha,
      });
      return NextResponse.json({ ok: true, live });
    }

    case "vincular_live": {
      if (!body.live_id)
        return NextResponse.json({ erro: "faltou_live" }, { status: 400 });
      const { error } = await admin
        .from("lives")
        .update({
          cliente_id: body.cliente_id ?? null,
          job_id: body.job_id ?? null,
        })
        .eq("id", body.live_id);
      if (error)
        return NextResponse.json({ erro: error.message }, { status: 400 });
      return NextResponse.json({ ok: true });
    }
  }
}
