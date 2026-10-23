// Graphics & Titles: creating text/shape clips, alignment, title templates, caption upgrade.
import type { Clip, Generator, Sequence, TextStyle, Track } from "@shared/types";
import { defaultTextStyle, makeGeneratorClip } from "@shared/factory";
import { addTrack, clipEnd, overwriteClips, tracksOfKind } from "@shared/ops";
import { evalParam, setParamAt } from "@shared/params";
import { snapToFrame } from "@shared/time";
import { useEditor, getActiveSequence } from "../../store/store";
import { usePlayback } from "../../store/playback";
import { measureText } from "../../render/graphics";
import { localTime } from "./model";

export const GRAPHIC_DEFAULT_DURATION = 5;

const overlaps = (seq: Sequence, trackId: string, a: number, b: number) =>
  seq.clips.some((c) => c.trackId === trackId && c.start < b - 1e-6 && clipEnd(c) > a + 1e-6);

/**
 * Premiere places a new graphic on the topmost free video track at the playhead: one track above the
 * highest track that has material in [a, b). With nothing there, the targeted video track (or V1).
 * `minIndex` forces placement at/above a track index (stacking template layers).
 */
export function pickGraphicTrack(seq: Sequence, a: number, b: number, minIndex = 0): Track {
  const vids = tracksOfKind(seq, "video");
  let highest = -1;
  vids.forEach((t, i) => { if (overlaps(seq, t.id, a, b)) highest = i; });
  let idx = Math.max(minIndex, highest + 1);
  if (highest < 0 && minIndex === 0) {
    const tgt = vids.findIndex((t) => t.targeted && !t.locked);
    idx = tgt >= 0 ? tgt : 0;
  }
  while (idx < vids.length && (vids[idx].locked || overlaps(seq, vids[idx].id, a, b))) idx++;
  if (idx < vids.length) return vids[idx];
  return addTrack(seq, "video");
}

export interface Layer {
  gen: Generator;
  name?: string;
  /** Position as a fraction of the frame (0.5,0.5 = center). */
  x?: number;
  y?: number;
  fade?: boolean;
}

/** Insert layers (bottom -> top) as generator clips at the playhead. Returns new clip ids. */
export function insertGraphicLayers(label: string, layers: Layer[], duration = GRAPHIC_DEFAULT_DURATION): string[] {
  const seq0 = getActiveSequence();
  if (!seq0) {
    useEditor.getState().toast("Open a sequence first", "error");
    return [];
  }
  const t0 = snapToFrame(usePlayback.getState().time, seq0.settings.fps);
  const ids: string[] = [];
  useEditor.getState().applySeq(label, (seq) => {
    let minIndex = 0;
    const made: Clip[] = [];
    for (const L of layers) {
      const tr = pickGraphicTrack(seq, t0, t0 + duration, minIndex);
      minIndex = tracksOfKind(seq, "video").findIndex((t) => t.id === tr.id) + 1;
      const c = makeGeneratorClip(L.gen, seq.settings, tr.id, t0, duration, L.name);
      if (c.motion) {
        if (L.x !== undefined) c.motion.positionX.value = Math.round(seq.settings.width * L.x);
        if (L.y !== undefined) c.motion.positionY.value = Math.round(seq.settings.height * L.y);
      }
      if (L.fade && c.opacity) {
        const d = Math.min(0.4, duration / 4);
        c.opacity.opacity.keyframes = [{ t: 0, v: 0, interp: "easeOut" }, { t: d, v: 100, interp: "linear" }, { t: duration - d, v: 100, interp: "easeIn" }, { t: duration, v: 0, interp: "linear" }];
      }
      overwriteClips(seq, [c]);
      made.push(c);
      ids.push(c.id);
    }
  });
  if (ids.length) useEditor.getState().select({ clipIds: ids, transitionId: null, keyframes: [] });
  return ids;
}

export function newText(): void {
  insertGraphicLayers("New Text Layer", [{ gen: { kind: "text", style: defaultTextStyle("Your Title") } }]);
}

