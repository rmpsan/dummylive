"use client";

import type { VideoFonte } from "@/lib/video";
import type { PlayerProps } from "./player-types";
import { VimeoPlayer } from "./vimeo-player";
import { YouTubePlayer } from "./youtube-player";

/**
 * Dispatcher de player: escolhe Vimeo ou YouTube conforme a fonte definida
 * nas configurações da live. Ambos expõem os mesmos callbacks de tracking.
 */
export function Player({
  fonte,
  ...props
}: PlayerProps & { fonte: VideoFonte }) {
  if (fonte === "youtube") return <YouTubePlayer {...props} />;
  return <VimeoPlayer {...props} />;
}
