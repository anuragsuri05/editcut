// Transport clock: advances usePlayback.time (program) or sourceTime (source)
// on requestAnimationFrame, with J/K/L shuttle, stopAt (Play In to Out / Play
// Around), loop playback and stop at the end of media.
import { usePlayback } from "../store/playback";
import { getActiveSequence, useEditor } from "../store/store";
import { sequenceDuration } from "@shared/ops";

export type Which = "program" | "source";

export interface TransportInfo {
  duration: number;
  fps: number;
  inPoint?: number;
  outPoint?: number;
}

export function transportInfo(which: Which): TransportInfo {
  if (which === "program") {
    const seq = getActiveSequence();
    if (!seq) return { duration: 0, fps: 30 };
    return { duration: sequenceDuration(seq), fps: seq.settings.fps, inPoint: seq.inPoint, outPoint: seq.outPoint };
  }
  const ed = useEditor.getState();
  const a = ed.sourceAssetId ? ed.project.media[ed.sourceAssetId] : undefined;
  if (!a) return { duration: 0, fps: 30 };
  return { duration: a.duration || 0, fps: a.fps || 30, inPoint: a.inPoint, outPoint: a.outPoint };
}

export const getTime = (which: Which) => (which === "program" ? usePlayback.getState().time : usePlayback.getState().sourceTime);

export function setTime(which: Which, t: number): void {
  const info = transportInfo(which);
  const v = Math.max(0, Math.min(t, Math.max(0, info.duration)));
  if (which === "program") usePlayback.getState().setTime(v);
  else usePlayback.getState().setSourceTime(v);
}

let last = 0;
let returnTo: number | null = null;
let loopInOut = false;
let kHeld = false;
let onPlayStart: (() => void) | null = null;

/** Hook for the engine to create/resume the AudioContext inside the user gesture. */
export function setOnPlayStart(fn: () => void): void {
  onPlayStart = fn;
}

export function installTransportKeys(): void {
  window.addEventListener("keydown", (e) => { if (e.code === "KeyK") kHeld = true; }, true);
  window.addEventListener("keyup", (e) => { if (e.code === "KeyK") kHeld = false; }, true);
  window.addEventListener("blur", () => (kHeld = false));
}

export function play(which: Which, rate = 1, stopAt: number | null = null, opts: { returnTo?: number | null; loopInOut?: boolean } = {}): void {
  const info = transportInfo(which);
  if (info.duration <= 0) return;
  let t = getTime(which);
  // Play from the end restarts at the beginning (or In when looping)
  if (rate > 0 && t >= info.duration - 1 / info.fps && stopAt === null) t = useEditor.getState().loopPlayback && info.inPoint !== undefined ? info.inPoint : 0;
  if (rate < 0 && t <= 0) return;
  setTime(which, t);
  returnTo = opts.returnTo ?? null;
  loopInOut = !!opts.loopInOut;
  last = 0;
  if (usePlayback.getState().playing !== which) usePlayback.getState().set({ droppedFrames: 0 });
  usePlayback.getState().play(which, rate, stopAt);
  onPlayStart?.();
}

export function stop(): void {
  const s = usePlayback.getState();
  if (!s.playing) return;
  const which = s.playing;
  const info = transportInfo(which);
  s.stop();
  // park on a frame boundary
  setTime(which, Math.round(getTime(which) * info.fps) / info.fps);
  returnTo = null;
  loopInOut = false;
}

export function toggle(which: Which): void {
  const s = usePlayback.getState();
  if (s.playing) stop();
  else play(which, 1);
}

/** L (dir=1) / J (dir=-1). */
export function shuttle(which: Which, dir: 1 | -1): void {
  const s = usePlayback.getState();
  if (kHeld) return play(which, 0.25 * dir);
  if (s.playing === which && Math.sign(s.rate) === dir && Math.abs(s.rate) >= 1) {
    return play(which, dir * Math.min(8, Math.abs(s.rate) * 2), s.stopAt);
  }
  play(which, dir);
}

/** Shift+L / Shift+J: slow shuttle that adds ±10% per press. */
export function shuttleSlow(which: Which, dir: 1 | -1): void {
  const s = usePlayback.getState();
  const cur = s.playing === which ? s.rate : 0;
  let r = Math.round((cur + 0.1 * dir) * 10) / 10;
  if (r === 0) return stop();
  r = Math.max(-8, Math.min(8, r));
  play(which, r);
}

export function step(which: Which, frames: number): void {
  if (usePlayback.getState().playing) stop();
  const info = transportInfo(which);
  const f = Math.round(getTime(which) * info.fps) + frames;
  setTime(which, f / info.fps);
}

export function goTo(which: Which, t: number): void {
  if (usePlayback.getState().playing) stop();
  setTime(which, t);
}

export function playInToOut(which: Which): void {
  const info = transportInfo(which);
  const a = info.inPoint ?? 0;
  const b = info.outPoint ?? info.duration;
  if (b <= a) return;
  if (usePlayback.getState().playing) stop();
  setTime(which, a);
  play(which, 1, b, { loopInOut: true });
}

export function playAround(which: Which): void {
  const pre = useEditor.getState().preroll ?? 2;
  const t = getTime(which);
  if (usePlayback.getState().playing) stop();
  setTime(which, Math.max(0, t - pre));
  play(which, 1, t + pre, { returnTo: t });
}

/** Advance the clock. Returns true if time changed. */
export function tick(now: number): boolean {
  const s = usePlayback.getState();
  if (!s.playing || s.scrubbing) {
    last = 0;
    return false;
  }
  const which = s.playing;
  const dt = last ? Math.min(0.25, (now - last) / 1000) : 0;
  const info = transportInfo(which);
  if (last && dt > 2.5 / 60) s.set({ droppedFrames: s.droppedFrames + Math.max(1, Math.round(dt * Math.min(info.fps, 60)) - 1) });
  last = now;
  if (dt === 0) return false;
  const t = getTime(which);
  let nt = t + dt * s.rate;
  const loop = useEditor.getState().loopPlayback;
  const finish = (at: number) => {
    s.stop();
    setTime(which, at);
    returnTo = null;
    loopInOut = false;
  };
  if (s.rate > 0) {
    if (s.stopAt !== null && nt >= s.stopAt) {
      if (loop && loopInOut) nt = info.inPoint ?? 0;
      else return finish(returnTo ?? s.stopAt), true;
    } else if (loop) {
      const loopEnd = info.outPoint !== undefined && t <= info.outPoint + 1e-6 ? info.outPoint : info.duration;
      const loopStart = info.inPoint !== undefined && info.inPoint < loopEnd ? info.inPoint : 0;
      if (nt >= loopEnd) nt = loopStart;
    } else if (nt >= info.duration) return finish(info.duration), true;
  } else {
    if (loop) {
      const loopStart = info.inPoint !== undefined && t >= info.inPoint - 1e-6 ? info.inPoint : 0;
      const loopEnd = info.outPoint !== undefined && info.outPoint > loopStart ? info.outPoint : info.duration;
      if (nt <= loopStart) nt = loopEnd;
    } else if (nt <= 0) return finish(0), true;
  }
  setTime(which, nt);
  return true;
}
