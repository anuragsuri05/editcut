// Timeline zoom / scroll helpers. Zoom lives in the editor store (pxPerSec,
// scrollTime) so other panels (AI, monitors) can read it.
import { sequenceDuration } from "@shared/ops";
import { editor, getActiveSequence } from "../../store/store";
import { tl } from "./state";

export const MIN_PPS = 0.01;
export const MAX_PPS = 3000;
export const HEADER_WIDTH = 188;

export function maxPps(): number {
  const fps = getActiveSequence()?.settings.fps ?? 30;
  return Math.min(MAX_PPS, fps * 60); // ~60px per frame max
}

export function setZoom(pxPerSec: number, anchorTime?: number, anchorX?: number): void {
  const st = editor();
  const pps = Math.min(maxPps(), Math.max(MIN_PPS, pxPerSec));
  const w = tl().viewWidth;
  const aT = anchorTime ?? st.scrollTime + w / 2 / st.pxPerSec;
  const aX = anchorX ?? (aT - st.scrollTime) * st.pxPerSec;
  st.setUI({ pxPerSec: pps, scrollTime: Math.max(0, aT - aX / pps) });
}

export function zoomBy(factor: number, anchorTime?: number, anchorX?: number): void {
  setZoom(editor().pxPerSec * factor, anchorTime, anchorX);
}

/** Zoom keeping the playhead in view (= / - keys, Premiere zooms around the playhead). */
export function zoomAroundPlayhead(factor: number, playhead: number): void {
  const st = editor();
  const w = tl().viewWidth;
  const x = (playhead - st.scrollTime) * st.pxPerSec;
  if (x >= 0 && x <= w) zoomBy(factor, playhead, x);
  else zoomBy(factor, playhead, w / 2);
}

/** "\" toggles between showing the whole sequence and the previous zoom. */
export function zoomToFit(toggle = true): void {
  const st = editor();
  const seq = getActiveSequence();
  const t = tl();
  if (toggle && t.prevZoom) {
    const { pxPerSec, scrollTime } = t.prevZoom;
    t.set({ prevZoom: null });
    st.setUI({ pxPerSec, scrollTime });
    return;
  }
  const dur = Math.max(seq ? sequenceDuration(seq) : 0, 5);
  const pps = Math.min(maxPps(), Math.max(MIN_PPS, (t.viewWidth - 24) / dur));
  if (toggle) t.set({ prevZoom: { pxPerSec: st.pxPerSec, scrollTime: st.scrollTime } });
  st.setUI({ pxPerSec: pps, scrollTime: 0 });
}

export function scrollBy(seconds: number): void {
  const st = editor();
  st.setUI({ scrollTime: Math.max(0, st.scrollTime + seconds) });
}

/** Ensure a time is visible (page scroll like Premiere's default auto-scroll). */
export function ensureVisible(t: number, page = true): void {
  const st = editor();
  const span = tl().viewWidth / st.pxPerSec;
  if (t < st.scrollTime) st.setUI({ scrollTime: Math.max(0, page ? t - span * 0.05 : t) });
  else if (t > st.scrollTime + span) st.setUI({ scrollTime: page ? t - span * 0.05 : t - span });
}

/** Pick a "nice" ruler step (seconds) so labels are ~minPx apart. */
export function rulerSteps(pps: number, fps: number): { major: number; minor: number } {
  const frame = 1 / fps;
  const candidates = [frame, 2 * frame, 5 * frame, 10 * frame, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200];
  const minPx = 90;
  const major = candidates.find((c) => c * pps >= minPx) ?? 7200;
  const sub = major <= frame * 10 ? frame : major / (major >= 60 ? 6 : major >= 10 ? 5 : major >= 1 ? 4 : 5);
  const minor = sub * pps >= 6 ? sub : major / 2;
  return { major, minor };
}
