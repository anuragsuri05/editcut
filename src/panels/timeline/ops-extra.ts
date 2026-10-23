// Timeline-specific pure edit operations that shared/ops.ts doesn't provide.
// Like shared/ops these MUTATE the sequence they're given (immer drafts or plain).
import type { Clip, ID, Project, Sequence, Track, TrackKind, Transition } from "@shared/types";
import {
  clipEnd, clipsOnTrack, editPoints, getClip, getTrack, insertClips, normalizeTransitions, overwriteClips,
  rippleTracks, sequenceDuration, shiftTrackFrom, sourceLimit, sourceTimeAt, splitClip, tracksOfKind, trackIndex, trimClip,
} from "@shared/ops";
import { defaultAudioProps, defaultMotion, defaultOpacity, uid } from "@shared/factory";
import { EFFECT_MAP } from "@shared/effects";
import { EPS } from "@shared/time";
import type { ClipboardData } from "./state";

export const plain = <T,>(o: T): T => JSON.parse(JSON.stringify(o));

/** Shift every keyframe/marker time of a clip by -offset (clip-local times). */
export function shiftClipKeyframes(clip: Clip, offset: number): void {
  const walk = (o: unknown) => {
    if (!o || typeof o !== "object") return;
    for (const v of Object.values(o as Record<string, unknown>)) {
      const kf = (v as { keyframes?: { t: number }[] } | null)?.keyframes;
      if (Array.isArray(kf)) for (const k of kf) k.t -= offset;
    }
  };
  walk(clip.motion);
  walk(clip.opacity);
  walk(clip.audio);
  for (const e of clip.effects) walk(e.params);
  for (const m of clip.markers) m.time -= offset;
}

const isLocked = (seq: Sequence, trackId: ID) => !!getTrack(seq, trackId)?.locked;

// ---------------------------------------------------------------- selection helpers

/** Expand ids with linked partners (when linked) and group members. */
export function expandSelection(seq: Sequence, ids: ID[], linked: boolean): ID[] {
  const out = new Set(ids);
  const links = new Set<string>();
  const groups = new Set<string>();
  for (const id of ids) {
    const c = getClip(seq, id);
    if (!c) continue;
    if (linked && c.linkId) links.add(c.linkId);
    if (c.groupId) groups.add(c.groupId);
  }
  if (links.size || groups.size) {
    for (const c of seq.clips) {
      if ((c.linkId && links.has(c.linkId)) || (c.groupId && groups.has(c.groupId))) out.add(c.id);
    }
    // group members' linked partners too
    if (linked && groups.size) for (const c of seq.clips) if (out.has(c.id) && c.linkId) links.add(c.linkId);
    if (linked) for (const c of seq.clips) if (c.linkId && links.has(c.linkId)) out.add(c.id);
  }
  return [...out];
}

/** Linked partners of a clip (excluding itself) whose edge coincides with the given edge. */
export function edgePartners(seq: Sequence, clip: Clip, edge: "in" | "out"): Clip[] {
  if (!clip.linkId) return [];
  const t = edge === "in" ? clip.start : clipEnd(clip);
  return seq.clips.filter((c) => c.id !== clip.id && c.linkId === clip.linkId && Math.abs((edge === "in" ? c.start : clipEnd(c)) - t) < 1e-3);
}

// ---------------------------------------------------------------- trims

/** Max/min source-limited extension for an edge (in timeline seconds). */
function edgeLimits(project: Project | undefined, seq: Sequence, c: Clip, edge: "in" | "out", minDur: number): [number, number] {
  const limit = sourceLimit(project, c);
  const srcEnd = c.sourceIn + c.duration * c.speed;
  if (edge === "in") {
    const ext = c.reversed ? (limit - srcEnd) / c.speed : c.sourceIn / c.speed;
    return [-ext, c.duration - minDur];
  }
  const ext = c.reversed ? c.sourceIn / c.speed : (limit - srcEnd) / c.speed;
  return [-(c.duration - minDur), ext];
}

