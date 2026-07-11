import { z } from "zod";

/**
 * Schema do JSON de configuração de cliente (white-label).
 * Espelha o §4.9 do PRD. Toda a camada visual + comportamental de um
 * cliente vive aqui — nenhum código muda entre clientes (RF-62 → RF-64).
 *
 * Campos com default garantem "fallback para tema default" (RF-67): se o
 * JSON do cliente omitir algo, o app não quebra.
 */

const corHex = z
  .string()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, "cor hex inválida");

/** URL/caminho opcional; aceita http(s) OU caminho local "/...". "" = ausente.
 * Rejeita caracteres que quebrariam CSS `url()`/HTML (B2 da auditoria). */
const urlOpcional = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  z
    .string()
    .refine(
      (s) =>
        (/^https?:\/\//.test(s) || s.startsWith("/")) &&
        !/["'()<>\\\s]/.test(s),
      { message: "URL/caminho inválido ou com caracteres não permitidos" }
    )
    .optional()
);

export const coresSchema = z.object({
  primaria: corHex.default("#FF6B00"),
  secundaria: corHex.default("#0A0A0A"),
  fundo: corHex.default("#0B0B0D"),
  superficie: corHex.default("#141417"),
  texto: corHex.default("#FFFFFF"),
  texto_secundario: corHex.default("#9AA0AA"),
  destaque: corHex.default("#B8FF57"),
  erro: corHex.default("#FF3D71"),
  sucesso: corHex.default("#29E0A0"),
  /** Texto sobre a cor primária (botões). Ajuste se a primária for escura. */
  sobre_primaria: corHex.default("#0A0A0A"),
});

export const tipografiaSchema = z.object({
  titulo: z.string().default("Sora"),
  corpo: z.string().default("Inter"),
  mono: z.string().default("JetBrains Mono"),
  google_fonts_url: urlOpcional,
});

export const layoutSchema = z.object({
  posicao_chat: z.enum(["direita", "esquerda"]).default("direita"),
  tema: z.enum(["escuro", "claro"]).default("escuro"),
  raio_borda: z.string().default("14px"),
});

export const kvSchema = z.object({
  logo: urlOpcional,
  logo_escuro: urlOpcional,
  favicon: urlOpcional,
  imagem_fundo_entrada: urlOpcional,
  /** Imagem-herói flutuante na entrada (ex.: ingresso/pack shot). */
  destaque_imagem: urlOpcional,
  /** Imagem de vitrine (ex.: grade de mentoras) exibida na entrada. */
  imagem_showcase: urlOpcional,
  /** Imagem exibida no lugar do player enquanto a live está "aguardando". */
  imagem_aguardando: urlOpcional,
  cores: coresSchema.default({}),
  tipografia: tipografiaSchema.default({}),
  layout: layoutSchema.default({}),
});

export const campoExtraSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  obrigatorio: z.boolean().default(false),
  /** Tipo do campo — habilita máscara/validação (ex.: cpf). */
  tipo: z.enum(["texto", "cpf", "email", "tel"]).default("texto"),
});

export const acessoSchema = z.object({
  // A senha única real vive no banco (hash). Aqui é só metadado opcional
  // para preview local; nunca confie neste campo em produção.
  senha_unica_espectador: z.string().optional(),
  campos_extras: z.array(campoExtraSchema).default([]),
  consentimento_lgpd_texto: z
    .string()
    .default(
      "Autorizo a coleta de dados de participação conforme a Política de Privacidade."
    ),
  link_politica_privacidade: urlOpcional,
  /** Email/canal de contato do controlador para assuntos de privacidade (LGPD). */
  contato_privacidade: z.string().default(""),
});

export const eventoSchema = z.object({
  nome: z.string().min(1),
  subtitulo: z.string().default(""),
  /** Fonte do vídeo. Se ausente, inferida a partir de video_url. */
  video_fonte: z.enum(["vimeo", "youtube"]).optional(),
  /** Link do vídeo (YouTube ou Vimeo, ao vivo ou VOD). */
  video_url: z.string().default(""),
  /** Legado: id do Vimeo. Mantido para compatibilidade; opcional agora. */
  vimeo_video_id: z.string().default(""),
  /** Marca se é transmissão ao vivo (Vimeo Live / YouTube Live). */
  vimeo_is_live: z.boolean().default(true),
  status: z.enum(["aguardando", "ao_vivo", "encerrada"]).default("aguardando"),
  data_inicio: z.string().optional(),
  /** Início oficial dos dados: o dashboard só conta atividade a partir daqui
   * (exclui testes anteriores). ISO 8601. Vazio = conta tudo. */
  metricas_desde: z.string().optional(),
});

