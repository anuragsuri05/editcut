// Helpers shared by the inspector panels: addressing animatable params on a clip by
// a string path, playhead-relative editing, selection lookups and effect chains.
//
// Param paths:
//   "motion.<key>"        MotionProps params (positionX, scale, rotation, cropLeft...)
//   "opacity.opacity"
//   "audio.volumeDb" | "audio.pan"
//   "fx.<effectId>.<paramKey>"
import type { Clip, Effect, Keyframe, Param, Project, Sequence, Track } from "@shared/types";
import { EFFECT_MAP } from "@shared/effects";
import { evalParam, isAnimated, setParamAt, toggleAnimation } from "@shared/params";
import { makeEffect } from "@shared/factory";
import { useEditor, getActiveSequence } from "../../store/store";
import { usePlayback } from "../../store/playback";
import { commitSeq, liveSeq } from "./liveEdit";

export function getParam(clip: Clip, path: string): Param | undefined {
  const [head, a, b] = path.split(".");
  if (head === "motion") return clip.motion ? ((clip.motion as unknown as Record<string, Param>)[a] as Param | undefined) : undefined;
  if (head === "opacity") return clip.opacity?.opacity;
  if (head === "audio") return clip.audio ? ((clip.audio as unknown as Record<string, Param>)[a] as Param | undefined) : undefined;
  if (head === "fx") {
    const fx = clip.effects.find((e) => e.id === a);
    if (!fx) return undefined;
    if (!fx.params[b]) {
      const def = EFFECT_MAP[fx.type]?.params.find((p) => p.key === b);
      if (!def) return undefined;
      // Effects created before a param was added to the registry: materialize lazily (only on drafts).
      if (Object.isFrozen(fx.params)) return { value: def.default };
      fx.params[b] = { value: def.default };
    }
    return fx.params[b];
  }
  return undefined;
}

export function paramDefault(clip: Clip, path: string, seq?: Sequence | null): number {
  const [head, a, b] = path.split(".");
  if (head === "fx") {
    const fx = clip.effects.find((e) => e.id === a);
    return EFFECT_MAP[fx?.type ?? ""]?.params.find((p) => p.key === b)?.default ?? 0;
  }
  if (head === "opacity") return 100;
  if (head === "audio") return 0;
  if (head === "motion") {
    const s = seq ?? getActiveSequence();
    const W = s?.settings.width ?? 1920, H = s?.settings.height ?? 1080;
    switch (a) {
      case "positionX": return W / 2;
      case "positionY": return H / 2;
      case "scale": case "scaleWidth": return 100;
      case "anchorX": return sourceSize(clip).w / 2;
      case "anchorY": return sourceSize(clip).h / 2;
      default: return 0;
    }
  }
  return 0;
}

/** Native pixel size of a clip's source (sequence size for generators). */
export function sourceSize(clip: Clip): { w: number; h: number } {
  const st = useEditor.getState();
  const seq = getActiveSequence();
  const W = seq?.settings.width ?? 1920, H = seq?.settings.height ?? 1080;
  if (clip.assetId) {
    const a = st.project.media[clip.assetId];
    if (a?.width && a?.height) return { w: a.width, h: a.height };
  }
  return { w: W, h: H };
}

/** Clip-local time of the program playhead, clamped into the clip. */
export function localTime(clip: Clip, t = usePlayback.getState().time): number {
  return Math.min(Math.max(t - clip.start, 0), clip.duration);
}

export function valueAt(clip: Clip, path: string, t = usePlayback.getState().time): number {
  return evalParam(getParam(clip, path), localTime(clip, t), paramDefault(clip, path));
}

// ---------------------------------------------------------------- selection

export function selectedClips(seq: Sequence | null, ids: string[]): Clip[] {
  if (!seq) return [];
  const set = new Set(ids);
  return seq.clips.filter((c) => set.has(c.id));
}

export function trackOf(seq: Sequence, clip: Clip): Track | undefined {
  return seq.tracks.find((t) => t.id === clip.trackId);
}

export function isVisual(seq: Sequence, clip: Clip): boolean {
  return trackOf(seq, clip)?.kind === "video" && !!clip.motion;
}

export function isAudio(seq: Sequence, clip: Clip): boolean {
  return trackOf(seq, clip)?.kind === "audio";
}

// ---------------------------------------------------------------- editing params

function findClip(seq: Sequence, id: string) {
  return seq.clips.find((c) => c.id === id);
}