/** Change one edge in place without moving anything else. Positive d = later in time. */
function applyEdge(c: Clip, edge: "in" | "out", d: number, keepStart: boolean): void {
  if (edge === "in") {
    if (!c.reversed) c.sourceIn += d * c.speed;
    c.duration -= d;
    shiftClipKeyframes(c, d);
    if (!keepStart) c.start += d;
  } else {
    c.duration += d;
    if (c.reversed) c.sourceIn -= d * c.speed;
  }
}

/**
 * Ripple trim several edges together (e.g. a clip + its linked partners) by the
 * same delta. Later material on the clips' tracks and all sync-locked tracks
 * shifts once. Returns the applied delta (positive = edge later).
 */
export function rippleTrimGroup(project: Project | undefined, seq: Sequence, items: { clipId: ID; edge: "in" | "out" }[], delta: number, minDur = 1 / 60): number {
  const list = items.map((i) => ({ c: getClip(seq, i.clipId)!, edge: i.edge })).filter((x) => x.c && !isLocked(seq, x.c.trackId));
  if (!list.length) return 0;
  let d = delta;
  for (const { c, edge } of list) {
    const [lo, hi] = edgeLimits(project, seq, c, edge, minDur);
    d = Math.min(Math.max(d, lo), hi);
  }
  if (Math.abs(d) < EPS) return 0;
  // pivot: the clip end before the trim; shift = change of that end
  const pivot = Math.min(...list.map((x) => clipEnd(x.c)));
  const shift = list[0].edge === "out" ? d : -d;
  const own = new Set(list.map((x) => x.c.id));
  for (const { c, edge } of list) applyEdge(c, edge, d, true);
  const tracks = rippleTracks(seq, [...new Set(list.map((x) => x.c.trackId))]);
  for (const x of seq.clips) if (!own.has(x.id) && tracks.includes(x.trackId) && x.start >= pivot - EPS) x.start = Math.max(0, x.start + shift);
  for (const t of seq.transitions) if (tracks.includes(t.trackId) && t.at >= pivot + EPS) t.at += shift;
  normalizeTransitions(seq);
  return d;
}

/** Normal trim of an edge together with its linked partners. */
export function trimGroup(project: Project | undefined, seq: Sequence, items: { clipId: ID; edge: "in" | "out" }[], delta: number, minDur = 1 / 60): number {
  // dry-run clamp on each, then apply the min common delta
  let d = delta;
  for (const it of items) {
    const c = getClip(seq, it.clipId);
    if (!c || isLocked(seq, c.trackId)) continue;
    const [lo, hi] = edgeLimits(project, seq, c, it.edge, minDur);
    d = Math.min(Math.max(d, lo), hi);
    const list = clipsOnTrack(seq, c.trackId);
    const i = list.findIndex((x) => x.id === c.id);
    if (it.edge === "in") {
      const prev = list[i - 1];
      d = Math.max(d, prev ? clipEnd(prev) - c.start : -c.start);
    } else {
      const next = list[i + 1];
      if (next) d = Math.min(d, next.start - clipEnd(c));
    }
  }
  for (const it of items) {
    const c = getClip(seq, it.clipId);
    if (!c || isLocked(seq, c.trackId)) continue;
    applyEdge(c, it.edge, d, false);
  }
  normalizeTransitions(seq);
  return d;
}

/** Rolling edit on several edit points (clip + linked partners). */
export function rollGroup(project: Project | undefined, seq: Sequence, items: { clipId: ID; edge: "in" | "out" }[], delta: number): number {
  if (!items.length) return 0;
  // find the common clamp by trying on a scratch copy
  let d = delta;
  for (const it of items) {
    const scratch = plain(seq);
    const got = trimClip(project, scratch, it.clipId, it.edge, d, "roll");
    if (Math.abs(got) < Math.abs(d)) d = got;
  }
  for (const it of items) trimClip(project, seq, it.clipId, it.edge, d, "roll");
  return d;
}

