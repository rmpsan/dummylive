/** Catálogo de eventos de tracking (§4.5 do PRD). */
export type TrackingEventType =
  | "session_start"
  | "heartbeat"
  | "video_play"
  | "video_pause"
  | "video_seek"
  | "video_milestone"
  | "tab_hidden"
  | "tab_visible"
  | "chat_message"
  | "cta_click"
  | "reaction"
  | "poll_answer"
  | "session_end";

export interface TrackingEvent {
  tipo: TrackingEventType;
  payload?: Record<string, unknown>;
  video_time?: number | null;
  aba_visivel?: boolean | null;
  ts: string; // ISO
}

export interface TrackBatch {
  sessaoId: string;
  liveId: string;
  eventos: TrackingEvent[];
}