/** Set a param at the playhead on the given clips (keyframe if animated). Live (no history). */
export function setParamLive(clipIds: string[], path: string, v: number, extra?: (c: Clip) => void): void {
  const t = usePlayback.getState().time;
  liveSeq((seq) => {
    for (const id of clipIds) {
      const c = findClip(seq, id);
      const p = c && getParam(c, path);
      if (c && p) setParamAt(p, localTime(c, t), v);
      if (c && extra) extra(c);
    }
  });
}

export function setParamCommit(clipIds: string[], path: string, v: number, label: string, extra?: (c: Clip) => void): void {
  const t = usePlayback.getState().time;
  commitSeq(label, (seq) => {
    for (const id of clipIds) {
      const c = findClip(seq, id);
      const p = c && getParam(c, path);
      if (c && p) setParamAt(p, localTime(c, t), v);
      if (c && extra) extra(c);
    }
  });
}

/** onChange/onCommit pair for a param on clips. */
export function paramHandlers(clipIds: string[], path: string, label: string) {
  return {
    onChange: (v: number) => setParamLive(clipIds, path, v),
    onCommit: (v: number) => setParamCommit(clipIds, path, v, label),
  };
}

/** Stopwatch: toggle animation of one or more paths (vector params toggle together). */
export function toggleAnim(clipId: string, paths: string[], label = "Toggle Animation"): void {
  const t = usePlayback.getState().time;
  useEditor.getState().applySeq(label, (seq) => {
    const c = findClip(seq, clipId);
    if (!c) return;
    const lt = localTime(c, t);
    const on = paths.some((p) => isAnimated(getParam(c, p)));
    for (const path of paths) {
      const p = getParam(c, path);
      if (!p) continue;
      if (on === isAnimated(p)) toggleAnimation(p, lt);
      else if (!on) toggleAnimation(p, lt);
    }
  });
}

const KF_TOL = 1 / 240;

/** ◆ button: add a keyframe at the playhead (or remove the one there). */
export function toggleKeyframeAtPlayhead(clipId: string, paths: string[]): void {
  const t = usePlayback.getState().time;
  useEditor.getState().applySeq("Add/Remove Keyframe", (seq) => {
    const c = findClip(seq, clipId);
    if (!c) return;
    const lt = localTime(c, t);
    const has = paths.some((path) => getParam(c, path)?.keyframes?.some((k) => Math.abs(k.t - lt) < KF_TOL * 4));
    for (const path of paths) {
      const p = getParam(c, path);
      if (!p) continue;
      if (has) {
        p.keyframes = (p.keyframes ?? []).filter((k) => Math.abs(k.t - lt) >= KF_TOL * 4);
        if (p.keyframes.length === 0) p.value = evalParam({ value: p.value }, lt);
      } else {
        const v = evalParam(p, lt);
        p.keyframes = [...(p.keyframes ?? []), { t: lt, v, interp: "linear" as const }].sort((a, b) => a.t - b.t);
      }
    }
  });
}

export function keyframeTimes(clip: Clip, paths: string[]): number[] {
  const ts: number[] = [];
  for (const path of paths)
    for (const k of getParam(clip, path)?.keyframes ?? []) if (!ts.some((x) => Math.abs(x - k.t) < KF_TOL)) ts.push(k.t);
  return ts.sort((a, b) => a - b);
}

/** ◀ / ▶ navigator: move the playhead to the previous/next keyframe. */
export function gotoKeyframe(clip: Clip, paths: string[], dir: -1 | 1): void {
  const lt = localTime(clip);
  const ts = keyframeTimes(clip, paths);
  const target = dir < 0 ? [...ts].reverse().find((t) => t < lt - KF_TOL) : ts.find((t) => t > lt + KF_TOL);
  if (target !== undefined) usePlayback.getState().setTime(clip.start + target);
}

export function resetParams(clipId: string, paths: string[], label = "Reset Parameter"): void {
  useEditor.getState().applySeq(label, (seq) => {
    const c = findClip(seq, clipId);
    if (!c) return;
    const t = usePlayback.getState().time;
    for (const path of paths) {
      const p = getParam(c, path);
      if (!p) continue;
      const d = paramDefault(c, path, seq);
      if (isAnimated(p)) setParamAt(p, localTime(c, t), d);
      else p.value = d;
    }
  });
}

// ---------------------------------------------------------------- keyframe selection keys

