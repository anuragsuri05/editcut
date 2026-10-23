// Pure editing operations on a Sequence/Project. Functions MUTATE the object
// they are given (works on immer drafts in the client and plain objects on the
// server/AI agent). They never touch UI state.

import type { Clip, ID, MediaAsset, Project, Sequence, Track, TrackKind, Transition, TransitionType } from "./types";
import { EPS } from "./time";
import { makeMediaClip, makeTrack, uid } from "./factory";
import { TRANSITION_MAP } from "./effects";

// ---------------------------------------------------------------- queries

export const clipEnd = (c: Clip) => c.start + c.duration;

export function getTrack(seq: Sequence, id: ID): Track | undefined {
  return seq.tracks.find((t) => t.id === id);
}

/** Tracks of a kind in index order (V1, V2... / A1, A2...). */
export function tracksOfKind(seq: Sequence, kind: TrackKind): Track[] {
  return seq.tracks.filter((t) => t.kind === kind);
}

export function trackIndex(seq: Sequence, trackId: ID): number {
  const tr = getTrack(seq, trackId);
  if (!tr) return -1;
  return tracksOfKind(seq, tr.kind).indexOf(tr);
}

export function clipsOnTrack(seq: Sequence, trackId: ID): Clip[] {
  return seq.clips.filter((c) => c.trackId === trackId).sort((a, b) => a.start - b.start);
}

export function getClip(seq: Sequence, id: ID): Clip | undefined {
  return seq.clips.find((c) => c.id === id);
}

export function sequenceDuration(seq: Sequence): number {
  let d = 0;
  for (const c of seq.clips) d = Math.max(d, clipEnd(c));
  return d;
}

export function clipAt(seq: Sequence, trackId: ID, t: number): Clip | undefined {
  return seq.clips.find((c) => c.trackId === trackId && t >= c.start - EPS && t < clipEnd(c) - EPS);
}

/** Clips whose time range contains t, on any track. */
export function clipsAtTime(seq: Sequence, t: number): Clip[] {
  return seq.clips.filter((c) => t >= c.start - EPS && t < clipEnd(c) - EPS);
}

export function linkedClips(seq: Sequence, clip: Clip): Clip[] {
  if (!clip.linkId) return [clip];
  return seq.clips.filter((c) => c.linkId === clip.linkId);
}

/** Expand a selection of clip ids to include linked partners. */
export function expandLinked(seq: Sequence, ids: ID[]): ID[] {
  const out = new Set(ids);
  for (const id of ids) {
    const c = getClip(seq, id);
    if (c) for (const l of linkedClips(seq, c)) out.add(l.id);
  }
  return [...out];
}

export function trackKindOfClip(seq: Sequence, clip: Clip): TrackKind | undefined {
  return getTrack(seq, clip.trackId)?.kind;
}

/** Source media time shown at timeline time t (seconds). */
export function sourceTimeAt(clip: Clip, t: number): number {
  const local = Math.min(Math.max(t - clip.start, 0), clip.duration);
  return clip.reversed ? clip.sourceIn + (clip.duration - local) * clip.speed : clip.sourceIn + local * clip.speed;
}

/** Max source duration available for the clip (Infinity for stills/generators). */
export function sourceLimit(project: Project | undefined, clip: Clip): number {
  if (!clip.assetId || !project) return Infinity;
  const a = project.media[clip.assetId];
  if (!a || a.kind === "image") return Infinity;
  return a.duration;
}

/** Edit points (clip starts/ends) across given tracks, sorted and unique. */
export function editPoints(seq: Sequence, trackIds?: ID[]): number[] {
  const s = new Set<number>([0]);
  for (const c of seq.clips) {
    if (trackIds && !trackIds.includes(c.trackId)) continue;
    s.add(round(c.start));
    s.add(round(clipEnd(c)));
  }
  return [...s].sort((a, b) => a - b);
}

const round = (t: number) => Math.round(t * 1e6) / 1e6;

// ---------------------------------------------------------------- tracks

export function addTrack(seq: Sequence, kind: TrackKind): Track {
  const n = tracksOfKind(seq, kind).length + 1;
  const tr = makeTrack(kind, n);
  tr.targeted = false;
  // keep kind grouping: insert after the last track of the same kind
  const lastIdx = seq.tracks.map((t) => t.kind).lastIndexOf(kind);
  seq.tracks.splice(lastIdx + 1, 0, tr);
  if (lastIdx === -1) seq.tracks.push(...seq.tracks.splice(seq.tracks.indexOf(tr), 1));
  return tr;
}