/** Rate stretch: change duration via speed so the clip's content fills it. */
export function rateStretch(seq: Sequence, ids: ID[], edge: "in" | "out", delta: number, minDur = 1 / 60): number {
  const clips = ids.map((id) => getClip(seq, id)!).filter((c) => c && !isLocked(seq, c.trackId));
  let d = delta;
  for (const c of clips) {
    const list = clipsOnTrack(seq, c.trackId);
    const i = list.findIndex((x) => x.id === c.id);
    if (edge === "out") {
      d = Math.max(d, -(c.duration - minDur));
      const next = list[i + 1];
      if (next) d = Math.min(d, next.start - clipEnd(c));
    } else {
      d = Math.min(d, c.duration - minDur);
      const prev = list[i - 1];
      d = Math.max(d, prev ? clipEnd(prev) - c.start : -c.start);
    }
  }
  for (const c of clips) {
    const src = c.duration * c.speed;
    const nd = edge === "out" ? c.duration + d : c.duration - d;
    const oldDur = c.duration;
    c.speed = src / nd;
    c.duration = nd;
    if (edge === "in") c.start += d;
    // scale keyframe times proportionally
    const k = nd / oldDur;
    const scale = (o: unknown) => {
      if (!o || typeof o !== "object") return;
      for (const v of Object.values(o as Record<string, unknown>)) {
        const kf = (v as { keyframes?: { t: number }[] } | null)?.keyframes;
        if (Array.isArray(kf)) for (const kk of kf) kk.t *= k;
      }
    };
    scale(c.motion);
    scale(c.opacity);
    scale(c.audio);
    for (const e of c.effects) scale(e.params);
  }
  normalizeTransitions(seq);
  return d;
}

// ---------------------------------------------------------------- playhead trims (Q/W/E)

/** Q / W (ripple) and Alt+Q / Alt+W (no ripple): trim the previous/next edit to the playhead. */
export function trimEditToPlayhead(seq: Sequence, trackIds: ID[], t: number, which: "prev" | "next", ripple: boolean): boolean {
  const tracks = trackIds.filter((id) => !isLocked(seq, id));
  if (!tracks.length) return false;
  const under = seq.clips.filter((c) => tracks.includes(c.trackId) && t > c.start + EPS && t < clipEnd(c) - EPS);
  let a: number, b: number;
  if (which === "prev") {
    const pts = under.length ? under.map((c) => c.start) : editPoints(seq, tracks).filter((p) => p < t - EPS);
    if (!pts.length) return false;
    a = Math.max(...pts);
    b = t;
  } else {
    const pts = under.length ? under.map(clipEnd) : editPoints(seq, tracks).filter((p) => p > t + EPS);
    if (!pts.length) return false;
    a = t;
    b = Math.min(...pts);
  }
  if (b - a < EPS) return false;
  if (ripple) {
    // extract semantics on targeted + sync-locked tracks
    const all = rippleTracks(seq, tracks);
    for (const id of all) clearRangeKeepLinks(seq, id, a, b);
    for (const id of all) shiftTrackFrom(seq, id, b, -(b - a));
    for (const m of seq.markers) if (m.time >= b - EPS) m.time -= b - a;
  } else {
    for (const id of tracks) clearRangeKeepLinks(seq, id, a, b);
  }
  normalizeTransitions(seq);
  return true;
}

/** clearRange that keeps link ids of straddling split halves consistent. */
export function clearRangeKeepLinks(seq: Sequence, trackId: ID, start: number, end: number): void {
  if (end - start <= EPS) return;
  for (const c of clipsOnTrack(seq, trackId)) {
    const ce = clipEnd(c);
    if (ce <= start + EPS || c.start >= end - EPS) continue;
    if (c.start < start - EPS && ce > end + EPS) {
      const right = splitClip(seq, c.id, end);
      if (right && c.linkId) right.linkId = c.linkId + "_r";
      c.duration = start - c.start;
    } else if (c.start >= start - EPS && ce <= end + EPS) {
      seq.clips = seq.clips.filter((x) => x.id !== c.id);
    } else if (c.start < start) {
      c.duration = start - c.start;
    } else {
      const cut = end - c.start;
      if (!c.reversed) c.sourceIn += cut * c.speed;
      c.start = end;
      c.duration -= cut;
      shiftClipKeyframes(c, cut);
    }
  }
}

