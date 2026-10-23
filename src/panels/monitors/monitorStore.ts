// UI state local to the Source/Program monitors (not undoable, persisted per user).
import { create } from "zustand";

export type Zoom = "fit" | number;
export type ScopeKind = "waveformLuma" | "waveformRGB" | "waveformYC" | "parade" | "vectorscope" | "histogram";

export interface MonitorUI {
  programZoom: Zoom;
  sourceZoom: Zoom;
  transparencyGrid: boolean;
  showDroppedFrames: boolean;
  timeRulerNumbers: boolean;
  showRulers: boolean;
  showGuides: boolean;
  fxMute: boolean;
  multiCamera: boolean;
  comparison: { on: boolean; mode: "shot" | "frame"; layout: "side" | "vertical" | "horizontal"; refTime: number; swap: boolean; split: number };
  /** Recently opened Source Monitor assets (most recent first). */
  sourceHistory: string[];
  sourceWaveform: boolean;
  programButtons: string[];
  sourceButtons: string[];
  scopes: ScopeKind[];
  scopeBrightness: number;
  scopeClamp: boolean;
  scopeColorSpace: "709" | "601";
  set: (p: Partial<MonitorUI>) => void;
}

export const DEFAULT_PROGRAM_BUTTONS = ["addMarker", "markIn", "markOut", "goToIn", "stepBack", "play", "stepForward", "goToOut", "lift", "extract", "exportFrame", "comparison", "toggleProxies"];
export const DEFAULT_SOURCE_BUTTONS = ["addMarker", "markIn", "markOut", "goToIn", "stepBack", "play", "stepForward", "goToOut", "insert", "overwrite", "exportFrame"];

const KEY = "editcut.monitors";
const PERSIST: (keyof MonitorUI)[] = ["transparencyGrid", "showDroppedFrames", "timeRulerNumbers", "programButtons", "sourceButtons", "scopes", "scopeBrightness", "scopeClamp", "scopeColorSpace", "programZoom", "sourceZoom"];

function load(): Partial<MonitorUI> {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Partial<MonitorUI>) : {};
  } catch {
    return {};
  }
}

export const useMonitorUI = create<MonitorUI>()((set, get) => ({
  programZoom: "fit",
  sourceZoom: "fit",
  transparencyGrid: false,
  showDroppedFrames: true,
  timeRulerNumbers: false,
  showRulers: false,
  showGuides: false,
  fxMute: false,
  multiCamera: false,
  comparison: { on: false, mode: "shot", layout: "side", refTime: 0, swap: false, split: 0.5 },
  sourceHistory: [],
  sourceWaveform: false,
  programButtons: DEFAULT_PROGRAM_BUTTONS,
  sourceButtons: DEFAULT_SOURCE_BUTTONS,
  scopes: ["waveformLuma", "vectorscope"],
  scopeBrightness: 1,
  scopeClamp: true,
  scopeColorSpace: "709",
  ...load(),
  set: (p) => {
    set(p);
    try {
      const s = get();
      localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(PERSIST.map((k) => [k, s[k]]))));
    } catch {
      /* ignore */
    }
  },
}));

export const monitorUI = () => useMonitorUI.getState();