/** Ensure a track of kind exists at the given 0-based index, creating tracks as needed. */
export function ensureTrack(seq: Sequence, kind: TrackKind, index: number): Track {
  let list = tracksOfKind(seq, kind);
  while (list.length <= index) {
    addTrack(seq, kind);
    list = tracksOfKind(seq, kind);
  }
  return list[index];
}

export function deleteTrack(seq: Sequence, trackId: ID): void {
  const tr = getTrack(seq, trackId);
  if (!tr) return;
  seq.clips = seq.clips.filter((c) => c.trackId !== trackId);
  seq.transitions = seq.transitions.filter((t) => t.trackId !== trackId);
  seq.tracks = seq.tracks.filter((t) => t.id !== trackId);
  renumberTracks(seq);
}

export function renumberTracks(seq: Sequence): void {
  for (const kind of ["video", "audio", "caption"] as TrackKind[]) {
    tracksOfKind(seq, kind).forEach((t, i) => {
      if (/^[VAC]\d+$/.test(t.name)) t.name = `${kind === "video" ? "V" : kind === "audio" ? "A" : "C"}${i + 1}`;
    });
  }
}

const isLocked = (seq: Sequence, trackId: ID) => !!getTrack(seq, trackId)?.locked;

// ---------------------------------------------------------------- low-level clip surgery

function shiftKeyframes(clip: Clip, offset: number): void {
  const shift = (o: unknown) => {
    if (o && typeof o === "object") {
      for (const v of Object.values(o as Record<string, unknown>)) {
        if (v && typeof v === "object" && "keyframes" in (v as object) && Array.isArray((v as { keyframes?: unknown[] }).keyframes)) {
          for (const k of (v as { keyframes: { t: number }[] }).keyframes) k.t -= offset;
        }
      }
    }
  };
  shift(clip.motion);
  shift(clip.opacity);
  shift(clip.audio);
  for (const e of clip.effects) shift(e.params);
  for (const m of clip.markers) m.time -= offset;
}

/** Split one clip at timeline time t. Returns the new right-hand clip, or null if t isn't inside. */
export function splitClip(seq: Sequence, clipId: ID, t: number): Clip | null {
  const c = getClip(seq, clipId);
  if (!c || t <= c.start + EPS || t >= clipEnd(c) - EPS) return null;
  const right: Clip = structuredClone(toPlain(c));
  right.id = uid("clp_");
  const leftDur = t - c.start;
  const rightDur = clipEnd(c) - t;
  if (c.reversed) {
    right.sourceIn = c.sourceIn;
    c.sourceIn = c.sourceIn + rightDur * c.speed;
  } else {
    right.sourceIn = c.sourceIn + leftDur * c.speed;
  }
  right.start = t;
  right.duration = rightDur;
  c.duration = leftDur;
  shiftKeyframes(right, leftDur);
  c.markers = c.markers.filter((m) => m.time < leftDur);
  right.markers = right.markers.filter((m) => m.time >= 0);
  seq.clips.push(right);
  // transitions attached to the old clip's tail now belong to the right half
  for (const tr of seq.transitions) if (tr.clipAId === c.id && tr.at >= t - EPS) tr.clipAId = right.id;
  return right;
}

/** Immer drafts can't be structuredClone'd directly; JSON round-trip is fine for our plain data. */
function toPlain<T>(o: T): T {
  return JSON.parse(JSON.stringify(o));
}

/** Split all clips crossing t on the given tracks (default: all unlocked tracks). Re-links split halves. */
export function splitAt(seq: Sequence, t: number, trackIds?: ID[]): Clip[] {
  const created: Clip[] = [];
  const relink = new Map<string, string>();
  for (const c of [...seq.clips]) {
    if (trackIds && !trackIds.includes(c.trackId)) continue;
    if (isLocked(seq, c.trackId)) continue;
    const r = splitClip(seq, c.id, t);
    if (r) {
      if (c.linkId) {
        if (!relink.has(c.linkId)) relink.set(c.linkId, uid("lnk_"));
        r.linkId = relink.get(c.linkId);
      }
      created.push(r);
    }
  }
  return created;
}