/** E: move selected edit points to t (roll when the edit has an adjacent partner, else trim). */
export function extendEditsTo(project: Project | undefined, seq: Sequence, edits: { clipId: ID; edge: "in" | "out" }[], t: number): void {
  for (const e of edits) {
    const c = getClip(seq, e.clipId);
    if (!c) continue;
    const cur = e.edge === "in" ? c.start : clipEnd(c);
    const list = clipsOnTrack(seq, c.trackId);
    const i = list.findIndex((x) => x.id === c.id);
    const other = e.edge === "out" ? list[i + 1] : list[i - 1];
    const adjacent = other && Math.abs((e.edge === "out" ? other.start : clipEnd(other)) - cur) < 1e-3;
    trimClip(project, seq, c.id, e.edge, t - cur, adjacent ? "roll" : "normal");
  }
}

// ---------------------------------------------------------------- frame holds

/** Turn a clip into a hold of the source frame at sourceTime (speed so ~1 frame is consumed). */
export function makeHold(c: Clip, sourceTime: number, fps: number): void {
  const frame = 1 / fps;
  c.reversed = false;
  c.sourceIn = Math.max(0, sourceTime);
  c.speed = Math.max(1e-6, (frame * 0.999) / Math.max(c.duration, frame));
}

/** Add Frame Hold: split video clip at t; right part holds the frame at t. */
export function addFrameHold(seq: Sequence, clipId: ID, t: number, fps: number): Clip | null {
  const c = getClip(seq, clipId);
  if (!c) return null;
  const src = sourceTimeAt(c, t);
  const right = t > c.start + EPS ? splitClip(seq, c.id, t) : c;
  if (!right) return null;
  if (right !== c) right.linkId = undefined;
  makeHold(right, src, fps);
  right.name = c.name.replace(/ \(Hold\)$/, "") + " (Hold)";
  return right;
}

/** Insert Frame Hold Segment: insert a `holdDur` freeze of the frame at t, rippling later material. */
export function insertFrameHoldSegment(seq: Sequence, clipId: ID, t: number, fps: number, holdDur = 2): Clip | null {
  const c = getClip(seq, clipId);
  if (!c) return null;
  const src = sourceTimeAt(c, t);
  const hold: Clip = plain(c);
  hold.id = uid("clp_");
  hold.linkId = undefined;
  hold.groupId = undefined;
  hold.start = t;
  hold.duration = holdDur;
  hold.markers = [];
  shiftClipKeyframes(hold, t - c.start);
  makeHold(hold, src, fps);
  hold.name = c.name + " (Hold)";
  insertClips(seq, [hold]);
  return hold;
}

// ---------------------------------------------------------------- clipboard

export function copyClips(seq: Sequence, ids: ID[]): ClipboardData | null {
  const clips = seq.clips.filter((c) => ids.includes(c.id));
  if (!clips.length) return null;
  const t0 = Math.min(...clips.map((c) => c.start));
  const t1 = Math.max(...clips.map(clipEnd));
  const tracks = clips.map((c) => {
    const tr = getTrack(seq, c.trackId)!;
    return { kind: tr.kind, index: trackIndex(seq, c.trackId) };
  });
  const out = clips.map((c) => ({ ...plain(c), start: c.start - t0 }));
  const transitions = plain(seq.transitions.filter((t) => ids.includes(t.clipAId ?? "") || ids.includes(t.clipBId ?? ""))).map((t) => ({ ...t, at: t.at - t0 }));
  return { clips: out, tracks, transitions, duration: t1 - t0 };
}

