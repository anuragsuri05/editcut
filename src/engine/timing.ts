// Pure helpers: what is visible/audible at time t, transition progress, audio
// crossfade curves, motion transforms. No DOM, unit-testable.

import type { Clip, MotionProps, Project, Sequence, Track, Transition } from "@shared/types";
import { TRANSITION_MAP } from "@shared/effects";
import { evalParam } from "@shared/params";
import { clipEnd, transitionSpan } from "@shared/ops";
import { EPS } from "@shared/time";

export const isVideoTransition = (tr: Transition) => (TRANSITION_MAP[tr.type]?.kind ?? "video") === "video";

/** Source media time for a clip at timeline time t, NOT clamped to the clip (uses handles), clamped to [0, mediaDur]. */
export function sourceTimeUnclamped(clip: Clip, t: number, mediaDuration = Infinity): number {
  const local = t - clip.start;
  const s = clip.reversed ? clip.sourceIn + (clip.duration - local) * clip.speed : clip.sourceIn + local * clip.speed;
  return Math.min(Math.max(s, 0), Math.max(0, mediaDuration - 1e-3));
}

/** Timeline range during which the clip must be decoded/played: clip range extended by attached transitions. */
export function clipPlayRange(seq: Sequence, clip: Clip): [number, number] {
  let s = clip.start, e = clipEnd(clip);
  for (const tr of seq.transitions) {
    if (tr.clipAId !== clip.id && tr.clipBId !== clip.id) continue;
    const [a, b] = transitionSpan(tr);
    s = Math.min(s, a);
    e = Math.max(e, b);
  }
  return [s, e];
}

/** Transition progress 0..1 at time t (clamped). */
export function transitionProgress(tr: Transition, t: number): number {
  const [s, e] = transitionSpan(tr);
  if (e - s <= EPS) return 1;
  return Math.min(1, Math.max(0, (t - s) / (e - s)));
}

export type DrawItem =
  | { kind: "clip"; clip: Clip }
  | { kind: "transition"; transition: Transition; a?: Clip; b?: Clip; progress: number };

/**
 * What to draw on one video/caption track at time t. A transition covering t
 * replaces its clips (it draws both A and B itself).
 */
export function trackDrawItem(seq: Sequence, track: Track, t: number): DrawItem | null {
  for (const tr of seq.transitions) {
    if (tr.trackId !== track.id || !isVideoTransition(tr)) continue;
    const [s, e] = transitionSpan(tr);
    if (t < s - EPS || t >= e - EPS) continue;
    const a = tr.clipAId ? seq.clips.find((c) => c.id === tr.clipAId) : undefined;
    const b = tr.clipBId ? seq.clips.find((c) => c.id === tr.clipBId) : undefined;
    if (!a && !b) continue;
    return {
      kind: "transition", transition: tr,
      a: a && a.enabled ? a : undefined, b: b && b.enabled ? b : undefined,
      progress: transitionProgress(tr, t),
    };
  }
  const clip = seq.clips.find((c) => c.trackId === track.id && t >= c.start - EPS && t < clipEnd(c) - EPS);
  if (!clip || !clip.enabled) return null;
  return { kind: "clip", clip };
}

/** Visual tracks in compositing order (bottom → top): video tracks, then caption tracks. */
export function visualTracks(seq: Sequence): Track[] {
  return [...seq.tracks.filter((t) => t.kind === "video"), ...seq.tracks.filter((t) => t.kind === "caption")];
}

// ---------------------------------------------------------------- audio

export type CrossfadeCurve = "constantPower" | "constantGain" | "exponentialFade";

/** Gain of the incoming side at progress p (outgoing side uses 1-p). */
export function fadeInGain(curve: CrossfadeCurve | string, p: number): number {
  p = Math.min(1, Math.max(0, p));
  switch (curve) {
    case "constantPower": return Math.sin((p * Math.PI) / 2);
    case "exponentialFade": return p === 0 ? 0 : Math.pow(p, 2.5);
    default: return p;
  }
}

/** Combined transition gain multiplier for an audio clip at time t. */
export function audioTransitionGain(seq: Sequence, clip: Clip, t: number): number {
  let g = 1;
  for (const tr of seq.transitions) {
    if (tr.trackId !== clip.trackId) continue;
    const isA = tr.clipAId === clip.id, isB = tr.clipBId === clip.id;
    if (!isA && !isB) continue;
    const [s, e] = transitionSpan(tr);
    if (t < s - EPS || t > e + EPS) {
      // outside the span: A is silent after, B silent before
      if (isA && !isB && t > e) g = 0;
      if (isB && !isA && t < s) g = 0;
      continue;
    }
    const p = transitionProgress(tr, t);
    const curve = TRANSITION_MAP[tr.type]?.kind === "audio" ? tr.type : "constantPower";
    g *= isA ? fadeInGain(curve, 1 - p) : fadeInGain(curve, p);
  }
  return g;
}

export const dbToGain = (db: number) => (db <= -96 ? 0 : Math.pow(10, db / 20));
export const gainToDb = (g: number) => (g <= 1e-6 ? -Infinity : 20 * Math.log10(g));

/** Track audibility with solo logic. */
export function trackAudible(seq: Sequence, track: Track): boolean {
  if (track.muted) return false;
  const anySolo = seq.tracks.some((t) => t.kind === "audio" && t.solo);
  return !anySolo || track.solo;
}

