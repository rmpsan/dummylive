import type { CSSProperties } from "react";
import type { ClienteConfig } from "./config/schema";

/**
 * Converte o KV do cliente (JSON) num conjunto de CSS variables aplicadas
 * em runtime (RF-15, RF-70). Toda a UI referencia essas variáveis
 * (`var(--kv-*)`) — trocar o JSON troca 100% do visual sem tocar em código.
 */
export function kvToCssVars(config: ClienteConfig): CSSProperties {
  const { cores, tipografia, layout } = config.kv;
  return {
    "--kv-primaria": cores.primaria,
    "--kv-secundaria": cores.secundaria,
    "--kv-fundo": cores.fundo,
    "--kv-superficie": cores.superficie,
    "--kv-texto": cores.texto,
    "--kv-texto-secundario": cores.texto_secundario,
    "--kv-destaque": cores.destaque,
    "--kv-erro": cores.erro,
    "--kv-sucesso": cores.sucesso,
    "--kv-sobre-primaria": cores.sobre_primaria,
    "--kv-raio": layout.raio_borda,
    "--kv-font-titulo": `"${tipografia.titulo}", system-ui, sans-serif`,
    "--kv-font-corpo": `"${tipografia.corpo}", system-ui, sans-serif`,
    "--kv-font-mono": `"${tipografia.mono}", ui-monospace, monospace`,
  } as CSSProperties;
}

/** URL do Google Fonts do cliente, se houver (RF-79 usa font-display swap). */
export function googleFontsUrl(config: ClienteConfig): string | null {
  return config.kv.tipografia.google_fonts_url ?? null;
}