/** Fresh copies of clips: new ids, remapped link/group ids. Returns [copies, idMap]. */
export function freshCopies(clips: Clip[]): [Clip[], Map<ID, ID>] {
  const idMap = new Map<ID, ID>();
  const linkMap = new Map<ID, ID>();
  const groupMap = new Map<ID, ID>();
  const out = clips.map((c) => {
    const n: Clip = plain(c);
    n.id = uid("clp_");
    idMap.set(c.id, n.id);
    if (c.linkId) {
      if (!linkMap.has(c.linkId)) linkMap.set(c.linkId, uid("lnk_"));
      n.linkId = linkMap.get(c.linkId);
    }
    if (c.groupId) {
      if (!groupMap.has(c.groupId)) groupMap.set(c.groupId, uid("grp_"));
      n.groupId = groupMap.get(c.groupId);
    }
    for (const e of n.effects) e.id = uid("fx_");
    for (const m of n.markers) m.id = uid("mk_");
    return n;
  });
  return [out, idMap];
}

/**
 * Paste clipboard at time `at`. Each kind's lowest clipboard track lands on the
 * lowest targeted track of that kind (or the given base index). Returns new clips.
 */
export function pasteClips(seq: Sequence, data: ClipboardData, at: number, mode: "overwrite" | "insert"): Clip[] {
  const [copies, idMap] = freshCopies(data.clips);
  const minIdx: Partial<Record<TrackKind, number>> = {};
  data.tracks.forEach((t) => (minIdx[t.kind] = Math.min(minIdx[t.kind] ?? Infinity, t.index)));
  const base = (kind: TrackKind) => {
    const list = tracksOfKind(seq, kind);
    const i = list.findIndex((t) => t.targeted && !t.locked);
    return i >= 0 ? i : 0;
  };
  copies.forEach((c, i) => {
    const t = data.tracks[i];
    const idx = t.index - (minIdx[t.kind] ?? 0) + base(t.kind);
    c.trackId = ensureTrackOfKind(seq, t.kind, idx).id;
    c.start = at + c.start;
  });
  if (mode === "insert") insertClips(seq, copies);
  else overwriteClips(seq, copies);
  for (const tr of data.transitions) {
    const a = tr.clipAId ? idMap.get(tr.clipAId) : undefined;
    const b = tr.clipBId ? idMap.get(tr.clipBId) : undefined;
    if ((tr.clipAId && !a) || (tr.clipBId && !b)) continue;
    const ref = copies.find((c) => c.id === (a ?? b));
    if (!ref) continue;
    seq.transitions.push({ ...plain(tr), id: uid("tr_"), at: at + tr.at, clipAId: a, clipBId: b, trackId: ref.trackId });
  }
  normalizeTransitions(seq);
  return copies;
}

function ensureTrackOfKind(seq: Sequence, kind: TrackKind, index: number): Track {
  let list = tracksOfKind(seq, kind);
  while (list.length <= index) {
    const n = list.length + 1;
    const prefix = kind === "video" ? "V" : kind === "audio" ? "A" : "C";
    const tr: Track = {
      id: uid("trk_"), kind, name: `${prefix}${n}`, locked: false, syncLock: true, targeted: false, muted: false, solo: false,
      height: kind === "video" ? 56 : kind === "audio" ? 52 : 32, volumeDb: 0, pan: 0,
    };
    const lastIdx = seq.tracks.map((t) => t.kind).lastIndexOf(kind);
    if (lastIdx === -1) seq.tracks.push(tr);
    else seq.tracks.splice(lastIdx + 1, 0, tr);
    list = tracksOfKind(seq, kind);
  }
  return list[index];
}

// ---------------------------------------------------------------- attributes

export interface AttrChoice {
  motion: boolean;
  opacity: boolean;
  timeRemap: boolean;
  volume: boolean;
  effects: boolean;
}

