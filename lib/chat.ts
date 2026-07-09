/**
 * Sanitização de mensagem de chat (RF-29).
 *
 * A defesa primária de XSS é renderizar SEMPRE como texto no React (nunca
 * dangerouslySetInnerHTML). Aqui garantimos, no servidor, que o conteúdo
 * salvo é limpo: sem caracteres de controle, sem HTML, dentro do limite,
 * e sem palavras proibidas.
 */
export interface SanitizeOptions {
  maxLen: number;
  palavrasProibidas: string[];
}

export interface SanitizeResult {
  ok: boolean;
  texto?: string;
  motivo?: "vazio" | "muito_longo" | "palavra_proibida";
}

// Remove caracteres de controle (0x00–0x1F e 0x7F).
const CONTROL_CHARS = /[\x00-\x1F\x7F]/g;
const HTML_TAGS = /<[^>]*>/g;

export function sanitizeMessage(
  input: string,
  opts: SanitizeOptions
): SanitizeResult {
  let texto = (input ?? "")
    .replace(CONTROL_CHARS, "")
    .replace(HTML_TAGS, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!texto) return { ok: false, motivo: "vazio" };

  if (texto.length > opts.maxLen) {
    // Trunca em vez de rejeitar (RF-28).
    texto = texto.slice(0, opts.maxLen);
  }

  const lower = texto.toLowerCase();
  for (const palavra of opts.palavrasProibidas) {
    const p = palavra.trim().toLowerCase();
    if (p && lower.includes(p)) {
      return { ok: false, motivo: "palavra_proibida" };
    }
  }

  return { ok: true, texto };
}
