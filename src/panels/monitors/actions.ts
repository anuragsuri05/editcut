/// <reference types="vite/client" />
// Monitor actions shared by buttons, commands and menus.
import type { MediaAsset } from "@shared/types";
import { makeMarker } from "@shared/factory";
import { placeAsset, editPoints, clipEnd, sequenceDuration, lift, extract } from "@shared/ops";
import { getCommand, runCommand } from "../../commands/registry";
import { usePlayback } from "../../store/playback";
import { getActiveSequence, useEditor } from "../../store/store";
import { renderSequenceFrame, transport } from "../../engine";
import { api } from "../../api";
import { waitForFrame } from "../../engine/media";

export const ed = () => useEditor.getState();
export const pb = () => usePlayback.getState();

export function getSourceAsset(): MediaAsset | null {
  const s = ed();
  return s.sourceAssetId ? s.project.media[s.sourceAssetId] ?? null : null;
}

/** Run a command registered by another module, or a local fallback when it isn't registered (yet). */
export function runOr(id: string, fallback: () => void): void {
  if (getCommand(id)) runCommand(id);
  else fallback();
}

const frameOf = (fps: number, t: number) => Math.round(t * fps) / fps;

// ---------------------------------------------------------------- source In/Out/markers

export function sourceSetIn(t = pb().sourceTime): void {
  const a = getSourceAsset();
  if (!a) return;
  const v = frameOf(a.fps || 30, t);
  ed().apply("Mark In", (d) => {
    const m = d.media[a.id];
    m.inPoint = v;
    if (m.outPoint !== undefined && m.outPoint <= v) m.outPoint = undefined;
  });
}

export function sourceSetOut(t = pb().sourceTime): void {
  const a = getSourceAsset();
  if (!a) return;
  const v = frameOf(a.fps || 30, t);
  ed().apply("Mark Out", (d) => {
    const m = d.media[a.id];
    m.outPoint = v;
    if (m.inPoint !== undefined && m.inPoint >= v) m.inPoint = undefined;
  });
}

export function sourceClear(which: "in" | "out" | "both"): void {
  const a = getSourceAsset();
  if (!a) return;
  ed().apply(which === "both" ? "Clear In and Out" : which === "in" ? "Clear In" : "Clear Out", (d) => {
    const m = d.media[a.id];
    if (which !== "out") m.inPoint = undefined;
    if (which !== "in") m.outPoint = undefined;
  });
}

export function sourceAddMarker(): void {
  const a = getSourceAsset();
  if (!a) return;
  const t = frameOf(a.fps || 30, pb().sourceTime);
  if (a.markers?.some((m) => Math.abs(m.time - t) < 1e-3)) return;
  ed().apply("Add Marker", (d) => {
    const m = d.media[a.id];
    m.markers = [...(m.markers ?? []), makeMarker(t)];
  });
}

export function sourceGoToMarker(dir: 1 | -1): void {
  const a = getSourceAsset();
  if (!a) return;
  const t = pb().sourceTime;
  const times = (a.markers ?? []).map((m) => m.time).sort((x, y) => x - y);
  const next = dir > 0 ? times.find((x) => x > t + 1e-3) : [...times].reverse().find((x) => x < t - 1e-3);
  if (next !== undefined) transport.goTo("source", next);
}

// ---------------------------------------------------------------- program fallbacks (timeline owns markers.*)

export function programSetIn(): void {
  runOr("markers.markIn", () => {
    const t = pb().time;
    ed().applySeq("Mark In", (s) => {
      s.inPoint = frameOf(s.settings.fps, t);
      if (s.outPoint !== undefined && s.outPoint <= s.inPoint) s.outPoint = undefined;
    });
  });
}

export function programSetOut(): void {
  runOr("markers.markOut", () => {
    const t = pb().time;
    ed().applySeq("Mark Out", (s) => {
      s.outPoint = frameOf(s.settings.fps, t);
      if (s.inPoint !== undefined && s.inPoint >= s.outPoint) s.inPoint = undefined;
    });
  });
}