export function newShape(shape: "rectangle" | "ellipse"): void {
  const seq = getActiveSequence();
  const h = seq?.settings.height ?? 1080;
  const size = Math.round(h * 0.35);
  insertGraphicLayers(shape === "rectangle" ? "New Rectangle" : "New Ellipse", [
    { gen: { kind: "shape", shape, fill: shape === "rectangle" ? "#d9d9d9" : "#2d8ceb", width: shape === "rectangle" ? Math.round(size * 1.6) : size, height: size, radius: 0 }, name: shape === "rectangle" ? "Rectangle" : "Ellipse" },
  ]);
}

// ---------------------------------------------------------------- alignment

let measureCtx: CanvasRenderingContext2D | null = null;
/** Visible content size (px at sequence res, before Motion scale) of a generator. */
export function contentSize(gen: Generator, W: number, H: number): { w: number; h: number } {
  if (gen.kind === "text") {
    measureCtx ??= document.createElement("canvas").getContext("2d");
    if (!measureCtx) return { w: W, h: H };
    const m = measureText(measureCtx, gen.style);
    const pad = gen.style.background ? gen.style.background.padding * 2 : 0;
    return { w: m.width + pad, h: m.height + pad };
  }
  if (gen.kind === "shape") return { w: gen.width, h: gen.height };
  return { w: W, h: H };
}

export type AlignMode = "center" | "hcenter" | "vcenter" | "left" | "right" | "top" | "bottom";

/** Align selected visual clips in the video frame (sets Position at the playhead). */
export function alignSelected(mode: AlignMode): void {
  const st = useEditor.getState();
  const ids = new Set(st.selection.clipIds);
  if (!ids.size) return st.toast("Select a graphic or clip to align", "error");
  const t = usePlayback.getState().time;
  st.applySeq("Align to Video Frame", (seq) => {
    const W = seq.settings.width, H = seq.settings.height;
    for (const c of seq.clips) {
      if (!ids.has(c.id) || !c.motion) continue;
      const lt = localTime(c, t);
      const sc = evalParam(c.motion.scale, lt) / 100;
      const scw = c.motion.uniformScale ? sc : evalParam(c.motion.scaleWidth, lt) / 100;
      const ax = evalParam(c.motion.anchorX, lt), ay = evalParam(c.motion.anchorY, lt);
      let srcW = W, srcH = H;
      if (c.assetId) {
        const a = st.project.media[c.assetId];
        if (a?.width && a?.height) { srcW = a.width; srcH = a.height; }
      }
      // content box center in source space (generators draw centered in the frame)
      const size = c.generator ? contentSize(c.generator, W, H) : { w: srcW, h: srcH };
      const cx = srcW / 2, cy = srcH / 2;
      const halfW = (size.w / 2) * scw, halfH = (size.h / 2) * sc;
      const offX = (cx - ax) * scw, offY = (cy - ay) * sc; // content center relative to Position
      const setX = (x: number) => setParamAt(c.motion!.positionX, lt, Math.round((x - offX) * 10) / 10);
      const setY = (y: number) => setParamAt(c.motion!.positionY, lt, Math.round((y - offY) * 10) / 10);
      if (mode === "center" || mode === "hcenter") setX(W / 2);
      if (mode === "center" || mode === "vcenter") setY(H / 2);
      if (mode === "left") setX(halfW);
      if (mode === "right") setX(W - halfW);
      if (mode === "top") setY(halfH);
      if (mode === "bottom") setY(H - halfH);
    }
  });
}

// ---------------------------------------------------------------- captions -> graphics

