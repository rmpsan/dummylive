/**
 * Resolução da fonte de vídeo (Vimeo ou YouTube, ao vivo ou VOD).
 *
 * O cliente define nas configurações a FONTE e o LINK do vídeo. Aqui
 * extraímos o id a partir do link (aceita várias formas de URL) e caímos
 * para o campo legado `vimeo_video_id` quando não houver link.
 */
export type VideoFonte = "vimeo" | "youtube";

export interface VideoResolvido {
  fonte: VideoFonte;
  id: string;
  aoVivo: boolean;
}

/** Extrai {fonte,id} de uma URL de YouTube ou Vimeo. null se não reconhecer. */
export function parseVideoUrl(
  raw: string
): { fonte: VideoFonte; id: string } | null {
  const url = raw.trim();
  if (!url) return null;

  // YouTube: watch?v=, youtu.be/, /live/, /embed/, /shorts/
  const yt = url.match(
    /(?:youtube\.com\/(?:watch\?v=|live\/|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/
  );
  if (yt) return { fonte: "youtube", id: yt[1] };

  // Vimeo: vimeo.com/123, player.vimeo.com/video/123, vimeo.com/event/..
  const vm = url.match(/vimeo\.com\/(?:video\/|event\/)?(\d+)/);
  if (vm) return { fonte: "vimeo", id: vm[1] };

  return null;
}

interface EventoLike {
  video_fonte?: VideoFonte;
  video_url?: string;
  vimeo_video_id?: string;
  vimeo_is_live?: boolean;
}

export function resolverVideo(evento: EventoLike): VideoResolvido {
  const aoVivo = evento.vimeo_is_live ?? false;
  const url = evento.video_url?.trim();

  if (url) {
    const p = parseVideoUrl(url);
    if (p) return { fonte: evento.video_fonte ?? p.fonte, id: p.id, aoVivo };
    // URL não reconhecida: trata o valor como id bruto, respeitando a fonte.
    return { fonte: evento.video_fonte ?? "vimeo", id: url, aoVivo };
  }

  // Sem link: usa o campo legado (Vimeo) ou o fonte explícito.
  return {
    fonte: evento.video_fonte ?? "vimeo",
    id: evento.vimeo_video_id ?? "",
    aoVivo,
  };
}