export const kfKey = (clipId: string, path: string, index: number) => `${clipId}|${path}|${index}`;
export function parseKfKey(k: string): { clipId: string; path: string; index: number } {
  const [clipId, path, i] = k.split("|");
  return { clipId, path, index: Number(i) };
}

export function deleteSelectedKeyframes(): boolean {
  const st = useEditor.getState();
  const keys = st.selection.keyframes;
  if (!keys.length) return false;
  st.applySeq("Delete Keyframes", (seq) => {
    const byParam = new Map<string, { clipId: string; path: string; idx: Set<number> }>();
    for (const k of keys) {
      const { clipId, path, index } = parseKfKey(k);
      const id = clipId + "|" + path;
      if (!byParam.has(id)) byParam.set(id, { clipId, path, idx: new Set() });
      byParam.get(id)!.idx.add(index);
    }
    for (const { clipId, path, idx } of byParam.values()) {
      const c = findClip(seq, clipId);
      const p = c && getParam(c, path);
      if (!p?.keyframes) continue;
      const remaining = p.keyframes.filter((_, i) => !idx.has(i));
      if (remaining.length === 0) p.value = p.keyframes[0]?.v ?? p.value;
      p.keyframes = remaining;
    }
  });
  st.select({ keyframes: [] });
  return true;
}

export function setSelectedInterp(interp: Keyframe["interp"], keys = useEditor.getState().selection.keyframes): void {
  useEditor.getState().applySeq("Keyframe Interpolation", (seq) => {
    for (const k of keys) {
      const { clipId, path, index } = parseKfKey(k);
      const c = findClip(seq, clipId);
      const kf = c && getParam(c, path)?.keyframes?.[index];
      if (kf) kf.interp = interp;
    }
  });
}

// ---------------------------------------------------------------- effects on clips

export function addEffectToClips(type: string, clipIds: string[]): number {
  const def = EFFECT_MAP[type];
  const seq = getActiveSequence();
  if (!def || !seq) return 0;
  const targets = selectedClips(seq, clipIds).filter((c) => (def.kind === "audio" ? isAudio(seq, c) : isVisual(seq, c)));
  if (!targets.length) {
    useEditor.getState().toast(def.kind === "audio" ? "Select an audio clip to apply audio effects" : "Select a video clip to apply video effects", "error");
    return 0;
  }
  const ids = new Set(targets.map((c) => c.id));
  useEditor.getState().applySeq(`Apply ${def.name}`, (s) => {
    for (const c of s.clips) if (ids.has(c.id)) c.effects.push(makeEffect(type));
  });
  return targets.length;
}

export function updateEffect(clipId: string, effectId: string, label: string, fn: (fx: Effect, clip: Clip) => void): void {
  useEditor.getState().applySeq(label, (seq) => {
    const c = findClip(seq, clipId);
    const fx = c?.effects.find((e) => e.id === effectId);
    if (c && fx) fn(fx, c);
  });
}

/** Find (or create, inside a draft) the first effect of `type` on a clip. */
export function ensureEffect(clip: Clip, type: string, init?: (fx: Effect) => void): Effect {
  let fx = clip.effects.find((e) => e.type === type);
  if (!fx) {
    fx = makeEffect(type);
    init?.(fx);
    clip.effects.push(fx);
    fx = clip.effects[clip.effects.length - 1];
  }
  return fx;
}

export function getProject(): Project {
  return useEditor.getState().project;
}

/** Turns×degrees formatter for Rotation: 375 -> "1x15.0°" (Premiere style). */
export function formatRotation(v: number): string {
  const turns = Math.trunc(v / 360);
  const rest = v - turns * 360;
  return turns !== 0 ? `${turns}x${rest.toFixed(1)}°` : `${v.toFixed(1)}°`;
}

export function parseRotation(s: string): number | null {
  const m = s.trim().replace("°", "").match(/^(-?\d+)\s*x\s*(-?\d*\.?\d+)$/i);
  if (m) return Number(m[1]) * 360 + Number(m[2]);
  const n = parseFloat(s.replace("°", ""));
  return Number.isNaN(n) ? null : n;
}

export function dbToGain(db: number): number {
  return db <= -96 ? 0 : Math.pow(10, db / 20);
}

export function formatDb(db: number): string {
  if (!Number.isFinite(db) || db <= -96) return "-∞";
  return (db > 0 ? "+" : "") + db.toFixed(1);
}