export function upgradeCaptionsToGraphic(): void {
  const st = useEditor.getState();
  const seq0 = getActiveSequence();
  if (!seq0) return;
  const caps = seq0.clips.filter((c) => st.selection.clipIds.includes(c.id) && c.caption);
  const targets = caps.length ? caps : seq0.clips.filter((c) => c.caption);
  if (!targets.length) return st.toast("No caption clips to upgrade", "error");
  const ids: string[] = [];
  st.applySeq("Upgrade Captions to Graphics", (seq) => {
    const H = seq.settings.height;
    const size = Math.round(H * 0.045);
    let track: Track | null = null;
    const a = Math.min(...targets.map((c) => c.start)), b = Math.max(...targets.map(clipEnd));
    track = pickGraphicTrack(seq, a, b);
    for (const cap of targets) {
      const style: TextStyle = {
        ...defaultTextStyle(cap.caption!.text),
        fontSize: size, fontWeight: 600, lineHeight: 1.3,
        shadow: undefined,
        background: { color: "rgba(0,0,0,0.75)", padding: Math.round(size * 0.35), radius: 4 },
      };
      const g = makeGeneratorClip({ kind: "text", style }, seq.settings, track.id, cap.start, cap.duration, cap.caption!.text.slice(0, 40));
      if (g.motion) g.motion.positionY.value = Math.round(H - H * 0.08 - size);
      overwriteClips(seq, [g]);
      ids.push(g.id);
      seq.clips = seq.clips.filter((c) => c.id !== cap.id);
    }
  });
  st.select({ clipIds: ids, transitionId: null, keyframes: [] });
  st.toast(`Upgraded ${ids.length} caption${ids.length > 1 ? "s" : ""} to graphics`, "success");
}

// ---------------------------------------------------------------- title templates

const T = (text: string, o: Partial<TextStyle> = {}): Generator => ({ kind: "text", style: { ...defaultTextStyle(text), ...o } });
const R = (w: number, h: number, fill: string, o: { radius?: number; stroke?: string; strokeWidth?: number; ellipse?: boolean } = {}): Generator =>
  ({ kind: "shape", shape: o.ellipse ? "ellipse" : "rectangle", width: w, height: h, fill, radius: o.radius ?? 0, stroke: o.stroke, strokeWidth: o.strokeWidth });

export interface TitleTemplate {
  id: string;
  name: string;
  description: string;
  build: (W: number, H: number) => Layer[];
}