/** Remove everything in [start,end) on a track, trimming/splitting clips that straddle the range. */
export function clearRange(seq: Sequence, trackId: ID, start: number, end: number): void {
  if (end - start <= EPS) return;
  for (const c of clipsOnTrack(seq, trackId)) {
    const ce = clipEnd(c);
    if (ce <= start + EPS || c.start >= end - EPS) continue;
    if (c.start < start - EPS && ce > end + EPS) {
      const right = splitClip(seq, c.id, end)!;
      // partners split at the same point (e.g. linked A/V cleared together) share this derived id
      if (right && c.linkId) right.linkId = `${c.linkId}_${Math.round(end * 1000)}`;
      c.duration = start - c.start;
    } else if (c.start >= start - EPS && ce <= end + EPS) {
      removeClip(seq, c.id);
    } else if (c.start < start) {
      c.duration = start - c.start;
    } else {
      const cut = end - c.start;
      if (!c.reversed) c.sourceIn += cut * c.speed;
      c.start = end;
      c.duration -= cut;
      shiftKeyframes(c, cut);
    }
  }
}

export function removeClip(seq: Sequence, clipId: ID): void {
  seq.clips = seq.clips.filter((c) => c.id !== clipId);
  seq.transitions = seq.transitions.filter((t) => t.clipAId !== clipId && t.clipBId !== clipId);
}

/** Shift clips (and transitions) on a track that start at/after `from` by delta seconds. */
export function shiftTrackFrom(seq: Sequence, trackId: ID, from: number, delta: number): void {
  for (const c of seq.clips) if (c.trackId === trackId && c.start >= from - EPS) c.start = Math.max(0, c.start + delta);
  for (const t of seq.transitions) if (t.trackId === trackId && t.at >= from - EPS) t.at += delta;
}

/** Tracks that participate in ripple operations: given tracks + all sync-locked unlocked tracks. */
export function rippleTracks(seq: Sequence, trackIds: ID[]): ID[] {
  const s = new Set(trackIds);
  for (const t of seq.tracks) if (t.syncLock && !t.locked) s.add(t.id);
  return [...s].filter((id) => !isLocked(seq, id));
}

// ---------------------------------------------------------------- edits

/** Make room: split at `at` and push everything after it right by `duration` on the given tracks. */
export function insertSpace(seq: Sequence, at: number, duration: number, trackIds: ID[]): void {
  splitAt(seq, at, trackIds);
  for (const id of trackIds) shiftTrackFrom(seq, id, at, duration);
  for (const m of seq.markers) if (m.time >= at - EPS) m.time += duration;
}

/** Insert edit: clips are placed at their .start (all should share the same start); later material ripples. */
export function insertClips(seq: Sequence, clips: Clip[]): void {
  if (!clips.length) return;
  const at = Math.min(...clips.map((c) => c.start));
  const dur = Math.max(...clips.map((c) => clipEnd(c))) - at;
  insertSpace(seq, at, dur, rippleTracks(seq, [...new Set(clips.map((c) => c.trackId))]));
  seq.clips.push(...clips);
  normalizeTransitions(seq);
}

/** Overwrite edit: clear the destination ranges then place clips. */
export function overwriteClips(seq: Sequence, clips: Clip[]): void {
  for (const c of clips) clearRange(seq, c.trackId, c.start, clipEnd(c));
  seq.clips.push(...clips);
  normalizeTransitions(seq);
}

export interface PlaceOptions {
  /** Sequence time to place at. */
  at: number;
  /** Source range (seconds). Defaults to asset In/Out marks or whole media. */
  sourceIn?: number;
  sourceOut?: number;
  /** 0-based destination track indices (source patching). */
  videoTrackIndex?: number;
  audioTrackIndex?: number;
  includeVideo?: boolean;
  includeAudio?: boolean;
  mode: "insert" | "overwrite";
  /** Duration used for stills (default 5s). */
  stillDuration?: number;
}

