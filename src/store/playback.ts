// High-frequency playback state, separate from the undoable project store so
// that 60fps playhead updates don't re-render the whole app.
import { create } from "zustand";

export interface PlaybackState {
  /** Program (timeline) playhead, seconds. */
  time: number;
  /** Source monitor playhead, seconds. */
  sourceTime: number;
  /** Which transport is playing. */
  playing: "program" | "source" | null;
  /** Signed shuttle rate (J/K/L): 1, 2, 4, 8, -1, -2 ... ; 0.25 for slow. */
  rate: number;
  /** Stop at this time (Play In to Out, Play Around). */
  stopAt: number | null;
  /** Audio meter levels per output channel (dBFS), updated by the engine. */
  meters: { left: number; right: number; peakLeft: number; peakRight: number };
  /** Per-track meters keyed by track id. */
  trackMeters: Record<string, number>;
  /** True while user is scrubbing (engine should seek, not play). */
  scrubbing: boolean;
  /** Dropped frame indicator. */
  droppedFrames: number;

  setTime: (t: number) => void;
  setSourceTime: (t: number) => void;
  play: (which: "program" | "source", rate?: number, stopAt?: number | null) => void;
  stop: () => void;
  set: (partial: Partial<PlaybackState>) => void;
}

export const usePlayback = create<PlaybackState>()((set) => ({
  time: 0,
  sourceTime: 0,
  playing: null,
  rate: 1,
  stopAt: null,
  meters: { left: -Infinity, right: -Infinity, peakLeft: -Infinity, peakRight: -Infinity },
  trackMeters: {},
  scrubbing: false,
  droppedFrames: 0,

  setTime: (t) => set({ time: Math.max(0, t) }),
  setSourceTime: (t) => set({ sourceTime: Math.max(0, t) }),
  play: (which, rate = 1, stopAt = null) => set({ playing: which, rate, stopAt }),
  stop: () => set({ playing: null, rate: 1, stopAt: null }),
  set: (partial) => set(partial),
}));

export const playback = () => usePlayback.getState();