export const TITLE_TEMPLATES: TitleTemplate[] = [
  {
    id: "lowerThird", name: "Lower Third", description: "Name + role on a colored bar",
    build: (W, H) => [
      { gen: R(W * 0.36, H * 0.13, "#1e5bd8", { radius: 6 }), x: 0.24, y: 0.82, name: "LT Bar", fade: true },
      { gen: R(W * 0.008, H * 0.13, "#ffffff"), x: 0.06, y: 0.82, name: "LT Accent", fade: true },
      { gen: T("Jane Doe", { fontSize: Math.round(H * 0.045), fontWeight: 700, shadow: undefined }), x: 0.2, y: 0.8, name: "LT Name", fade: true },
      { gen: T("Director of Photography", { fontSize: Math.round(H * 0.026), fontWeight: 400, color: "#cfe0ff", shadow: undefined }), x: 0.2, y: 0.855, name: "LT Role", fade: true },
    ],
  },
  {
    id: "bigTitle", name: "Big Centered Title", description: "Large bold headline",
    build: (_W, H) => [{ gen: T("BIG TITLE", { fontSize: Math.round(H * 0.13), fontWeight: 800, letterSpacing: 6 }), fade: true, name: "Title" }],
  },
  {
    id: "titleSub", name: "Title + Subtitle", description: "Headline with a quiet subtitle",
    build: (_W, H) => [
      { gen: T("The Journey", { fontSize: Math.round(H * 0.1), fontWeight: 700 }), y: 0.46, fade: true, name: "Title" },
      { gen: T("A FILM BY EDITCUT", { fontSize: Math.round(H * 0.028), fontWeight: 500, letterSpacing: 8, color: "#d0d0d0", shadow: undefined }), y: 0.57, fade: true, name: "Subtitle" },
    ],
  },
  {
    id: "subscribe", name: "Subscribe Button", description: "Red pill button, bottom right",
    build: (W, H) => [
      { gen: R(W * 0.17, H * 0.075, "#e62117", { radius: Math.round(H * 0.0375) }), x: 0.85, y: 0.88, name: "Button", fade: true },
      { gen: T("SUBSCRIBE", { fontSize: Math.round(H * 0.034), fontWeight: 800, letterSpacing: 2, shadow: undefined }), x: 0.85, y: 0.88, name: "Button Text", fade: true },
    ],
  },
  {
    id: "endCard", name: "End Card", description: "Thanks + two video placeholders",
    build: (W, H) => [
      { gen: R(W, H, "#101318"), name: "End Card BG" },
      { gen: T("Thanks for watching!", { fontSize: Math.round(H * 0.07), fontWeight: 700 }), y: 0.2, name: "End Title", fade: true },
      { gen: R(W * 0.34, H * 0.34, "#252b36", { radius: 10, stroke: "#4a5568", strokeWidth: 3 }), x: 0.29, y: 0.6, name: "Video 1" },
      { gen: R(W * 0.34, H * 0.34, "#252b36", { radius: 10, stroke: "#4a5568", strokeWidth: 3 }), x: 0.71, y: 0.6, name: "Video 2" },
    ],
  },
  {
    id: "quote", name: "Quote", description: "Italic serif quote on a soft box",
    build: (_W, H) => [
      { gen: T("“Simplicity is the ultimate sophistication.”", { fontFamily: "Georgia, 'Times New Roman', serif", fontSize: Math.round(H * 0.05), fontWeight: 400, italic: true, background: { color: "rgba(0,0,0,0.55)", padding: Math.round(H * 0.03), radius: 8 }, shadow: undefined }), fade: true, name: "Quote" },
    ],
  },
  {
    id: "chapter", name: "Chapter Title", description: "Chapter number, title and rule",
    build: (W, H) => [
      { gen: T("CHAPTER ONE", { fontSize: Math.round(H * 0.026), fontWeight: 600, letterSpacing: 10, color: "#e8962c", shadow: undefined }), y: 0.42, fade: true, name: "Chapter" },
      { gen: R(W * 0.12, 3, "#e8962c"), y: 0.465, fade: true, name: "Rule" },
      { gen: T("Beginnings", { fontSize: Math.round(H * 0.085), fontWeight: 700 }), y: 0.54, fade: true, name: "Chapter Title" },
    ],
  },
  {
    id: "news", name: "Breaking News Bar", description: "Full-width bar with label",
    build: (W, H) => [
      { gen: R(W, H * 0.09, "#b00020"), y: 0.9, name: "News Bar" },
      { gen: R(W * 0.18, H * 0.09, "#ffffff"), x: 0.09, y: 0.9, name: "News Label BG" },
      { gen: T("BREAKING", { fontSize: Math.round(H * 0.036), fontWeight: 800, color: "#b00020", shadow: undefined }), x: 0.09, y: 0.9, name: "News Label" },
      { gen: T("Headline text goes here", { fontSize: Math.round(H * 0.036), fontWeight: 600, shadow: undefined }), x: 0.5, y: 0.9, name: "Headline" },
    ],
  },
  {
    id: "neon", name: "Neon Title", description: "Glowing cyan headline",
    build: (_W, H) => [{ gen: T("NEON NIGHTS", { fontSize: Math.round(H * 0.11), fontWeight: 800, color: "#9ff7ff", letterSpacing: 4, shadow: { color: "#00e5ff", blur: 40, offsetX: 0, offsetY: 0 }, strokeColor: "#00b8d4", strokeWidth: 2 }), fade: true, name: "Neon" }],
  },
  {
    id: "handle", name: "Social Handle", description: "@handle in a pill",
    build: (_W, H) => [
      { gen: T("@yourhandle", { fontSize: Math.round(H * 0.04), fontWeight: 700, color: "#111111", background: { color: "#ffffff", padding: Math.round(H * 0.018), radius: Math.round(H * 0.04) }, shadow: undefined }), x: 0.18, y: 0.12, fade: true, name: "Handle" },
    ],
  },
  {
    id: "captionBox", name: "Caption Box", description: "Readable caption on a dark box",
    build: (_W, H) => [{ gen: T("Caption text", { fontSize: Math.round(H * 0.045), fontWeight: 600, background: { color: "rgba(0,0,0,0.75)", padding: Math.round(H * 0.016), radius: 4 }, shadow: undefined }), y: 0.86, name: "Caption" }],
  },
];

export function insertTemplate(tpl: TitleTemplate): void {
  const seq = getActiveSequence();
  if (!seq) return useEditor.getState().toast("Open a sequence first", "error");
  const ids = insertGraphicLayers(`Title Template: ${tpl.name}`, tpl.build(seq.settings.width, seq.settings.height));
  if (ids.length) useEditor.getState().toast(`Added “${tpl.name}” (${ids.length} layer${ids.length > 1 ? "s" : ""})`, "success");
}
