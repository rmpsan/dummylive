/** Props comuns aos players (Vimeo e YouTube) — tracking idêntico. */
export interface PlayerProps {
  videoId: string;
  milestones: number[];
  /** Ao vivo = só mutar + fullscreen. VOD = play/pause/seek/mutar/fullscreen. */
  aoVivo?: boolean;
  onPlay?: (time: number) => void;
  onPause?: (time: number) => void;
  onSeek?: (from: number, to: number) => void;
  onTimeUpdate?: (seconds: number, percent: number) => void;
  onMilestone?: (percent: number) => void;
  onEnded?: () => void;
}
