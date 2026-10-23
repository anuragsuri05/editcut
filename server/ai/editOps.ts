// Higher-level, PURE editing operations used by the AI agent tools (server) and
// by the deterministic AI commands in the client (src/panels/ai). Only depends on
// shared/ — no Node or DOM APIs — so both sides can import it.
// All functions mutate the Project/Sequence they are given (plain objects or immer drafts).
import type { Clip, Effect, ID, Marker, MediaAsset, Project, Sequence, TextStyle, Track, TranscriptWord } from "../../shared/types";
import {
  addTrack, clipEnd, clipsOnTrack, extract, getClip, getTrack, linkedClips, normalizeTransitions, tracksOfKind,
} from "../../shared/ops";
import {
  defaultTextStyle, fitMotion, makeCaptionClip, makeEffect, makeGeneratorClip, makeMarker, uid,
} from "../../shared/factory";
import { EFFECT_MAP } from "../../shared/effects";
import { evalParam } from "../../shared/params";

const EPS = 1e-6;
export type Range = { start: number; end: number };

export const r3 = (n: number) => Math.round(n * 1000) / 1000;

// ---------------------------------------------------------------- ranges

/** Sort and merge overlapping/adjacent ranges (gap <= joinGap). */
export function mergeRanges(ranges: Range[], joinGap = 0): Range[] {
  const sorted = ranges.filter((r) => r.end - r.start > EPS).map((r) => ({ ...r })).sort((a, b) => a.start - b.start);
  const out: Range[] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r.start <= last.end + joinGap) last.end = Math.max(last.end, r.end);
    else out.push(r);
  }
  return out;
}

/** Ids of all unlocked tracks (video, audio, caption). */
export function unlockedTrackIds(seq: Sequence): ID[] {
  return seq.tracks.filter((t) => !t.locked).map((t) => t.id);
}

/**
 * Ripple-delete sequence time ranges on the given tracks (default: all unlocked
 * tracks) — like Premiere's Extract. Ranges are processed right-to-left so earlier
 * ranges keep their coordinates. Returns total seconds removed.
 */
export function rippleDeleteRanges(seq: Sequence, ranges: Range[], trackIds?: ID[]): number {
  const merged = mergeRanges(ranges);
  const tracks = trackIds ?? unlockedTrackIds(seq);
  let removed = 0;
  for (const r of [...merged].reverse()) {
    extract(seq, r.start, r.end, tracks);
    removed += r.end - r.start;
  }
  repairLinks(seq);
  normalizeTransitions(seq);
  return removed;
}

/**
 * shared/ops clearRange() names split pieces `<linkId>_r`, so repeated range
 * deletions can leave unrelated pieces sharing one linkId. Re-pair linked clips:
 * within a link group, only clips with identical start+duration stay linked.
 */
export function repairLinks(seq: Sequence): number {
  const groups = new Map<string, Clip[]>();
  for (const c of seq.clips) if (c.linkId) groups.set(c.linkId, [...(groups.get(c.linkId) ?? []), c]);
  let fixed = 0;
  for (const [, clips] of groups) {
    const buckets = new Map<string, Clip[]>();
    for (const c of clips) {
      const k = `${Math.round(c.start * 1e4)}|${Math.round(c.duration * 1e4)}`;
      buckets.set(k, [...(buckets.get(k) ?? []), c]);
    }
    if (buckets.size === 1 && clips.length > 1) continue;
    for (const b of buckets.values()) {
      const id = b.length > 1 ? uid("lnk_") : undefined;
      for (const c of b) c.linkId = id;
      fixed++;
    }
  }
  return fixed;
}

// ---------------------------------------------------------------- asset <-> sequence time mapping

/** Clips using an asset, one representative per linked group (audio preferred, it carries the words). */
export function assetUsageClips(seq: Sequence, assetId: ID): Clip[] {
  const using = seq.clips.filter((c) => c.assetId === assetId && !c.reversed);
  const byGroup = new Map<string, Clip>();
  for (const c of using) {
    const key = c.linkId ?? c.id;
    const kind = getTrack(seq, c.trackId)?.kind;
    const prev = byGroup.get(key);
    if (!prev || (kind === "audio" && getTrack(seq, prev.trackId)?.kind !== "audio")) byGroup.set(key, c);
  }
  return [...byGroup.values()].sort((a, b) => a.start - b.start);
}