// ---------------------------------------------------------------- geometry

/** 2D affine [a b c d e f]: x' = a*x + c*y + e ; y' = b*x + d*y + f */
export type Affine = [number, number, number, number, number, number];

export const affMul = (m: Affine, n: Affine): Affine => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];

export function affInv(m: Affine): Affine {
  const det = m[0] * m[3] - m[1] * m[2] || 1e-12;
  const a = m[3] / det, b = -m[1] / det, c = -m[2] / det, d = m[0] / det;
  return [a, b, c, d, -(a * m[4] + c * m[5]), -(b * m[4] + d * m[5])];
}

export const affApply = (m: Affine, x: number, y: number): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

export interface MotionValues {
  x: number; y: number; sx: number; sy: number; rot: number; ax: number; ay: number;
  cl: number; cr: number; ct: number; cb: number; // crop fractions 0..1
}

/** Evaluate motion at clip-local time. srcW/H = source frame size (for default anchor). */
export function evalMotion(m: MotionProps | undefined, local: number, srcW: number, srcH: number, seqW: number, seqH: number): MotionValues {
  if (!m) return { x: seqW / 2, y: seqH / 2, sx: 1, sy: 1, rot: 0, ax: srcW / 2, ay: srcH / 2, cl: 0, cr: 0, ct: 0, cb: 0 };
  const scale = evalParam(m.scale, local, 100) / 100;
  const sw = m.uniformScale ? scale : evalParam(m.scaleWidth, local, 100) / 100;
  return {
    x: evalParam(m.positionX, local, seqW / 2), y: evalParam(m.positionY, local, seqH / 2),
    sx: sw, sy: scale, rot: evalParam(m.rotation, local, 0),
    ax: evalParam(m.anchorX, local, srcW / 2), ay: evalParam(m.anchorY, local, srcH / 2),
    cl: clamp01(evalParam(m.cropLeft, local, 0) / 100), cr: clamp01(evalParam(m.cropRight, local, 0) / 100),
    ct: clamp01(evalParam(m.cropTop, local, 0) / 100), cb: clamp01(evalParam(m.cropBottom, local, 0) / 100),
  };
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Source pixel (y down) → sequence pixel (y down). Premiere: position is where the anchor lands; rotation clockwise. */
export function motionMatrix(v: MotionValues): Affine {
  const r = (v.rot * Math.PI) / 180;
  const cs = Math.cos(r), sn = Math.sin(r);
  // seq = pos + R * S * (src - anchor)
  const a = cs * v.sx, b = sn * v.sx, c = -sn * v.sy, d = cs * v.sy;
  return [a, b, c, d, v.x - (a * v.ax + c * v.ay), v.y - (b * v.ax + d * v.ay)];
}

/**
 * Matrix mapping destination GL pixel coords (origin bottom-left of a target
 * canvas of size W×H showing the sequence at `scale` px per seq px) → layer uv
 * (GL orientation, uv.y = 1 is the top of the source).
 */
export function layerUvMatrix(motion: Affine, srcW: number, srcH: number, scale: number, targetH: number): Affine {
  // gl px -> seq px: x/scale, (H - y)/scale
  const glToSeq: Affine = [1 / scale, 0, 0, -1 / scale, 0, targetH / scale];
  const seqToSrc = affInv(motion);
  // src px -> uv: (x/srcW, 1 - y/srcH)
  const srcToUv: Affine = [1 / srcW, 0, 0, -1 / srcH, 0, 1];
  return affMul(srcToUv, affMul(seqToSrc, glToSeq));
}

/** Column-major mat3 for uniformMatrix3fv. */
export const affToMat3 = (m: Affine): Float32Array => new Float32Array([m[0], m[1], 0, m[2], m[3], 0, m[4], m[5], 1]);

/** Quad corners of the (cropped) source rect in sequence pixels: TL, TR, BR, BL. */
export function clipQuad(v: MotionValues, srcW: number, srcH: number, box?: { x: number; y: number; w: number; h: number }): [number, number][] {
  const m = motionMatrix(v);
  const bx = box ?? { x: 0, y: 0, w: srcW, h: srcH };
  const x0 = Math.max(bx.x, v.cl * srcW), x1 = Math.min(bx.x + bx.w, srcW - v.cr * srcW);
  const y0 = Math.max(bx.y, v.ct * srcH), y1 = Math.min(bx.y + bx.h, srcH - v.cb * srcH);
  return [affApply(m, x0, y0), affApply(m, x1, y0), affApply(m, x1, y1), affApply(m, x0, y1)];
}

/** Point-in-convex/concave quad test. */
export function pointInPoly(pts: [number, number][], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Natural source frame size of a visual clip. */
export function clipSourceSize(project: Project, seq: Sequence, clip: Clip): { w: number; h: number } {
  if (clip.assetId) {
    const a = project.media[clip.assetId];
    if (a?.width && a?.height) return { w: a.width, h: a.height };
  }
  if (clip.sequenceId) {
    const s = project.sequences[clip.sequenceId];
    if (s) return { w: s.settings.width, h: s.settings.height };
  }
  return { w: seq.settings.width, h: seq.settings.height };
}