/** Build linked V/A clips for an asset and edit them into the sequence. Returns created clips. */
export function placeAsset(seq: Sequence, asset: MediaAsset, opt: PlaceOptions): Clip[] {
  const sIn = opt.sourceIn ?? asset.inPoint ?? 0;
  const sOut = opt.sourceOut ?? asset.outPoint ?? (asset.kind === "image" ? sIn + (opt.stillDuration ?? 5) : asset.duration);
  const dur = Math.max(sOut - sIn, 1 / seq.settings.fps);
  const linkId = asset.hasVideo && asset.hasAudio ? uid("lnk_") : undefined;
  const clips: Clip[] = [];
  if (asset.hasVideo && opt.includeVideo !== false) {
    const tr = ensureTrack(seq, "video", opt.videoTrackIndex ?? 0);
    clips.push(makeMediaClip(asset, seq.settings, tr.id, "video", opt.at, sIn, dur, linkId));
  }
  if (asset.hasAudio && opt.includeAudio !== false) {
    const tr = ensureTrack(seq, "audio", opt.audioTrackIndex ?? 0);
    clips.push(makeMediaClip(asset, seq.settings, tr.id, "audio", opt.at, sIn, dur, linkId));
  }
  if (clips.length === 1) clips[0].linkId = undefined;
  if (opt.mode === "insert") insertClips(seq, clips);
  else overwriteClips(seq, clips);
  return clips;
}

/** Lift: remove [start,end) from the given tracks leaving a gap. */
export function lift(seq: Sequence, start: number, end: number, trackIds: ID[]): void {
  for (const id of trackIds) if (!isLocked(seq, id)) clearRange(seq, id, start, end);
  normalizeTransitions(seq);
}

/** Extract: remove [start,end) and close the gap on the given + sync-locked tracks. */
export function extract(seq: Sequence, start: number, end: number, trackIds: ID[]): void {
  const tracks = rippleTracks(seq, trackIds);
  for (const id of tracks) clearRange(seq, id, start, end);
  for (const id of tracks) shiftTrackFrom(seq, id, end, -(end - start));
  for (const m of seq.markers) if (m.time >= end - EPS) m.time -= end - start;
  normalizeTransitions(seq);
}

/** Delete clips; with ripple=true close the resulting gap(s) like Premiere's Ripple Delete. */
export function deleteClips(seq: Sequence, ids: ID[], ripple = false): void {
  const victims = seq.clips.filter((c) => ids.includes(c.id) && !isLocked(seq, c.trackId));
  if (!ripple) {
    for (const v of victims) removeClip(seq, v.id);
    normalizeTransitions(seq);
    return;
  }
  // process ranges right-to-left so shifts don't disturb earlier ranges
  const ranges = victims.map((v) => ({ start: v.start, end: clipEnd(v), track: v.trackId })).sort((a, b) => b.start - a.start);
  for (const v of victims) removeClip(seq, v.id);
  const affected = [...new Set(victims.map((v) => v.trackId))];
  for (const r of ranges) {
    const len = r.end - r.start;
    // other sync-locked tracks only ripple when they are empty in this range
    const others = rippleTracks(seq, []).filter((id) => !affected.includes(id));
    const othersFree = others.every((id) => !clipsOnTrack(seq, id).some((c) => c.start < r.end - EPS && clipEnd(c) > r.start + EPS));
    const trackSet = othersFree ? [...affected, ...others] : affected;
    // gap must be free on the clip's own track too (another victim may sit there)
    for (const id of trackSet) {
      const blocking = clipsOnTrack(seq, id).some((c) => c.start < r.end - EPS && clipEnd(c) > r.start + EPS);
      if (!blocking) shiftTrackFrom(seq, id, r.end, -len);
    }
  }
  normalizeTransitions(seq);
}

/** Close the gap at time t on a track (Ripple Delete on an empty space). */
export function rippleDeleteGap(seq: Sequence, trackId: ID, t: number): boolean {
  const clips = clipsOnTrack(seq, trackId);
  let gapStart = 0;
  let gapEnd = Infinity;
  for (const c of clips) {
    if (clipEnd(c) <= t + EPS) gapStart = Math.max(gapStart, clipEnd(c));
    if (c.start >= t - EPS) { gapEnd = c.start; break; }
    if (c.start < t && clipEnd(c) > t) return false; // not a gap
  }
  if (!isFinite(gapEnd) || gapEnd - gapStart <= EPS) return false;
  const len = gapEnd - gapStart;
  const others = rippleTracks(seq, []).filter((id) => id !== trackId);
  const free = others.filter((id) => !clipsOnTrack(seq, id).some((c) => c.start < gapEnd - EPS && clipEnd(c) > gapStart + EPS));
  for (const id of [trackId, ...(free.length === others.length ? free : [])]) shiftTrackFrom(seq, id, gapEnd, -len);
  normalizeTransitions(seq);
  return true;
}