export function pasteAttributes(seq: Sequence, src: Clip, ids: ID[], choice: AttrChoice, project?: Project): void {
  for (const id of ids) {
    const c = getClip(seq, id);
    if (!c || c.id === src.id) continue;
    if (choice.motion && src.motion && c.motion) c.motion = plain(src.motion);
    if (choice.opacity && src.opacity && c.opacity) c.opacity = plain(src.opacity);
    if (choice.volume && src.audio && c.audio) c.audio = plain(src.audio);
    if (choice.effects) {
      const kind = getTrack(seq, c.trackId)?.kind;
      const fx = plain(src.effects).filter((e) => {
        const def = EFFECT_MAP[e.type];
        return !def || (kind === "audio" ? def.kind === "audio" : def.kind === "video");
      });
      for (const e of fx) e.id = uid("fx_");
      c.effects.push(...fx);
    }
    if (choice.timeRemap && Math.abs(src.speed - c.speed) > 1e-9) {
      const srcDur = c.duration * c.speed;
      c.speed = src.speed;
      c.reversed = src.reversed;
      c.duration = srcDur / src.speed;
      void project;
    }
  }
  normalizeTransitions(seq);
}

export function removeAttributes(seq: Sequence, ids: ID[], choice: AttrChoice): void {
  for (const id of ids) {
    const c = getClip(seq, id);
    if (!c) continue;
    if (choice.motion && c.motion) {
      const m = defaultMotion(seq.settings);
      m.anchorX = c.motion.anchorX.keyframes ? { value: c.motion.anchorX.value } : c.motion.anchorX;
      m.anchorY = c.motion.anchorY.keyframes ? { value: c.motion.anchorY.value } : c.motion.anchorY;
      m.scale = { value: c.motion.scale.value };
      c.motion = m;
    }
    if (choice.opacity && c.opacity) c.opacity = defaultOpacity();
    if (choice.volume && c.audio) c.audio = defaultAudioProps();
    if (choice.effects) c.effects = [];
    if (choice.timeRemap && c.speed !== 1) {
      const srcDur = c.duration * c.speed;
      c.speed = 1;
      c.reversed = false;
      c.duration = srcDur;
    }
  }
  normalizeTransitions(seq);
}

// ---------------------------------------------------------------- nesting helpers

/** True if sequence `outerId` (transitively) contains a clip of sequence `innerId`. */
export function sequenceContains(project: Project, outerId: ID, innerId: ID, seen = new Set<ID>()): boolean {
  if (outerId === innerId) return true;
  if (seen.has(outerId)) return false;
  seen.add(outerId);
  const s = project.sequences[outerId];
  if (!s) return false;
  return s.clips.some((c) => c.sequenceId && sequenceContains(project, c.sequenceId, innerId, seen));
}

/** Build nested-sequence clips (video + audio when the nest has audio) for placing `nested` into `seq`. */
export function makeNestClips(seq: Sequence, nested: Sequence, at: number, videoIdx: number, audioIdx: number): Clip[] {
  const dur = Math.max(sequenceDuration(nested), 1 / seq.settings.fps);
  const hasV = nested.clips.some((c) => getTrack(nested, c.trackId)?.kind === "video") || !nested.clips.length;
  const hasA = nested.clips.some((c) => getTrack(nested, c.trackId)?.kind === "audio");
  const linkId = hasV && hasA ? uid("lnk_") : undefined;
  const base = (trackId: ID): Clip => ({
    id: uid("clp_"), trackId, name: nested.name, sequenceId: nested.id, start: at, duration: dur, sourceIn: 0, speed: 1,
    reversed: false, maintainPitch: true, enabled: true, linkId, label: "forest", effects: [], masks: [], markers: [],
  });
  const out: Clip[] = [];
  if (hasV) {
    const c = base(ensureTrackOfKind(seq, "video", videoIdx).id);
    c.motion = defaultMotion(seq.settings);
    c.opacity = defaultOpacity();
    out.push(c);
  }
  if (hasA) {
    const c = base(ensureTrackOfKind(seq, "audio", audioIdx).id);
    c.audio = defaultAudioProps();
    out.push(c);
  }
  return out;
}