export function clipSourceRange(c: Clip): Range {
  return { start: c.sourceIn, end: c.sourceIn + c.duration * c.speed };
}

/** Map a source-time range of an asset to every sequence range where it plays. */
export function sourceRangeToSequence(seq: Sequence, assetId: ID, start: number, end: number): Range[] {
  const out: Range[] = [];
  for (const c of assetUsageClips(seq, assetId)) {
    const src = clipSourceRange(c);
    const s = Math.max(start, src.start);
    const e = Math.min(end, src.end);
    if (e - s <= EPS) continue;
    out.push({ start: c.start + (s - c.sourceIn) / c.speed, end: c.start + (e - c.sourceIn) / c.speed });
  }
  return mergeRanges(out);
}

export interface SeqWord extends TranscriptWord {
  /** Sequence time. */
  start: number;
  end: number;
  srcStart: number;
  srcEnd: number;
  assetId: ID;
  clipId: ID;
  index: number; // index inside the asset's flattened word list
}

export function flattenWords(asset: MediaAsset): TranscriptWord[] {
  return asset.transcript ? asset.transcript.segments.flatMap((s) => s.words) : [];
}

/** All transcript words that are audible in the sequence, mapped to sequence time and sorted. */
export function sequenceWords(project: Project, seq: Sequence, assetIds?: ID[]): SeqWord[] {
  const out: SeqWord[] = [];
  const assets = new Set(seq.clips.map((c) => c.assetId).filter(Boolean) as ID[]);
  for (const id of assets) {
    if (assetIds && !assetIds.includes(id)) continue;
    const asset = project.media[id];
    if (!asset?.transcript) continue;
    const words = flattenWords(asset);
    for (const c of assetUsageClips(seq, id)) {
      const tr = getTrack(seq, c.trackId);
      if (tr?.muted && tr.kind === "audio") continue;
      const src = clipSourceRange(c);
      words.forEach((w, index) => {
        const mid = (w.start + w.end) / 2;
        if (mid < src.start - EPS || mid > src.end + EPS) return;
        const s = Math.max(w.start, src.start);
        const e = Math.min(w.end, src.end);
        out.push({
          ...w, srcStart: w.start, srcEnd: w.end, assetId: id, clipId: c.id, index,
          start: r3(c.start + (s - c.sourceIn) / c.speed), end: r3(c.start + (Math.max(e, s) - c.sourceIn) / c.speed),
        });
      });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

// ---------------------------------------------------------------- filler words / silences

export const FILLER_WORDS = ["um", "uh", "uhm", "umm", "uhh", "erm", "er", "ah", "ahh", "hmm", "hm", "mm", "mhm", "eh"];
export const FILLER_PHRASES = ["you know", "i mean", "sort of", "kind of", "like", "basically", "actually", "literally", "so yeah"];

export const normWord = (t: string) => t.toLowerCase().replace(/[^a-z0-9' ]/g, "").trim();

export interface FillerHit { text: string; start: number; end: number; index: number }

/**
 * Find filler words in a word list (any time base). Single fillers always; phrases
 * (like "you know", "like") only when includePhrases. The removal range extends
 * into the following pause (up to maxPause) so the cut is clean.
 */
export function findFillers(words: TranscriptWord[], opts: { includePhrases?: boolean; extra?: string[]; maxPause?: number } = {}): FillerHit[] {
  const singles = new Set([...FILLER_WORDS, ...(opts.extra ?? []).map(normWord).filter((w) => !w.includes(" "))]);
  const phrases = [...(opts.includePhrases ? FILLER_PHRASES : []), ...(opts.extra ?? []).map(normWord).filter((w) => w.includes(" "))].map((p) => p.split(" "));
  const maxPause = opts.maxPause ?? 0.5;
  const hits: FillerHit[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = normWord(words[i].text);
    let len = 0;
    if (singles.has(w)) len = 1;
    else {
      for (const ph of phrases) {
        if (ph.every((p, k) => normWord(words[i + k]?.text ?? "") === p)) {
          len = Math.max(len, ph.length);
        }
      }
    }
    if (!len) continue;
    const first = words[i];
    const last = words[i + len - 1];
    const next = words[i + len];
    const prev = words[i - 1];
    const start = prev ? Math.max(prev.end, first.start - 0.03) : Math.max(0, first.start - 0.03);
    let end = last.end;
    if (next && next.start - last.end <= maxPause) end = next.start - 0.02;
    else end = last.end + Math.min(0.12, next ? (next.start - last.end) / 2 : 0.12);
    hits.push({ text: words.slice(i, i + len).map((x) => x.text).join(" "), start: r3(start), end: r3(Math.max(end, first.end)), index: i });
    i += len - 1;
  }
  return hits;
}

/** Shrink silent ranges by `padding` on both sides (keep breaths); drop tiny leftovers. */
export function padSilences(silences: Range[], padding = 0.12, minRemove = 0.15): Range[] {
  return silences
    .map((s) => ({ start: s.start + (s.start <= 0.001 ? 0 : padding), end: s.end - padding }))
    .filter((s) => s.end - s.start >= minRemove);
}

// ---------------------------------------------------------------- captions

export interface CaptionOptions {
  maxCharsPerLine?: number; // default 42
  lines?: 1 | 2;
  minDuration?: number; // seconds, default 0.8
  maxDuration?: number; // default 6
  gapFrames?: number; // default 2
  fps?: number;
  /** Break at a pause longer than this (s). */
  pauseBreak?: number;
  uppercase?: boolean;
}

export interface CaptionChunk { text: string; start: number; end: number }

/** Group timed words into caption chunks honoring line length, line count, pauses and sentence ends. */
export function chunkCaptions(words: { text: string; start: number; end: number }[], o: CaptionOptions = {}): CaptionChunk[] {
  const maxChars = o.maxCharsPerLine ?? 42;
  const lines = o.lines ?? 2;
  const minDur = o.minDuration ?? 0.8;
  const maxDur = o.maxDuration ?? 6;
  const gap = (o.gapFrames ?? 2) / (o.fps ?? 30);
  const pauseBreak = o.pauseBreak ?? 0.9;
  const chunks: { lines: string[]; start: number; end: number }[] = [];
  let cur: { lines: string[]; start: number; end: number } | null = null;
  let prevEnd = -Infinity;
  for (const w of words) {
    const text = (o.uppercase ? w.text.toUpperCase() : w.text).trim();
    if (!text) continue;
    const pause = w.start - prevEnd;
    const needNew =
      !cur ||
      pause > pauseBreak ||
      w.end - cur.start > maxDur ||
      (/[.!?]$/.test(cur.lines[cur.lines.length - 1] ?? "") && cur.lines.join(" ").length > maxChars * 0.5);
    if (!needNew && cur) {
      const line = cur.lines[cur.lines.length - 1];
      if ((line + " " + text).length <= maxChars) cur.lines[cur.lines.length - 1] = line + " " + text;
      else if (cur.lines.length < lines) cur.lines.push(text);
      else cur = null;
      if (cur) {
        cur.end = w.end;
        prevEnd = w.end;
        continue;
      }
    }
    cur = { lines: [text], start: w.start, end: w.end };
    chunks.push(cur);
    prevEnd = w.end;
  }
  // balance two-line captions and fix timing
  const out: CaptionChunk[] = chunks.map((c) => ({ text: balanceLines(c.lines, maxChars), start: c.start, end: c.end }));
  for (let i = 0; i < out.length; i++) {
    const c = out[i];
    const nextStart = out[i + 1]?.start ?? Infinity;
    c.end = Math.max(c.end, c.start + minDur);
    c.end = Math.min(c.end, nextStart - gap);
    if (c.end <= c.start) c.end = c.start + Math.max(0.1, (nextStart - c.start) * 0.9);
    c.start = r3(c.start);
    c.end = r3(c.end);
  }
  return out;
}

function balanceLines(lines: string[], maxChars: number): string {
  if (lines.length !== 2) return lines.join("\n");
  const words = lines.join(" ").split(" ");
  let best = lines;
  let bestDiff = Math.abs(lines[0].length - lines[1].length);
  for (let k = 1; k < words.length; k++) {
    const a = words.slice(0, k).join(" ");
    const b = words.slice(k).join(" ");
    if (a.length > maxChars || b.length > maxChars) continue;
    const d = Math.abs(a.length - b.length);
    if (d < bestDiff) {
      bestDiff = d;
      best = [a, b];
    }
  }
  return best.join("\n");
}

export function captionTrack(seq: Sequence, create = true): Track | undefined {
  const existing = tracksOfKind(seq, "caption")[0];
  if (existing || !create) return existing;
  const tr = addTrack(seq, "caption");
  tr.name = "Subtitles";
  return tr;
}

/** Social-style burned-in caption look: big, bold, outlined, centered words. */
export function socialCaptionStyle(seq: Sequence, text: string): TextStyle {
  const h = seq.settings.height;
  const w = seq.settings.width;
  const size = Math.round(Math.min(h * 0.07, w * 0.11));
  return {
    ...defaultTextStyle(text),
    fontFamily: "Inter, 'Arial Black', Helvetica, sans-serif",
    fontSize: size,
    fontWeight: 900,
    color: "#ffffff",
    strokeColor: "#000000",
    strokeWidth: Math.max(2, Math.round(size * 0.09)),
    shadow: { color: "rgba(0,0,0,0.55)", blur: Math.round(size * 0.15), offsetX: 0, offsetY: Math.round(size * 0.05) },
    lineHeight: 1.1,
  };
}

export interface AddCaptionsResult { count: number; trackId: ID; clipIds: ID[] }

/**
 * Create captions from sequence-timed words. style "standard" = caption track
 * (sidecar/burnable subtitles), "social" = text graphics on a new top video track.
 */
export function addCaptionClips(seq: Sequence, words: { text: string; start: number; end: number }[], opts: CaptionOptions & { style?: "standard" | "social"; replace?: boolean; highlightColor?: string } = {}): AddCaptionsResult {
  const style = opts.style ?? "standard";
  const fps = opts.fps ?? seq.settings.fps;
  if (style === "standard") {
    const tr = captionTrack(seq)!;
    if (opts.replace !== false) seq.clips = seq.clips.filter((c) => c.trackId !== tr.id);
    const chunks = chunkCaptions(words, { ...opts, fps });
    const ids: ID[] = [];
    for (const ch of chunks) {
      const c = makeCaptionClip(tr.id, ch.start, ch.end - ch.start, ch.text);
      seq.clips.push(c);
      ids.push(c.id);
    }
    return { count: chunks.length, trackId: tr.id, clipIds: ids };
  }
  // social: short 1-line chunks, uppercase, graphic clips on a dedicated top track
  let tr = seq.tracks.find((t) => t.kind === "video" && t.name === "Captions");
  if (tr && opts.replace !== false) seq.clips = seq.clips.filter((c) => c.trackId !== tr!.id);
  if (!tr) {
    tr = addTrack(seq, "video");
    tr.name = "Captions";
  }
  const chunks = chunkCaptions(words, { maxCharsPerLine: opts.maxCharsPerLine ?? 18, lines: opts.lines ?? 1, minDuration: opts.minDuration ?? 0.3, maxDuration: 2.5, gapFrames: 0, fps, uppercase: opts.uppercase ?? true, pauseBreak: 0.6 });
  const ids: ID[] = [];
  const vertical = seq.settings.height > seq.settings.width;
  for (const ch of chunks) {
    const st = socialCaptionStyle(seq, ch.text);
    const clip = makeGeneratorClip({ kind: "text", style: st }, seq.settings, tr.id, ch.start, ch.end - ch.start, ch.text);
    clip.motion!.positionY.value = Math.round(seq.settings.height * (vertical ? 0.68 : 0.8));
    // quick "pop" in: scale 85% -> 100% over 4 frames
    clip.motion!.scale.keyframes = [{ t: 0, v: 85, interp: "easeOut" }, { t: Math.min(4 / fps, clip.duration / 2), v: 100, interp: "linear" }];
    clip.label = "yellow";
    seq.clips.push(clip);
    ids.push(clip.id);
  }
  return { count: chunks.length, trackId: tr.id, clipIds: ids };
}

/** SRT text for caption clips (caption track) or text graphics. */
export function captionsToSrt(clips: Clip[]): string {
  const ts = (t: number) => {
    const ms = Math.max(0, Math.round(t * 1000));
    const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000), f = ms % 1000;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(f).padStart(3, "0")}`;
  };
  return clips
    .slice()
    .sort((a, b) => a.start - b.start)
    .map((c, i) => `${i + 1}\n${ts(c.start)} --> ${ts(clipEnd(c))}\n${c.caption?.text ?? (c.generator?.kind === "text" ? c.generator.style.text : "")}\n`)
    .join("\n");
}

// ---------------------------------------------------------------- text / titles

export type TextPosition = "center" | "lower_third" | "top" | "bottom" | "upper_third";

/** Find (or create) a video track above all media that is free in [start, end). */
export function freeVideoTrackAbove(seq: Sequence, start: number, end: number, minIndex = 1): Track {
  const vids = tracksOfKind(seq, "video");
  // lowest index above any media clip in the range
  let floor = minIndex;
  vids.forEach((t, i) => {
    if (seq.clips.some((c) => c.trackId === t.id && !c.generator && c.start < end - EPS && clipEnd(c) > start + EPS)) floor = Math.max(floor, i + 1);
  });
  for (let i = floor; i < vids.length; i++) {
    const t = vids[i];
    if (t.locked || t.name === "Captions") continue;
    if (!clipsOnTrack(seq, t.id).some((c) => c.start < end - EPS && clipEnd(c) > start + EPS)) return t;
  }
  return addTrack(seq, "video");
}

export interface AddTextOptions {
  text: string;
  start: number;
  duration: number;
  position?: TextPosition;
  style?: Partial<TextStyle>;
  fadeIn?: number;
  fadeOut?: number;
  trackId?: ID;
}

export function addTextClip(seq: Sequence, o: AddTextOptions): Clip {
  const { width: W, height: H } = seq.settings;
  const pos = o.position ?? "center";
  const base = defaultTextStyle(o.text);
  const scale = Math.min(W / 1920, H / 1080) || 1;
  const sizes: Record<TextPosition, number> = { center: 110, upper_third: 84, top: 72, lower_third: 54, bottom: 48 };
  const style: TextStyle = { ...base, fontSize: Math.round(sizes[pos] * (H > W ? W / 1080 : scale)), ...o.style, text: o.text };
  if (pos === "lower_third" && !o.style?.background) style.background = { color: "rgba(0,0,0,0.6)", padding: Math.round(style.fontSize * 0.4), radius: 6 };
  const tr = o.trackId ? getTrack(seq, o.trackId) ?? freeVideoTrackAbove(seq, o.start, o.start + o.duration) : freeVideoTrackAbove(seq, o.start, o.start + o.duration);
  const clip = makeGeneratorClip({ kind: "text", style }, seq.settings, tr.id, o.start, o.duration);
  const yFrac: Record<TextPosition, number> = { center: 0.5, upper_third: 0.3, top: 0.12, lower_third: 0.8, bottom: 0.9 };
  clip.motion!.positionY.value = Math.round(H * yFrac[pos]);
  const fi = o.fadeIn ?? 0.3, fo = o.fadeOut ?? 0.3;
  if (fi > 0 || fo > 0) {
    const kf: { t: number; v: number; interp: "linear" }[] = [];
    if (fi > 0) kf.push({ t: 0, v: 0, interp: "linear" }, { t: Math.min(fi, o.duration / 2), v: 100, interp: "linear" });
    if (fo > 0) kf.push({ t: Math.max(o.duration - fo, o.duration / 2), v: 100, interp: "linear" }, { t: o.duration, v: 0, interp: "linear" });
    clip.opacity!.opacity.keyframes = kf.sort((a, b) => a.t - b.t);
  }
  seq.clips.push(clip);
  return clip;
}

// ---------------------------------------------------------------- color / effects

export function upsertEffect(clip: Clip, type: string, params: Record<string, number> = {}, options: Record<string, string | boolean> = {}): Effect {
  const def = EFFECT_MAP[type];
  if (!def) throw new Error(`Unknown effect type "${type}"`);
  let fx = clip.effects.find((e) => e.type === type);
  if (!fx) {
    fx = makeEffect(type);
    clip.effects.push(fx);
  }
  for (const [k, v] of Object.entries(params)) {
    const pd = def.params.find((p) => p.key === k);
    if (!pd) throw new Error(`Effect ${type} has no parameter "${k}". Valid: ${def.params.map((p) => p.key).join(", ")}`);
    fx.params[k] = { value: Math.min(pd.max, Math.max(pd.min, v)) };
  }
  for (const [k, v] of Object.entries(options)) {
    const od = def.options?.find((p) => p.key === k);
    if (!od) throw new Error(`Effect ${type} has no option "${k}"`);
    if (od.type === "select" && od.choices && !od.choices.includes(String(v))) throw new Error(`Option ${k} must be one of: ${od.choices.join(", ")}`);
    fx.options = { ...(fx.options ?? {}), [k]: v };
  }
  fx.enabled = true;
  return fx;
}

/** Premiere-style "Enhance Speech" chain built from stock audio effects. */
export function enhanceSpeech(clip: Clip, amount = 1): void {
  upsertEffect(clip, "highpass", { freq: 80 });
  upsertEffect(clip, "denoise", { amount: Math.round(45 * amount) });
  upsertEffect(clip, "eq3", { low: -2, mid: 2 * amount, midFreq: 3000, high: 2.5 * amount });
  upsertEffect(clip, "dynamics", { threshold: -24, ratio: 3, attack: 8, release: 120, makeup: 4 });
  upsertEffect(clip, "hardLimiter", { ceiling: -1 });
}

export const isVisualClip = (seq: Sequence, c: Clip) => getTrack(seq, c.trackId)?.kind === "video";
export const isAudioClip = (seq: Sequence, c: Clip) => getTrack(seq, c.trackId)?.kind === "audio";

/** Create an adjustment layer spanning [start,end) on a free top track. */
export function addAdjustmentLayer(seq: Sequence, start: number, end: number, name = "Color Grade"): Clip {
  const tr = freeVideoTrackAbove(seq, start, end);
  const clip = makeGeneratorClip({ kind: "adjustmentLayer" }, seq.settings, tr.id, start, end - start, name);
  seq.clips.push(clip);
  return clip;
}

// ---------------------------------------------------------------- audio: volume, fades, ducking

export function setVolume(clip: Clip, db: number | undefined, fadeIn = 0, fadeOut = 0): void {
  if (!clip.audio) throw new Error(`Clip ${clip.id} is not an audio clip`);
  const base = db ?? evalParam(clip.audio.volumeDb, 0, 0);
  clip.audio.volumeDb = { value: base };
  const kf: { t: number; v: number; interp: "linear" }[] = [];
  if (fadeIn > 0) kf.push({ t: 0, v: -60, interp: "linear" }, { t: Math.min(fadeIn, clip.duration / 2), v: base, interp: "linear" });
  if (fadeOut > 0) kf.push({ t: Math.max(clip.duration - fadeOut, clip.duration / 2), v: base, interp: "linear" }, { t: clip.duration, v: -60, interp: "linear" });
  if (kf.length) clip.audio.volumeDb.keyframes = dedupeKf(kf);
}

function dedupeKf<T extends { t: number }>(kf: T[]): T[] {
  const s = kf.sort((a, b) => a.t - b.t);
  return s.filter((k, i) => i === 0 || Math.abs(k.t - s[i - 1].t) > 1e-4);
}

/** Lower music clips under speech ranges (sequence time) using volume keyframes. */
export function duckClips(musicClips: Clip[], speech: Range[], duckDb = -12, fade = 0.35): number {
  let n = 0;
  const merged = mergeRanges(speech, fade * 2 + 0.3);
  for (const c of musicClips) {
    if (!c.audio) continue;
    const base = c.audio.volumeDb.keyframes?.length ? evalParam(c.audio.volumeDb, 0, 0) : c.audio.volumeDb.value;
    const low = base + duckDb;
    const kf: { t: number; v: number; interp: "linear" }[] = [];
    for (const r of merged) {
      const s = r.start - c.start, e = r.end - c.start;
      if (e <= 0 || s >= c.duration) continue;
      const a = Math.max(0, s - fade), b = Math.max(0, s), d = Math.min(c.duration, e), f = Math.min(c.duration, e + fade);
      if (a > 0 || b > 0) kf.push({ t: r3(a), v: base, interp: "linear" });
      kf.push({ t: r3(b), v: low, interp: "linear" }, { t: r3(d), v: low, interp: "linear" });
      if (f < c.duration) kf.push({ t: r3(f), v: base, interp: "linear" });
      n++;
    }
    c.audio.volumeDb = kf.length ? { value: base, keyframes: dedupeKf(kf) } : { value: base };
  }
  return n;
}

// ---------------------------------------------------------------- reframe

export interface ReframeOptions {
  width: number;
  height: number;
  /** Per-clip horizontal/vertical focus (0..1 in SOURCE frame), default 0.5/0.5. */
  focus?: Record<ID, { x?: number; y?: number }>;
  /** Only refit these clips (frame size unchanged unless width/height differ). */
  only?: ID[];
}

/** Fill the new frame with each visual media clip, keeping its focus point in frame. */
export function reframeSequence(project: Project, seq: Sequence, o: ReframeOptions): number {
  const oldW = seq.settings.width, oldH = seq.settings.height;
  seq.settings.width = o.width;
  seq.settings.height = o.height;
  let n = 0;
  for (const c of seq.clips) {
    if (!isVisualClip(seq, c) || !c.motion) continue;
    if (o.only && !o.only.includes(c.id)) continue;
    if (c.assetId) {
      const a = project.media[c.assetId];
      const sw = a?.width ?? oldW, sh = a?.height ?? oldH;
      const m = fitMotion(seq.settings, sw, sh, "fill");
      const s = m.scale.value / 100;
      const f = o.focus?.[c.id] ?? {};
      const fx = f.x ?? 0.5, fy = f.y ?? 0.5;
      const dw = sw * s, dh = sh * s;
      // position of the source center so that focus point lands at frame center, clamped to keep the frame covered
      const px = o.width / 2 + (0.5 - fx) * dw;
      const py = o.height / 2 + (0.5 - fy) * dh;
      m.positionX.value = Math.round(clamp(px, o.width - dw / 2, dw / 2));
      m.positionY.value = Math.round(clamp(py, o.height - dh / 2, dh / 2));
      m.rotation = c.motion.rotation;
      c.motion = m;
      n++;
    } else if (c.generator) {
      // keep graphics proportionally placed, shrink text to fit the narrower frame
      const kx = o.width / oldW, ky = o.height / oldH;
      c.motion.positionX = { value: Math.round(evalParam(c.motion.positionX, 0, oldW / 2) * kx) };
      c.motion.positionY = { value: Math.round(evalParam(c.motion.positionY, 0, oldH / 2) * ky) };
      c.motion.anchorX = { value: o.width / 2 };
      c.motion.anchorY = { value: o.height / 2 };
      if (c.generator.kind === "text") {
        const k = Math.min(kx, ky);
        if (k < 1) c.generator.style.fontSize = Math.max(12, Math.round(c.generator.style.fontSize * Math.max(k, 0.55)));
      } else if (c.generator.kind === "shape") {
        c.generator.width = Math.round(c.generator.width * kx);
        c.generator.height = Math.round(c.generator.height * ky);
      }
      n++;
    }
  }
  return n;
}

const clamp = (v: number, a: number, b: number) => (a <= b ? Math.min(b, Math.max(a, v)) : (a + b) / 2);

/** Deep-copy a sequence with fresh ids (clips, tracks, links, transitions). */
export function duplicateSequence(project: Project, seqId: ID, name: string): { seq: Sequence; clipMap: Map<ID, ID> } {
  const src = project.sequences[seqId];
  const copy: Sequence = JSON.parse(JSON.stringify(src));
  copy.id = uid("seq_");
  copy.name = name;
  copy.createdAt = Date.now();
  const trackMap = new Map<ID, ID>();
  for (const t of copy.tracks) {
    const n = uid("trk_");
    trackMap.set(t.id, n);
    t.id = n;
  }
  const clipMap = new Map<ID, ID>();
  const linkMap = new Map<ID, ID>();
  for (const c of copy.clips) {
    const n = uid("clp_");
    clipMap.set(c.id, n);
    c.id = n;
    c.trackId = trackMap.get(c.trackId)!;
    if (c.linkId) {
      if (!linkMap.has(c.linkId)) linkMap.set(c.linkId, uid("lnk_"));
      c.linkId = linkMap.get(c.linkId);
    }
  }
  for (const t of copy.transitions) {
    t.id = uid("tr_");
    t.trackId = trackMap.get(t.trackId)!;
    if (t.clipAId) t.clipAId = clipMap.get(t.clipAId);
    if (t.clipBId) t.clipBId = clipMap.get(t.clipBId);
  }
  for (const m of copy.markers) m.id = uid("mk_");
  project.sequences[copy.id] = copy;
  const item = project.items.find((i) => i.id === seqId);
  project.items.push({ id: copy.id, type: "sequence", name, parentId: item?.parentId ?? null });
  return { seq: copy, clipMap };
}

// ---------------------------------------------------------------- beats

/** Re-time consecutive clips on a track so every cut lands on a beat. Linked partners follow. */
export function cutClipsToBeats(project: Project, seq: Sequence, trackId: ID, beats: number[], beatsPerCut = 2, startAt?: number): { cuts: number; endsAt: number } {
  const clips = clipsOnTrack(seq, trackId).filter((c) => !c.generator);
  if (!clips.length || beats.length < 2) return { cuts: 0, endsAt: 0 };
  const first = startAt ?? clips[0].start;
  let bi = beats.findIndex((b) => b >= first - 0.02);
  if (bi < 0) bi = 0;
  let cursor = beats[bi];
  for (const c of clips) {
    const partners = linkedClips(seq, c);
    const srcLeft = (() => {
      if (!c.assetId) return Infinity;
      const a = project.media[c.assetId];
      if (!a || a.kind === "image") return Infinity;
      return (a.duration - c.sourceIn) / c.speed;
    })();
    let k = beatsPerCut;
    let end = beats[bi + k] ?? cursor + (beats[1] - beats[0]) * k;
    while (k > 1 && end - cursor > Math.min(srcLeft, c.duration * 4)) {
      k--;
      end = beats[bi + k] ?? cursor + (beats[1] - beats[0]) * k;
    }
    const dur = Math.min(end - cursor, srcLeft);
    for (const p of partners) {
      p.start = cursor;
      p.duration = dur;
    }
    bi += k;
    cursor = cursor + dur;
  }
  normalizeTransitions(seq);
  return { cuts: clips.length, endsAt: r3(cursor) };
}

// ---------------------------------------------------------------- markers

export function addMarker(seq: Sequence, time: number, init: Partial<Marker> = {}): Marker {
  const m = makeMarker(time, init);
  seq.markers.push(m);
  seq.markers.sort((a, b) => a.time - b.time);
  return m;
}

export { getClip };
