import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { cache } from "react";
import {
  parseClienteConfig,
  safeParseClienteConfig,
  type ClienteConfig,
} from "./schema";
import { getAdminClient } from "@/lib/supabase/admin";
import { isServiceRoleConfigured } from "@/lib/supabase/env";
import { resolverVideo, type VideoResolvido } from "@/lib/video";

export type LiveStatus = "aguardando" | "ao_vivo" | "encerrada";

export interface Tenant {
  /** Config visual/comportamental validada (white-label). */
  config: ClienteConfig;
  /** id da live no banco. null em dev sem Supabase. */
  liveId: string | null;
  /** Status autoritativo. Vem do banco quando disponível (RF-14). */
  status: LiveStatus;
  /** Vídeo resolvido (fonte Vimeo/YouTube + id + ao vivo). */
  video: VideoResolvido;
  /** A quem a live pertence (cliente → job). null em legado/arquivo. */
  owner: {
    clienteNome: string;
    jobNome: string;
    jobCodigo: string | null;
  } | null;
  /** Origem da config: banco ou arquivo local (dev). */
  source: "db" | "file";
}

const CONFIG_DIR = path.join(process.cwd(), "config", "clientes");

async function readLocalConfig(slug: string): Promise<ClienteConfig | null> {
  // Proteção contra path traversal: só slug válido.
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  try {
    const raw = await fs.readFile(
      path.join(CONFIG_DIR, `${slug}.json`),
      "utf-8"
    );
    const parsed = safeParseClienteConfig(JSON.parse(raw));
    if (!parsed.success) {
      // RF-66: erro claro se o JSON do cliente for inválido.
      console.error(
        `[config] JSON do cliente "${slug}" inválido:`,
        parsed.error.flatten()
      );
      return null;
    }
    return parsed.data;
  } catch (e) {
    // Arquivo inexistente é esperado (slug desconhecido); só loga o resto.
    if ((e as NodeJS.ErrnoException)?.code !== "ENOENT") {
      console.error(`[config] falha lendo "${slug}":`, (e as Error)?.message);
    }
    return null;
  }
}

/**
 * Resolve o tenant a partir do slug (RF-65).
 *
 * Estratégia:
 *  1. Se o Supabase estiver configurado, busca a live no banco (fonte da
 *     verdade do status). A config visual vem de `config_json`.
 *  2. Em dev sem banco, cai no arquivo `config/clientes/<slug>.json`.
 *
 * `cache()` deduplica a resolução dentro de um mesmo request.
 */
const COLS_NOVAS =
  "id, status, nome, vimeo_video_id, video_fonte, video_url, config_json, data_inicio, cliente_id, job_id, clientes:cliente_id(nome), jobs:job_id(nome,codigo)";

export const resolveTenant = cache(
  async (slug: string): Promise<Tenant | null> => {
    if (isServiceRoleConfigured) {
      const admin = getAdminClient();

      // Banco como fonte da verdade. Resiliente: se as colunas novas ainda
      // não existem (antes da migração 0004), cai no conjunto legado.
      let legacy = false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let res: any = await admin
        .from("lives")
        .select(COLS_NOVAS)
        .eq("cliente_slug", slug)
        .maybeSingle();
      if (
        res.error &&
        /column|does not exist|schema cache|relationship/i.test(
          res.error.message
        )
      ) {
        legacy = true;
        res = await admin
          .from("lives")
          .select("id, status, vimeo_video_id, config_json")
          .eq("cliente_slug", slug)
          .maybeSingle();
      }
      if (res.error) {
        console.error(`[config] erro lendo live "${slug}":`, res.error.message);
      }

      const data = res.data;
      if (data) {
        const parsed = safeParseClienteConfig(data.config_json);
        const config = parsed.success
          ? parsed.data
          : (await readLocalConfig(slug)) ??
            fallbackConfig(slug, data.vimeo_video_id ?? "0");

        // Colunas mandam sobre o JSON (operacional à prova de falhas).
        if (!legacy) {
          if (data.nome) config.evento.nome = data.nome;
          config.evento.video_fonte = data.video_fonte ?? config.evento.video_fonte;
          config.evento.video_url = data.video_url ?? config.evento.video_url;
          if (data.data_inicio) config.evento.data_inicio = data.data_inicio;
        }

        const owner = legacy
          ? null
          : {
              clienteNome: data.clientes?.nome ?? "",
              jobNome: data.jobs?.nome ?? "",
              jobCodigo: data.jobs?.codigo ?? null,
            };

        return {
          config,
          liveId: data.id,
          status: data.status as LiveStatus,
          video: resolverVideo(config.evento),
          owner,
          source: "db",
        };
      }
      // Não achou no banco: tenta arquivo local (útil em dev/transição).
    }

    const config = await readLocalConfig(slug);
    if (!config) return null;
    return {
      config,
      liveId: null,
      status: config.evento.status,
      video: resolverVideo(config.evento),
      owner: null,
      source: "file",
    };
  }
);

function fallbackConfig(slug: string, vimeoVideoId: string): ClienteConfig {
  return parseClienteConfig({
    cliente: slug,
    slug,
    evento: { nome: slug, vimeo_video_id: vimeoVideoId || "0" },
  });
}