/** Remove all gaps on all video/audio tracks (close gaps). */
export function closeAllGaps(seq: Sequence, trackIds?: ID[]): void {
  for (const tr of seq.tracks) {
    if (trackIds && !trackIds.includes(tr.id)) continue;
    if (tr.locked) continue;
    let cursor = 0;
    for (const c of clipsOnTrack(seq, tr.id)) {
      if (c.start > cursor + EPS) {
        const d = c.start - cursor;
        for (const t of seq.transitions) if (t.clipBId === c.id || t.clipAId === c.id) t.at -= d;
        c.start = cursor;
      }
      cursor = clipEnd(c);
    }
  }
  normalizeTransitions(seq);
}

/**
 * Move clips by dt seconds and dTrack track-index steps (positive = up for video
 * and down for audio, mirroring Premiere). mode "overwrite" (default drag) or "insert" (Cmd-drag).
 */
export function moveClips(seq: Sequence, ids: ID[], dt: number, dTrack: number, mode: "overwrite" | "insert" = "overwrite"): void {
  const moving = seq.clips.filter((c) => ids.includes(c.id) && !isLocked(seq, c.trackId));
  if (!moving.length) return;
  const minStart = Math.min(...moving.map((c) => c.start));
  if (minStart + dt < 0) dt = -minStart;
  const plans = moving.map((c) => {
    const tr = getTrack(seq, c.trackId)!;
    const idx = Math.max(0, trackIndex(seq, c.trackId) + dTrack);
    return { c, kind: tr.kind, idx };
  });
  const movingTransitions = seq.transitions.filter((t) => moving.some((c) => c.id === t.clipAId) && (!t.clipBId || moving.some((c) => c.id === t.clipBId)));
  for (const pl of plans) seq.clips = seq.clips.filter((x) => x.id !== pl.c.id);
  const placed: Clip[] = [];
  for (const pl of plans) {
    const dest = ensureTrack(seq, pl.kind, pl.idx);
    pl.c.trackId = dest.id;
    pl.c.start = pl.c.start + dt;
    placed.push(pl.c);
  }
  for (const t of movingTransitions) {
    t.at += dt;
    const a = placed.find((c) => c.id === t.clipAId);
    if (a) t.trackId = a.trackId;
  }
  if (mode === "insert") {
    // insert each destination track group at its earliest start
    insertClips(seq, placed);
  } else {
    overwriteClips(seq, placed);
  }
  normalizeTransitions(seq);
}

export type TrimMode = "normal" | "ripple" | "roll";

/**
 * Trim an edge of a clip by delta seconds (positive = later in time).
 * normal: changes only this clip, clamped by neighbours and source media.
 * ripple: shifts later clips on ripple tracks to keep everything contiguous.
 * roll: moves the edit point between this clip and its neighbour.
 * Returns the delta actually applied.
 */
