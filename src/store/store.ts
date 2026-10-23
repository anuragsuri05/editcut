// Central editor store (zustand + immer).
// - `project` is the undoable document. Mutate ONLY through apply()/applySeq().
// - Everything else is UI state (not in undo history).
// - The live playhead lives in usePlayback (src/store/playback.ts) for 60fps updates.
import { create } from "zustand";
import { produce, freeze } from "immer";
import type { ID, MediaAsset, Project, Sequence } from "@shared/types";
import { makeProject } from "@shared/factory";

export type ToolId =
  | "select" | "trackForward" | "trackBackward" | "ripple" | "roll" | "rateStretch" | "razor"
  | "slip" | "slide" | "pen" | "rectangle" | "ellipse" | "hand" | "zoom" | "type";

export type AppMode = "import" | "edit" | "export";

export interface HistoryEntry {
  label: string;
  project: Project;
  time: number;
}

export interface Selection {
  clipIds: ID[];
  transitionId: ID | null;
  /** Project panel selection. */
  itemIds: ID[];
  /** Selected keyframes in Effect Controls: `${clipId}|${path}|${index}` */
  keyframes: string[];
}

export interface UIState {
  mode: AppMode;
  tool: ToolId;
  snapping: boolean;
  linkedSelection: boolean;
  /** Timeline zoom in pixels per second. */
  pxPerSec: number;
  /** Timeline horizontal scroll in seconds. */
  scrollTime: number;
  /** Asset loaded in the Source Monitor. */
  sourceAssetId: ID | null;
  /** Which monitor has focus for J/K/L, I/O. */
  focusedMonitor: "source" | "program";
  /** Panel id with keyboard focus (blue outline). */
  activePanel: string;
  /** Source patching: destination track index (0-based) for source V/A, null = not patched. */
  patchVideo: number | null;
  patchAudio: number | null;
  proxiesEnabled: boolean;
  playbackResolution: 1 | 0.5 | 0.25;
  loopPlayback: boolean;
  showSafeMargins: boolean;
  /** Seconds of pre/post-roll for "Play Around". */
  preroll: number;
  /** Modal dialog currently open (rendered by src/ui/Dialogs). */
  dialog: { id: string; props?: Record<string, unknown> } | null;
  /** Toast notifications. */
  toasts: { id: number; text: string; kind: "info" | "error" | "success" }[];
  /** Background job progress for status bar (import, transcription, render...). */
  jobs: Record<string, { label: string; progress: number }>;
}

export interface EditorState extends UIState {
  project: Project;
  past: HistoryEntry[];
  future: HistoryEntry[];
  selection: Selection;
  /** Dirty since last save. */
  dirty: boolean;

  /** Undoable project mutation. */
  apply: (label: string, fn: (draft: Project) => void) => void;
  /** Undoable mutation of the active sequence. No-op if none. */
  applySeq: (label: string, fn: (seq: Sequence, project: Project) => void) => void;
  /** Non-undoable project patch (media status updates, playhead persistence). */
  patch: (fn: (draft: Project) => void) => void;
  patchMedia: (id: ID, changes: Partial<MediaAsset>) => void;
  undo: () => void;
  redo: () => void;
  /** Jump to a history state (History panel). index into past, or past.length for current. */
  jumpToHistory: (index: number) => void;
  loadProject: (p: Project) => void;
  setUI: (partial: Partial<UIState>) => void;
  select: (partial: Partial<Selection>) => void;
  toast: (text: string, kind?: "info" | "error" | "success") => void;
  setJob: (id: string, job: { label: string; progress: number } | null) => void;
  openDialog: (id: string, props?: Record<string, unknown>) => void;
  closeDialog: () => void;
  markSaved: () => void;
}

const MAX_HISTORY = 200;
let toastSeq = 1;