export const ctaSchema = z.object({
  ativo: z.boolean().default(false),
  texto: z.string().default(""),
  url: urlOpcional,
  posicao: z
    .enum(["abaixo_do_video", "acima_do_chat", "topo"])
    .default("abaixo_do_video"),
});

export const featuresSchema = z.object({
  chat: z.boolean().default(true),
  reacoes: z.boolean().default(false),
  /** Conjunto de emojis da barra de reações (configurável por cliente). */
  emojis: z.array(z.string().min(1)).default(["❤️", "👏", "🔥", "😮", "🎉"]),
  enquetes: z.boolean().default(false),
  cta: ctaSchema.default({}),
  contador_online: z.boolean().default(true),
  rate_limit_segundos: z.number().int().nonnegative().default(5),
  limite_caracteres_msg: z.number().int().positive().default(280),
  palavras_proibidas: z.array(z.string()).default([]),
});

export const textosSchema = z.object({
  titulo_entrada: z.string().default("Bem-vindo à transmissão"),
  boas_vindas: z.string().default("Insira seus dados para acessar."),
  aguardando: z.string().default("A transmissão começa em breve."),
  ao_vivo_label: z.string().default("AO VIVO"),
  encerrada: z
    .string()
    .default("A transmissão foi encerrada. Obrigado por participar."),
  erro_senha: z.string().default("Senha incorreta. Tente novamente."),
  rodape: z.string().default(""),
});

export const trackingSchema = z.object({
  heartbeat_seg: z.number().int().positive().default(20),
  milestones_percentuais: z
    .array(z.number().int().min(0).max(100))
    .default([10, 25, 50, 75, 90, 100]),
  granularidade_trecho_seg: z.number().int().positive().default(5),
});

/** Blocos de conteúdo editorial da sala (hero + seções de retenção). */
export const blocoSchema = z.object({
  titulo: z.string().default(""),
  corpo: z.string().default(""),
});

export const itemGaleriaSchema = z.object({
  imagem: z.string().default(""),
  legenda: z.string().default(""),
});

export const conteudoSchema = z.object({
  hero_titulo: z.string().default(""),
  hero_texto: z.string().default(""),
  blocos: z.array(blocoSchema).default([]),
  /** Vitrine de imagens (ex.: produtos de artesanato) exibida na sala. */
  galeria_titulo: z.string().default(""),
  galeria: z.array(itemGaleriaSchema).default([]),
});

/** Fila de curadoria persistida (alimenta o data source JSON/XML do vMix). */
export const cgItemSchema = z.object({
  id: z.number(),
  nome: z.string().default(""),
  mensagem: z.string().default(""),
});
export const cgSchema = z.object({
  atualizado: z.string().default(""),
  mensagens: z.array(cgItemSchema).default([]),
});

export const clienteConfigSchema = z.object({
  cliente: z.string().min(1),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, "slug deve ser minúsculo, alfanumérico e hífens"),
  evento: eventoSchema,
  acesso: acessoSchema.default({}),
  kv: kvSchema.default({}),
  textos: textosSchema.default({}),
  features: featuresSchema.default({}),
  tracking: trackingSchema.default({}),
  conteudo: conteudoSchema.default({}),
  /** Fila de curadoria (runtime) — consumida pelo overlay e pelo data source. */
  cg: cgSchema.default({}),
});

export type ClienteConfig = z.infer<typeof clienteConfigSchema>;
export type Cores = z.infer<typeof coresSchema>;

/**
 * Valida e normaliza um objeto de config bruto. Lança erro claro (RF-66)
 * com o caminho do campo inválido se o schema não bater.
 */
export function parseClienteConfig(raw: unknown): ClienteConfig {
  return clienteConfigSchema.parse(raw);
}

export function safeParseClienteConfig(raw: unknown) {
  return clienteConfigSchema.safeParse(raw);
}