export function trimClip(project: Project | undefined, seq: Sequence, clipId: ID, edge: "in" | "out", delta: number, mode: TrimMode = "normal", minDur = 1 / 60): number {
  const c = getClip(seq, clipId);
  if (!c || isLocked(seq, c.trackId)) return 0;
  const limit = sourceLimit(project, c);
  const neighbours = clipsOnTrack(seq, c.trackId);
  const i = neighbours.findIndex((x) => x.id === c.id);
  const prev = neighbours[i - 1];
  const next = neighbours[i + 1];

  if (mode === "roll") {
    const other = edge === "out" ? next : prev;
    if (!other || Math.abs((edge === "out" ? clipEnd(c) : c.start) - (edge === "out" ? other.start : clipEnd(other))) > EPS) {
      return trimClip(project, seq, clipId, edge, delta, "normal", minDur);
    }
    const A = edge === "out" ? c : other;
    const B = edge === "out" ? other : c;
    const limA = sourceLimit(project, A);
    // clamp: A can't exceed its source, B can't go before source 0, both keep min duration
    const maxD = Math.min(B.duration - minDur, (limA - (A.sourceIn + A.duration * A.speed)) / A.speed);
    const minD = Math.max(-(A.duration - minDur), -(B.sourceIn / B.speed));
    const d = Math.min(Math.max(delta, minD), maxD);
    A.duration += d;
    B.start += d;
    B.sourceIn += d * B.speed;
    B.duration -= d;
    shiftKeyframes(B, d);
    normalizeTransitions(seq);
    return d;
  }

  let d = delta;
  if (edge === "in") {
    // moving in-point later shortens the clip
    d = Math.min(d, c.duration - minDur);
    // can't extend before source start (reversed clips: the head shows the source END)
    d = Math.max(d, c.reversed ? -((limit - (c.sourceIn + c.duration * c.speed)) / c.speed) : -(c.sourceIn / c.speed));
    if (mode === "normal" && prev) d = Math.max(d, clipEnd(prev) - c.start);
    if (mode === "normal") d = Math.max(d, -c.start);
    if (!c.reversed) c.sourceIn += d * c.speed;
    c.duration -= d;
    shiftKeyframes(c, d);
    if (mode === "normal") {
      c.start += d;
    } else {
      // ripple: the clip's start stays; everything after moves by -d
      const from = clipEnd(c) + d;
      for (const id of rippleTracks(seq, [c.trackId])) shiftTrackFrom(seq, id, from - EPS, -d);
      // our own clip may have been shifted if from <= start; restore
    }
  } else {
    d = Math.max(d, -(c.duration - minDur));
    // reversed clips: the tail shows the source START (sourceIn)
    d = Math.min(d, c.reversed ? c.sourceIn / c.speed : (limit - (c.sourceIn + c.duration * c.speed)) / c.speed);
    if (mode === "normal" && next) d = Math.min(d, next.start - clipEnd(c));
    const oldEnd = clipEnd(c);
    c.duration += d;
    if (c.reversed) c.sourceIn -= d * c.speed;
    if (mode === "ripple") {
      for (const id of rippleTracks(seq, [c.trackId])) {
        for (const x of seq.clips) if (x.trackId === id && x.id !== c.id && x.start >= oldEnd - EPS) x.start += d;
        for (const t of seq.transitions) if (t.trackId === id && t.at >= oldEnd - EPS && t.clipAId !== c.id) t.at += d;
      }
    }
  }
  normalizeTransitions(seq);
  return d;
}

/** Slip: change source in/out keeping timeline position and duration. */
export function slipClip(project: Project | undefined, seq: Sequence, clipId: ID, delta: number): void {
  const c = getClip(seq, clipId);
  if (!c || isLocked(seq, c.trackId)) return;
  const limit = sourceLimit(project, c);
  const maxIn = isFinite(limit) ? limit - c.duration * c.speed : Infinity;
  c.sourceIn = Math.min(Math.max(c.sourceIn + delta * c.speed, 0), maxIn);
}

/** Slide: move the clip between its neighbours, rolling their adjacent edit points. */
export function slideClip(project: Project | undefined, seq: Sequence, clipId: ID, delta: number): void {
  const c = getClip(seq, clipId);
  if (!c || isLocked(seq, c.trackId)) return;
  const list = clipsOnTrack(seq, c.trackId);
  const i = list.findIndex((x) => x.id === c.id);
  const prev = list[i - 1], next = list[i + 1];
  let d = delta;
  if (prev && Math.abs(clipEnd(prev) - c.start) < EPS) {
    d = Math.max(d, -(prev.duration - 1 / 60));
    d = Math.min(d, (sourceLimit(project, prev) - (prev.sourceIn + prev.duration * prev.speed)) / prev.speed);
  } else if (prev) d = Math.max(d, clipEnd(prev) - c.start);
  else d = Math.max(d, -c.start);
  if (next && Math.abs(next.start - clipEnd(c)) < EPS) {
    d = Math.min(d, next.duration - 1 / 60);
    d = Math.max(d, -(next.sourceIn / next.speed));
  } else if (next) d = Math.min(d, next.start - clipEnd(c));
  if (prev && Math.abs(clipEnd(prev) - c.start) < EPS) prev.duration += d;
  if (next && Math.abs(next.start - clipEnd(c)) < EPS) {
    next.start += d;
    next.sourceIn += d * next.speed;
    next.duration -= d;
    shiftKeyframes(next, d);
  }
  c.start += d;
  normalizeTransitions(seq);
}