export const useEditor = create<EditorState>()((set, get) => ({
  project: freeze(makeProject("Untitled Project"), true),
  past: [],
  future: [],
  dirty: false,
  selection: { clipIds: [], transitionId: null, itemIds: [], keyframes: [] },

  mode: "edit",
  tool: "select",
  snapping: true,
  linkedSelection: true,
  pxPerSec: 60,
  scrollTime: 0,
  sourceAssetId: null,
  focusedMonitor: "program",
  activePanel: "timeline",
  patchVideo: 0,
  patchAudio: 0,
  proxiesEnabled: true,
  playbackResolution: 1,
  loopPlayback: false,
  showSafeMargins: false,
  preroll: 2,
  dialog: null,
  toasts: [],
  jobs: {},

  apply: (label, fn) => {
    const prev = get().project;
    const next = produce(prev, (d) => {
      fn(d);
      d.updatedAt = Date.now();
    });
    if (next === prev) return;
    set((s) => ({
      project: next,
      past: [...s.past, { label, project: prev, time: Date.now() }].slice(-MAX_HISTORY),
      future: [],
      dirty: true,
    }));
  },

  applySeq: (label, fn) => {
    const id = get().project.activeSequenceId;
    if (!id) return;
    get().apply(label, (d) => {
      const seq = d.sequences[id];
      if (seq) fn(seq, d);
    });
  },

  patch: (fn) => set((s) => ({ project: produce(s.project, fn) })),

  patchMedia: (id, changes) =>
    set((s) => ({
      project: produce(s.project, (d) => {
        if (d.media[id]) Object.assign(d.media[id], changes);
      }),
    })),

  undo: () => {
    const { past, project, future } = get();
    if (!past.length) return;
    const entry = past[past.length - 1];
    set({
      project: entry.project,
      past: past.slice(0, -1),
      future: [{ label: entry.label, project, time: Date.now() }, ...future],
      dirty: true,
    });
    get().toast(`Undo ${entry.label}`);
  },

  redo: () => {
    const { past, project, future } = get();
    if (!future.length) return;
    const entry = future[0];
    set({
      project: entry.project,
      past: [...past, { label: entry.label, project, time: Date.now() }],
      future: future.slice(1),
      dirty: true,
    });
    get().toast(`Redo ${entry.label}`);
  },

  jumpToHistory: (index) => {
    const s = get();
    const n = s.past.length;
    if (index === n) return;
    if (index < n) {
      for (let i = n; i > index; i--) get().undo();
    } else {
      for (let i = n; i < index; i++) get().redo();
    }
  },

  loadProject: (p) =>
    set({
      project: freeze(p, true),
      past: [],
      future: [],
      dirty: false,
      selection: { clipIds: [], transitionId: null, itemIds: [], keyframes: [] },
      sourceAssetId: null,
    }),

  setUI: (partial) => set(partial as Partial<EditorState>),
  select: (partial) => set((s) => ({ selection: { ...s.selection, ...partial } })),

  toast: (text, kind = "info") => {
    const id = toastSeq++;
    set((s) => ({ toasts: [...s.toasts.slice(-4), { id, text, kind }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), kind === "error" ? 6000 : 2500);
  },

  setJob: (id, job) =>
    set((s) => {
      const jobs = { ...s.jobs };
      if (job) jobs[id] = job;
      else delete jobs[id];
      return { jobs };
    }),

  openDialog: (id, props) => set({ dialog: { id, props } }),
  closeDialog: () => set({ dialog: null }),
  markSaved: () => set({ dirty: false }),
}));

// ---------- selectors / helpers ----------

export const useProject = () => useEditor((s) => s.project);

export function useActiveSequence(): Sequence | null {
  return useEditor((s) => (s.project.activeSequenceId ? s.project.sequences[s.project.activeSequenceId] ?? null : null));
}

export function getActiveSequence(): Sequence | null {
  const p = useEditor.getState().project;
  return p.activeSequenceId ? p.sequences[p.activeSequenceId] ?? null : null;
}

export const editor = () => useEditor.getState();