export function programGoTo(which: "in" | "out"): void {
  runOr(which === "in" ? "markers.goToIn" : "markers.goToOut", () => {
    const s = getActiveSequence();
    const v = which === "in" ? s?.inPoint : s?.outPoint;
    if (v !== undefined) transport.goTo("program", v);
  });
}

export function programAddMarker(): void {
  runOr("markers.addMarker", () => {
    const t = pb().time;
    ed().applySeq("Add Marker", (s) => {
      s.markers.push(makeMarker(frameOf(s.settings.fps, t)));
    });
  });
}

export function programClear(which: "in" | "out" | "both"): void {
  const id = which === "both" ? "markers.clearInOut" : which === "in" ? "markers.clearIn" : "markers.clearOut";
  runOr(id, () =>
    ed().applySeq("Clear In/Out", (s) => {
      if (which !== "out") s.inPoint = undefined;
      if (which !== "in") s.outPoint = undefined;
    }),
  );
}

export function programMarkClip(): void {
  runOr("markers.markClip", () => {
    const s = getActiveSequence();
    if (!s) return;
    const t = pb().time;
    const targeted = s.tracks.filter((tr) => tr.targeted).map((tr) => tr.id);
    const c = s.clips.find((c) => (targeted.length ? targeted.includes(c.trackId) : true) && t >= c.start && t < clipEnd(c));
    if (c) ed().applySeq("Mark Clip", (d) => { d.inPoint = c.start; d.outPoint = clipEnd(c); });
  });
}

export function goToEdit(dir: 1 | -1): void {
  runOr(dir > 0 ? "sequence.goToNextEdit" : "sequence.goToPrevEdit", () => {
    const s = getActiveSequence();
    if (!s) return;
    const t = pb().time;
    const pts = editPoints(s);
    const v = dir > 0 ? pts.find((x) => x > t + 1e-4) : [...pts].reverse().find((x) => x < t - 1e-4);
    if (v !== undefined) transport.goTo("program", Math.min(v, sequenceDuration(s)));
  });
}

export function programGoToMarker(dir: 1 | -1): void {
  runOr(dir > 0 ? "markers.goToNextMarker" : "markers.goToPrevMarker", () => {
    const s = getActiveSequence();
    if (!s) return;
    const t = pb().time;
    const times = s.markers.map((m) => m.time).sort((a, b) => a - b);
    const v = dir > 0 ? times.find((x) => x > t + 1e-3) : [...times].reverse().find((x) => x < t - 1e-3);
    if (v !== undefined) transport.goTo("program", v);
  });
}

export function programLiftExtract(kind: "lift" | "extract"): void {
  runOr(kind === "lift" ? "sequence.lift" : "sequence.extract", () => {
    const s = getActiveSequence();
    if (!s || s.inPoint === undefined || s.outPoint === undefined || s.outPoint <= s.inPoint) return ed().toast("Set In and Out points first", "error");
    const a = s.inPoint, b = s.outPoint;
    ed().applySeq(kind === "lift" ? "Lift" : "Extract", (d) => {
      const targeted = d.tracks.filter((t) => t.targeted && t.kind !== "caption").map((t) => t.id);
      const ids = targeted.length ? targeted : d.tracks.map((t) => t.id);
      if (kind === "lift") lift(d, a, b, ids);
      else extract(d, a, b, ids);
      d.inPoint = undefined;
      d.outPoint = undefined;
    });
    if (kind === "extract") transport.goTo("program", a);
  });
}

// ---------------------------------------------------------------- insert / overwrite from source

type EditingModule = { insertFromSource?: (mode: "insert" | "overwrite") => unknown };
const editingModules = import.meta.glob<EditingModule>("../timeline/editing.ts");