/** Speed/Duration: change speed (1 = 100%). ripple shifts later clips; otherwise clamps to the next clip. */
export function setClipSpeed(project: Project | undefined, seq: Sequence, clipId: ID, speed: number, opts: { ripple?: boolean; reverse?: boolean; maintainPitch?: boolean } = {}): void {
  const c = getClip(seq, clipId);
  if (!c || speed <= 0) return;
  const srcDur = c.duration * c.speed;
  let newDur = srcDur / speed;
  const oldEnd = clipEnd(c);
  if (!opts.ripple) {
    const next = clipsOnTrack(seq, c.trackId).find((x) => x.start >= oldEnd - EPS && x.id !== c.id);
    if (next && c.start + newDur > next.start) newDur = next.start - c.start;
  }
  c.speed = speed;
  c.duration = newDur;
  if (opts.reverse !== undefined) c.reversed = opts.reverse;
  if (opts.maintainPitch !== undefined) c.maintainPitch = opts.maintainPitch;
  if (opts.ripple) for (const id of rippleTracks(seq, [c.trackId])) {
    for (const x of seq.clips) if (x.trackId === id && x.id !== c.id && x.start >= oldEnd - EPS) x.start += newDur - (oldEnd - c.start);
  }
  void sourceLimit(project, c);
  normalizeTransitions(seq);
}

export function linkClips(seq: Sequence, ids: ID[]): void {
  const lid = uid("lnk_");
  for (const c of seq.clips) if (ids.includes(c.id)) c.linkId = lid;
}

export function unlinkClips(seq: Sequence, ids: ID[]): void {
  for (const c of seq.clips) if (ids.includes(c.id)) c.linkId = undefined;
}

// ---------------------------------------------------------------- transitions

/** Add (or replace) a transition at the edit point nearest `at` on a track. */
export function addTransition(seq: Sequence, trackId: ID, at: number, type: TransitionType, duration = 1, alignment: Transition["alignment"] = "center"): Transition | null {
  const clips = clipsOnTrack(seq, trackId);
  const A = clips.find((c) => Math.abs(clipEnd(c) - at) < 0.05);
  const B = clips.find((c) => Math.abs(c.start - at) < 0.05);
  if (!A && !B) return null;
  const cut = A ? clipEnd(A) : B!.start;
  seq.transitions = seq.transitions.filter((t) => !(t.trackId === trackId && Math.abs(t.at - cut) < 0.05));
  const both = A && B;
  const tr: Transition = {
    id: uid("tr_"), trackId, type, at: cut, duration,
    alignment: both ? alignment : A ? "end" : "start",
    clipAId: A?.id, clipBId: B?.id,
  };
  void TRANSITION_MAP;
  seq.transitions.push(tr);
  return tr;
}

/** Re-anchor transitions to their clips; drop transitions whose clips are gone or no longer meet. */
export function normalizeTransitions(seq: Sequence): void {
  seq.transitions = seq.transitions.filter((t) => {
    const A = t.clipAId ? getClip(seq, t.clipAId) : undefined;
    const B = t.clipBId ? getClip(seq, t.clipBId) : undefined;
    if (t.clipAId && !A) return false;
    if (t.clipBId && !B) return false;
    if (A && B) {
      if (A.trackId !== B.trackId || Math.abs(clipEnd(A) - B.start) > EPS * 10) {
        // clips separated: keep as one-sided on A's tail
        t.clipBId = undefined;
        t.alignment = "end";
        t.at = clipEnd(A);
        t.trackId = A.trackId;
        return true;
      }
      t.at = B.start;
      t.trackId = A.trackId;
    } else if (A) {
      t.at = clipEnd(A);
      t.trackId = A.trackId;
    } else if (B) {
      t.at = B.start;
      t.trackId = B.trackId;
    }
    return true;
  });
}

/** Timeline span [start, end] a transition covers. */
export function transitionSpan(t: Transition): [number, number] {
  if (t.alignment === "start") return [t.at, t.at + t.duration];
  if (t.alignment === "end") return [t.at - t.duration, t.at];
  return [t.at - t.duration / 2, t.at + t.duration / 2];
}

// ---------------------------------------------------------------- nesting

