"use client";

import { useCallback, useEffect, useRef } from "react";
import type { TrackingEvent, TrackingEventType } from "./types";

const TRACK_URL = "/api/track";
const FLUSH_INTERVAL_MS = 10_000; // §6.4: flush a cada 10s…
const FLUSH_MAX_EVENTS = 25; // …ou 25 eventos.

interface VideoState {
  playing: boolean;
  time: number;
  watchedSeconds: number;
  maxPercent: number;
}

export interface Tracker {
  track: (
    tipo: TrackingEventType,
    opts?: { payload?: Record<string, unknown>; videoTime?: number }
  ) => void;
  /** Atualiza o estado do vídeo consumido pelo player (alimenta heartbeat). */
  setVideoState: (patch: Partial<VideoState>) => void;
  /** Marca segundos assistidos acumulados. */
  addWatchedSeconds: (n: number) => void;
}

/**
 * Hook de tracking do espectador (RF-38→48, RF-74/75).
 *
 * - Heartbeat a cada `heartbeatSeg` com aba_visivel + estado do vídeo.
 * - Buffer client-side + flush por tempo/quantidade (não sobrecarrega).
 * - `visibilitychange`/`pagehide` + `sendBeacon` garantem session_end no
 *   mobile, onde `beforeunload` não é confiável (iOS).
 */
export function useTracking({
  sessaoId,
  liveId,
  heartbeatSeg,
  enabled,
}: {
  sessaoId: string | null;
  liveId: string | null;
  heartbeatSeg: number;
  enabled: boolean;
}): Tracker {
  const buffer = useRef<TrackingEvent[]>([]);
  const video = useRef<VideoState>({
    playing: false,
    time: 0,
    watchedSeconds: 0,
    maxPercent: 0,
  });
  const endedRef = useRef(false);
  const idsRef = useRef({ sessaoId, liveId });
  useEffect(() => {
    idsRef.current = { sessaoId, liveId };
  }, [sessaoId, liveId]);

  const flush = useCallback((useBeacon = false) => {
    const { sessaoId, liveId } = idsRef.current;
    if (!sessaoId || !liveId || buffer.current.length === 0) return;

    const eventos = buffer.current;
    buffer.current = [];
    const body = JSON.stringify({ sessaoId, liveId, eventos });

    if (useBeacon && typeof navigator !== "undefined" && navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      const ok = navigator.sendBeacon(TRACK_URL, blob);
      if (!ok) buffer.current = eventos.concat(buffer.current); // devolve se falhar
      return;
    }

    fetch(TRACK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {
      // Degradação graciosa (RNF-09): perder tracking não afeta o vídeo.
      buffer.current = eventos.concat(buffer.current);
    });
  }, []);

  const push = useCallback(
    (
      tipo: TrackingEventType,
      opts?: { payload?: Record<string, unknown>; videoTime?: number }
    ) => {
      const evt: TrackingEvent = {
        tipo,
        payload: opts?.payload,
        video_time: opts?.videoTime ?? video.current.time,
        aba_visivel:
          typeof document !== "undefined" ? !document.hidden : null,
        ts: new Date().toISOString(),
      };
      buffer.current.push(evt);
      if (buffer.current.length >= FLUSH_MAX_EVENTS) flush(false);
    },
    [flush]
  );

  const setVideoState = useCallback((patch: Partial<VideoState>) => {
    video.current = { ...video.current, ...patch };
  }, []);

  const addWatchedSeconds = useCallback((n: number) => {
    video.current.watchedSeconds += n;
  }, []);

  useEffect(() => {
    if (!enabled || !sessaoId || !liveId) return;

    // Ticker de 1s: acumula segundos realmente assistidos (playing + visível).
    const watchTicker = setInterval(() => {
      if (video.current.playing && !document.hidden) {
        video.current.watchedSeconds += 1;
      }
    }, 1000);

    // Heartbeat (RF-38).
    const hb = setInterval(() => {
      push("heartbeat", {
        payload: {
          video_playing: video.current.playing,
          watched_seconds: video.current.watchedSeconds,
          max_percent: video.current.maxPercent,
        },
      });
    }, Math.max(5, heartbeatSeg) * 1000);

    // Flush periódico.
    const flusher = setInterval(() => flush(false), FLUSH_INTERVAL_MS);

    const endSession = (motivo: string) => {
      if (endedRef.current) return;
      endedRef.current = true;
      push("session_end", {
        payload: {
          motivo,
          watched_seconds: video.current.watchedSeconds,
          max_percent: video.current.maxPercent,
        },
      });
      flush(true); // sendBeacon garante gravação (RF-75)
    };

    // Mobile: visibilitychange cobre troca de app / tela bloqueada (RF-74).
    const onVisibility = () => {
      if (document.hidden) {
        push("tab_hidden");
        flush(true);
      } else {
        endedRef.current = false; // voltou; a sessão continua
        push("tab_visible");
      }
    };
    const onPageHide = () => endSession("saiu");

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    // beforeunload como reforço no desktop (não confiável no iOS).
    window.addEventListener("beforeunload", onPageHide);

    return () => {
      clearInterval(watchTicker);
      clearInterval(hb);
      clearInterval(flusher);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onPageHide);
      endSession("desmontou");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, sessaoId, liveId, heartbeatSeg]);

  return { track: push, setVideoState, addWatchedSeconds };
}