export async function sourceEdit(mode: "insert" | "overwrite"): Promise<void> {
  const loader = editingModules["../timeline/editing.ts"];
  if (loader) {
    try {
      const m = await loader();
      if (typeof m.insertFromSource === "function") {
        m.insertFromSource(mode);
        return;
      }
    } catch (e) {
      console.warn("timeline editing module failed to load; using fallback", e);
    }
  }
  fallbackSourceEdit(mode);
}

function fallbackSourceEdit(mode: "insert" | "overwrite"): void {
  const a = getSourceAsset();
  const s = ed();
  const seq = getActiveSequence();
  if (!a) return s.toast("Load a clip in the Source Monitor first", "error");
  if (!seq) return s.toast("Open a sequence first", "error");
  const at = seq.inPoint ?? pb().time;
  let placedEnd = at;
  s.applySeq(mode === "insert" ? "Insert" : "Overwrite", (d) => {
    const clips = placeAsset(d, a, {
      at, mode,
      videoTrackIndex: s.patchVideo ?? 0, audioTrackIndex: s.patchAudio ?? 0,
      includeVideo: s.patchVideo !== null, includeAudio: s.patchAudio !== null,
    });
    placedEnd = Math.max(at, ...clips.map(clipEnd));
  });
  transport.goTo("program", placedEnd);
}

// ---------------------------------------------------------------- export frame

export async function frameCanvas(which: "program" | "source"): Promise<HTMLCanvasElement | null> {
  if (which === "program") {
    const seq = getActiveSequence();
    if (!seq) return null;
    return renderSequenceFrame(seq, pb().time, null, { width: seq.settings.width, height: seq.settings.height });
  }
  const a = getSourceAsset();
  if (!a) return null;
  const c = document.createElement("canvas");
  if (a.kind === "image") {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = a.url;
    await img.decode().catch(() => undefined);
    c.width = img.naturalWidth || a.width || 1920;
    c.height = img.naturalHeight || a.height || 1080;
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c;
  }
  if (!a.hasVideo) return null;
  // decode the ORIGINAL media at full resolution
  const v = document.createElement("video");
  v.crossOrigin = "anonymous";
  v.muted = true;
  v.preload = "auto";
  v.src = a.url;
  v.currentTime = pb().sourceTime + 0.001;
  await waitForFrame(v, 5000);
  c.width = v.videoWidth || a.width || 1920;
  c.height = v.videoHeight || a.height || 1080;
  c.getContext("2d")!.drawImage(v, 0, 0, c.width, c.height);
  v.removeAttribute("src");
  v.load();
  return c;
}

export async function exportFrame(which: "program" | "source", name: string, format: "jpeg" | "png", importIntoProject: boolean): Promise<void> {
  const s = ed();
  try {
    const c = await frameCanvas(which);
    if (!c) return s.toast("Nothing to export", "error");
    const mime = format === "png" ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob | null>((res) => c.toBlob(res, mime, 0.95));
    if (!blob) return s.toast("Export Frame failed", "error");
    const file = `${name.replace(/[\\/:*?"<>|]/g, "_") || "Frame"}.${format === "png" ? "png" : "jpg"}`;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = file;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    if (importIntoProject) {
      const assets = await api.uploadMedia([new File([blob], file, { type: mime })]);
      s.apply("Import Frame", (d) => {
        for (const a of assets) {
          d.media[a.id] = a;
          if (!d.items.some((i) => i.id === a.id)) d.items.push({ id: a.id, type: "media", name: a.name, parentId: null });
        }
      });
    }
    s.toast(`Exported ${file}`, "success");
  } catch (e) {
    s.toast(`Export Frame failed: ${(e as Error).message}`, "error");
  }
}

export function openExportFrame(which: "program" | "source" = ed().focusedMonitor): void {
  const seq = getActiveSequence();
  const a = getSourceAsset();
  const base = which === "program" ? seq?.name ?? "Sequence" : a?.name.replace(/\.[^.]+$/, "") ?? "Clip";
  ed().openDialog("monitor.exportFrame", { which, defaultName: `${base} Still` });
}