/** Replace the given clips with a single clip referencing a new nested sequence. Returns the new sequence. */
export function nestClips(project: Project, seqId: ID, ids: ID[], name = "Nested Sequence"): Sequence | null {
  const seq = project.sequences[seqId];
  if (!seq) return null;
  const sel = seq.clips.filter((c) => ids.includes(c.id));
  if (!sel.length) return null;
  const start = Math.min(...sel.map((c) => c.start));
  const end = Math.max(...sel.map(clipEnd));
  const nested: Sequence = {
    id: uid("seq_"), name, settings: { ...seq.settings }, tracks: [], clips: [], transitions: [], markers: [],
    playhead: 0, masterVolumeDb: 0, createdAt: Date.now(),
  };
  const map = new Map<ID, ID>();
  for (const kind of ["video", "audio"] as TrackKind[]) {
    const used = tracksOfKind(seq, kind).filter((t) => sel.some((c) => c.trackId === t.id));
    const count = Math.max(used.length, 1);
    for (let i = 0; i < count; i++) {
      const tr = makeTrack(kind, i + 1);
      nested.tracks.push(tr);
      if (used[i]) map.set(used[i].id, tr.id);
    }
  }
  for (const c of sel) {
    const copy = toPlain(c);
    copy.trackId = map.get(c.trackId)!;
    copy.start = c.start - start;
    nested.clips.push(copy);
  }
  nested.transitions = toPlain(seq.transitions.filter((t) => sel.some((c) => c.id === t.clipAId)).map((t) => ({ ...t, trackId: map.get(t.trackId)!, at: t.at - start })));
  for (const c of sel) removeClip(seq, c.id);
  const topVideo = sel.map((c) => getTrack(seq, c.trackId)!).find((t) => t.kind === "video") ?? tracksOfKind(seq, "video")[0];
  seq.clips.push({
    id: uid("clp_"), trackId: topVideo.id, name, sequenceId: nested.id, start, duration: end - start, sourceIn: 0, speed: 1,
    reversed: false, maintainPitch: true, enabled: true, label: "forest",
    motion: { positionX: { value: seq.settings.width / 2 }, positionY: { value: seq.settings.height / 2 }, scale: { value: 100 }, scaleWidth: { value: 100 }, uniformScale: true, rotation: { value: 0 }, anchorX: { value: seq.settings.width / 2 }, anchorY: { value: seq.settings.height / 2 }, cropLeft: { value: 0 }, cropRight: { value: 0 }, cropTop: { value: 0 }, cropBottom: { value: 0 } },
    opacity: { opacity: { value: 100 }, blendMode: "normal" }, effects: [], masks: [], markers: [],
  });
  project.sequences[nested.id] = nested;
  project.items.push({ id: nested.id, type: "sequence", name, parentId: null });
  return nested;
}

// ---------------------------------------------------------------- summaries (used by AI + Info panel)

export function describeSequence(project: Project, seq: Sequence): string {
  const lines: string[] = [];
  const s = seq.settings;
  lines.push(`Sequence "${seq.name}" ${s.width}x${s.height} @ ${s.fps}fps, duration ${sequenceDuration(seq).toFixed(2)}s, playhead ${seq.playhead.toFixed(2)}s` + (seq.inPoint !== undefined ? `, in ${seq.inPoint.toFixed(2)}` : "") + (seq.outPoint !== undefined ? `, out ${seq.outPoint.toFixed(2)}` : ""));
  for (const tr of seq.tracks) {
    const flags = [tr.locked && "locked", tr.muted && "muted/hidden", tr.solo && "solo", !tr.syncLock && "no-sync-lock"].filter(Boolean).join(",");
    lines.push(`Track ${tr.name} (${tr.kind}, id=${tr.id}${flags ? ", " + flags : ""}):`);
    for (const c of clipsOnTrack(seq, tr.id)) {
      const src = c.assetId ? `asset=${c.assetId} src ${c.sourceIn.toFixed(2)}-${(c.sourceIn + c.duration * c.speed).toFixed(2)}` : c.generator ? `generator=${c.generator.kind}${c.generator.kind === "text" ? ` "${c.generator.style.text}"` : ""}` : c.caption ? `caption "${c.caption.text}"` : c.sequenceId ? `nested=${c.sequenceId}` : "";
      const fx = c.effects.length ? ` fx=[${c.effects.map((e) => e.type).join(",")}]` : "";
      lines.push(`  - clip ${c.id} "${c.name}" ${c.start.toFixed(2)}→${clipEnd(c).toFixed(2)}s ${src}${c.speed !== 1 ? ` speed=${c.speed}` : ""}${c.reversed ? " reversed" : ""}${c.linkId ? ` link=${c.linkId}` : ""}${!c.enabled ? " disabled" : ""}${fx}`);
    }
  }
  for (const t of seq.transitions) lines.push(`Transition ${t.id} ${t.type} at ${t.at.toFixed(2)}s dur ${t.duration}s on ${getTrack(seq, t.trackId)?.name}`);
  for (const m of seq.markers) lines.push(`Marker ${m.id} at ${m.time.toFixed(2)}s "${m.name}" ${m.color}`);
  return lines.join("\n");
}