/** Copies of a sequence's clips (for "insert sequences as individual clips"), offset to `at`. */
export function flattenSequenceClips(seq: Sequence, nested: Sequence, at: number, videoIdx: number, audioIdx: number): Clip[] {
  const [copies] = freshCopies(nested.clips);
  copies.forEach((c, i) => {
    const src = nested.clips[i];
    const tr = getTrack(nested, src.trackId)!;
    const idx = trackIndex(nested, src.trackId) + (tr.kind === "video" ? videoIdx : tr.kind === "audio" ? audioIdx : 0);
    c.trackId = ensureTrackOfKind(seq, tr.kind, idx).id;
    c.start = at + src.start;
  });
  return copies;
}

// ---------------------------------------------------------------- analysis for display

export type RenderColor = "green" | "yellow" | "red";
export interface RenderSegment {
  start: number;
  end: number;
  color: RenderColor;
  key: string;
}

const HEAVY_CATEGORIES = new Set(["Blur & Sharpen", "Distort", "Keying", "Noise & Grain", "Stylize", "Perspective"]);

function motionChanged(c: Clip, seq: Sequence): boolean {
  const m = c.motion;
  if (!m) return false;
  const k = (p: { keyframes?: unknown[] }) => !!p.keyframes?.length;
  return (
    k(m.positionX) || k(m.positionY) || k(m.scale) || k(m.rotation) || m.rotation.value !== 0 ||
    m.cropLeft.value + m.cropRight.value + m.cropTop.value + m.cropBottom.value > 0 ||
    Math.abs(m.positionX.value - seq.settings.width / 2) > 0.5 || Math.abs(m.positionY.value - seq.settings.height / 2) > 0.5
  );
}

/** Heuristic render-bar segments for the video tracks of a sequence. */
export function renderSegments(seq: Sequence, rendered: Set<string>): RenderSegment[] {
  const vids = new Set(seq.tracks.filter((t) => t.kind === "video" && !t.muted).map((t) => t.id));
  const clips = seq.clips.filter((c) => vids.has(c.trackId) && c.enabled);
  if (!clips.length) return [];
  const pts = new Set<number>();
  for (const c of clips) {
    pts.add(+c.start.toFixed(5));
    pts.add(+clipEnd(c).toFixed(5));
  }
  for (const t of seq.transitions) {
    if (!vids.has(t.trackId)) continue;
    const half = t.alignment === "center" ? t.duration / 2 : t.duration;
    const a = t.alignment === "start" ? t.at : t.at - half;
    pts.add(+a.toFixed(5));
    pts.add(+(a + t.duration).toFixed(5));
  }
  const sorted = [...pts].sort((a, b) => a - b);
  const segs: RenderSegment[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i], b = sorted[i + 1];
    const mid = (a + b) / 2;
    const here = clips.filter((c) => mid >= c.start && mid < clipEnd(c));
    if (!here.length) continue;
    const trs = seq.transitions.filter((t) => vids.has(t.trackId) && mid >= (t.alignment === "start" ? t.at : t.alignment === "end" ? t.at - t.duration : t.at - t.duration / 2) && mid < (t.alignment === "start" ? t.at + t.duration : t.alignment === "end" ? t.at : t.at + t.duration / 2));
    let color: RenderColor = "green";
    let heavy = false, light = trs.length > 0;
    for (const c of here) {
      if (c.sequenceId || c.masks.length || c.effects.filter((e) => e.enabled).length > 3) heavy = true;
      for (const e of c.effects) if (e.enabled && HEAVY_CATEGORIES.has(EFFECT_MAP[e.type]?.category ?? "")) heavy = true;
      if (c.effects.some((e) => e.enabled) || c.speed !== 1 || c.reversed || motionChanged(c, seq) || (c.opacity && (c.opacity.opacity.value < 100 || c.opacity.blendMode !== "normal" || c.opacity.opacity.keyframes?.length)) || c.generator) light = true;
    }
    if (heavy) color = "red";
    else if (light) color = "yellow";
    const key = `${a.toFixed(3)}-${b.toFixed(3)}|` + here.map((c) => `${c.id}:${c.sourceIn.toFixed(3)}:${c.speed}:${c.effects.length}:${JSON.stringify(c.effects.map((e) => e.params)).length}:${JSON.stringify(c.motion ?? "").length}`).join(",") + trs.map((t) => t.type).join(",");
    if (color !== "green" && rendered.has(key)) color = "green";
    const last = segs[segs.length - 1];
    if (last && last.color === color && Math.abs(last.end - a) < EPS && color === "green" && !rendered.has(key)) last.end = b;
    else segs.push({ start: a, end: b, color, key });
  }
  return segs;
}

