// Timeline-local UI state (not part of the undoable project): open sequence
// tabs, display settings, drag previews, snap line, clipboard, render cache.
import { create } from "zustand";
import type { Clip, ID, Sequence, Transition, TransitionType } from "@shared/types";

export interface DisplaySettings {
  thumbnails: boolean;
  waveforms: boolean;
  keyframes: boolean;
  throughEdits: boolean;
  duplicateFrames: boolean;
  clipMarkers: boolean;
  clipNames: boolean;
  fxBadges: boolean;
}

export interface EditPointSel {
  clipId: ID;
  edge: "in" | "out";
}

export interface DropIndicator {
  time: number;
  trackId?: ID;
  kind: "insert" | "overwrite" | "transition" | "effect";
  clipId?: ID;
}

export interface TimelineState {
  openSeqIds: ID[];
  display: DisplaySettings;
  showCaptions: boolean;
  /** "Insert and overwrite sequences as nests or individual clips" toggle. */
  nestSequences: boolean;
  /** Live preview of the active sequence during a drag (commit on pointerup). */
  preview: Sequence | null;
  snapLine: number | null;
  tooltip: { x: number; y: number; text: string } | null;
  marquee: { x0: number; y0: number; x1: number; y1: number } | null;
  /** Razor hover line. */
  hoverCut: { time: number; trackIds: ID[] | "all" } | null;
  selectedEdits: EditPointSel[];
  selectedMarkerId: ID | null;
  /** Gap selected by clicking empty track space (Delete = ripple delete it). */
  selectedGap: { trackId: ID; time: number } | null;
  /** Keys of render segments that have been "rendered" (green). */
  rendered: Set<string>;
  prevZoom: { pxPerSec: number; scrollTime: number } | null;
  defaultVideoTransition: TransitionType;
  defaultAudioTransition: TransitionType;
  defaultTransitionDuration: number;
  drop: DropIndicator | null;
  /** Width in px of the visible clip lanes. */
  viewWidth: number;
  /** Ruler-dragged marker preview (id -> time). */
  markerDrag: { id: ID; time: number } | null;
  /** In/Out drag preview. */
  inOutDrag: { inPoint?: number; outPoint?: number } | null;
  set: (p: Partial<TimelineState>) => void;
}

function loadDisplay(): DisplaySettings {
  const def: DisplaySettings = { thumbnails: true, waveforms: true, keyframes: true, throughEdits: false, duplicateFrames: false, clipMarkers: true, clipNames: true, fxBadges: true };
  try {
    const raw = localStorage.getItem("editcut.timeline.display");
    if (raw) return { ...def, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return def;
}

export const useTimeline = create<TimelineState>()((set) => ({
  openSeqIds: [],
  display: loadDisplay(),
  showCaptions: true,
  nestSequences: true,
  preview: null,
  snapLine: null,
  tooltip: null,
  marquee: null,
  hoverCut: null,
  selectedEdits: [],
  selectedMarkerId: null,
  selectedGap: null,
  rendered: new Set(),
  prevZoom: null,
  defaultVideoTransition: "crossDissolve",
  defaultAudioTransition: "constantPower",
  defaultTransitionDuration: 1,
  drop: null,
  viewWidth: 800,
  markerDrag: null,
  inOutDrag: null,
  set: (p) => set(p),
}));

export const tl = () => useTimeline.getState();

export function setDisplay(patch: Partial<DisplaySettings>): void {
  const display = { ...tl().display, ...patch };
  tl().set({ display });
  try {
    localStorage.setItem("editcut.timeline.display", JSON.stringify(display));
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------- clipboard
export interface ClipboardData {
  clips: Clip[]; // plain copies, start relative to the earliest clip
  /** kind + 0-based index within kind for each clip (same order as clips). */
  tracks: { kind: "video" | "audio" | "caption"; index: number }[];
  transitions: Transition[];
  duration: number;
}

let clipboard: ClipboardData | null = null;
export const getClipboard = () => clipboard;
export const setClipboard = (c: ClipboardData | null) => {
  clipboard = c;
};