/** Sync offsets (seconds) for linked clips that are out of sync. Map clipId -> offset. */
export function syncOffsets(seq: Sequence): Map<ID, number> {
  const out = new Map<ID, number>();
  const byLink = new Map<ID, Clip[]>();
  for (const c of seq.clips) if (c.linkId && c.assetId) (byLink.get(c.linkId) ?? byLink.set(c.linkId, []).get(c.linkId)!).push(c);
  for (const list of byLink.values()) {
    const v = list.find((c) => getTrack(seq, c.trackId)?.kind === "video");
    if (!v) continue;
    const vZero = v.start - v.sourceIn / v.speed;
    for (const a of list) {
      if (a === v || a.assetId !== v.assetId) continue;
      const off = a.start - a.sourceIn / a.speed - vZero;
      if (Math.abs(off) > 1e-3) {
        out.set(a.id, off);
        out.set(v.id, -off);
      }
    }
  }
  return out;
}

/** Times of through edits (contiguous same-source cuts) per track: `${trackId}` -> times. */
export function throughEdits(seq: Sequence): { trackId: ID; t: number }[] {
  const out: { trackId: ID; t: number }[] = [];
  for (const tr of seq.tracks) {
    const list = clipsOnTrack(seq, tr.id);
    for (let i = 0; i < list.length - 1; i++) {
      const a = list[i], b = list[i + 1];
      if (!a.assetId || a.assetId !== b.assetId || a.reversed || b.reversed || Math.abs(a.speed - b.speed) > 1e-6) continue;
      if (Math.abs(clipEnd(a) - b.start) > 1e-3) continue;
      if (Math.abs(a.sourceIn + a.duration * a.speed - b.sourceIn) < 1e-3) out.push({ trackId: tr.id, t: b.start });
    }
  }
  return out;
}

/** Clips whose source frames appear more than once on video tracks (duplicate frame markers). */
export function duplicateFrameClips(seq: Sequence): Set<ID> {
  const out = new Set<ID>();
  const byAsset = new Map<ID, Clip[]>();
  for (const c of seq.clips) {
    if (!c.assetId || getTrack(seq, c.trackId)?.kind !== "video") continue;
    (byAsset.get(c.assetId) ?? byAsset.set(c.assetId, []).get(c.assetId)!).push(c);
  }
  for (const list of byAsset.values()) {
    if (list.length < 2) continue;
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        const a0 = a.sourceIn, a1 = a.sourceIn + a.duration * a.speed, b0 = b.sourceIn, b1 = b.sourceIn + b.duration * b.speed;
        if (Math.min(a1, b1) - Math.max(a0, b0) > 1e-3) {
          out.add(a.id);
          out.add(b.id);
        }
      }
  }
  return out;
}

/** Remove a transition by id. */
export function removeTransition(seq: Sequence, id: ID): void {
  seq.transitions = seq.transitions.filter((t: Transition) => t.id !== id);
}
