// Claude's editing tools. Each tool has a zod schema (validated before running;
// also converted to the JSON schema sent to the API), a description, and an
// executor that mutates the per-request project copy via shared/ops + editOps.
import { z } from "zod";
import fs from "node:fs";
import type { AIEvent } from "../../src/api";
import type { Clip, ExportSettings, ID, MarkerColor, MediaAsset, Project, Sequence, Track, TransitionType } from "../../shared/types";
import {
  addTransition, clipEnd, clipsAtTime, clipsOnTrack, closeAllGaps, deleteClips, editPoints, ensureTrack, expandLinked,
  getClip, getTrack, lift, linkedClips, moveClips, placeAsset, setClipSpeed, sequenceDuration, sourceTimeAt, splitAt,
  trackIndex, tracksOfKind, trimClip, describeSequence,
} from "../../shared/ops";
import { SEQUENCE_PRESETS, makeSequence } from "../../shared/factory";
import { EFFECTS, EFFECT_MAP, LOOKS, TRANSITIONS, TRANSITION_MAP } from "../../shared/effects";
import {
  addCaptionClips, addMarker, addTextClip, assetUsageClips, cutClipsToBeats, duckClips, duplicateSequence, enhanceSpeech,
  findFillers, flattenWords, isAudioClip, isVisualClip, mergeRanges, padSilences, r3, reframeSequence, rippleDeleteRanges,
  sequenceWords, setVolume, repairLinks, sourceRangeToSequence, upsertEffect, addAdjustmentLayer, type Range, type TextPosition,
} from "./editOps";
import { frameJpeg, sceneCuts, silences, detectBeats, assetPathFromRecord } from "./mediaTools";
import { transcribeMedia, whisperStatus } from "./transcribe";
import * as exportModule from "../export/index";
import { EXPORT_PRESETS, PRESET_MAP, applyPreset, defaultExportSettings } from "../../shared/exportPresets";

// ---------------------------------------------------------------- framework

export interface ToolContext {
  project: Project;
  playhead: number;
  selection: { clipIds: ID[]; itemIds: ID[] };
  signal: AbortSignal;
  emit: (e: AIEvent) => void;
}

export interface ToolImage { data: string; mediaType: "image/jpeg" }
export interface ToolOutput {
  /** Full result for Claude. */
  text: string;
  /** Short line for the UI activity row. */
  summary?: string;
  images?: ToolImage[];
  /** For mutating tools: undo/step label (shown as "AI: <label>"). */
  label?: string;
}

interface ToolDef<S extends z.ZodType = z.ZodType> {
  name: string;
  description: string;
  schema: S;
  mutates: boolean;
  run: (input: z.infer<S>, ctx: ToolContext) => Promise<ToolOutput | string> | ToolOutput | string;
}

const tools: ToolDef[] = [];
function tool<S extends z.ZodType>(def: ToolDef<S>): void {
  tools.push(def as unknown as ToolDef);
}

export class ToolError extends Error {}
const fail = (msg: string): never => {
  throw new ToolError(msg);
};

// ---------------------------------------------------------------- helpers

const f2 = (n: number) => (Math.round(n * 100) / 100).toFixed(2);
const sec = z.number();

function activeSeq(ctx: ToolContext): Sequence {
  const id = ctx.project.activeSequenceId;
  const seq = id ? ctx.project.sequences[id] : undefined;
  if (!seq) fail("There is no active sequence. Create one with create_sequence (or set_active_sequence).");
  return seq!;
}

function assetOf(ctx: ToolContext, id: string): MediaAsset {
  const a = ctx.project.media[id];
  if (!a) fail(`Unknown asset_id "${id}". Valid ids: ${Object.keys(ctx.project.media).join(", ") || "(no media imported)"}`);
  if (a!.status === "error") fail(`Asset ${id} failed to import: ${a!.error ?? "unknown error"}`);
  return a!;
}

async function assetPath(a: MediaAsset): Promise<string> {
  if (a.path && fs.existsSync(a.path)) return a.path;
  const rec = await assetPathFromRecord(a.id);
  if (rec && fs.existsSync(rec)) return rec;
  return fail(`The file for "${a.name}" is not available on disk (${a.path || "no path"}).`);
}

function clipOf(seq: Sequence, id: string): Clip {
  const c = getClip(seq, id);
  if (!c) fail(`Clip "${id}" not found in sequence "${seq.name}". Call get_timeline to see current clip ids.`);
  return c!;
}

/** Resolve "V1" / "A2" / "C1" / track id. With create=true, missing numbered tracks are added. */
function trackRef(seq: Sequence, ref: string, create = false): Track {
  const byId = getTrack(seq, ref);
  if (byId) return byId;
  const m = /^([VAC])(\d+)$/i.exec(ref.trim());
  if (m) {
    const kind = m[1].toUpperCase() === "V" ? "video" : m[1].toUpperCase() === "A" ? "audio" : "caption";
    const idx = Number(m[2]) - 1;
    const list = tracksOfKind(seq, kind);
    if (list[idx]) return list[idx];
    if (create) return ensureTrack(seq, kind, idx);
  }
  const byName = seq.tracks.find((t) => t.name.toLowerCase() === ref.trim().toLowerCase());
  if (byName) return byName;
  return fail(`Unknown track "${ref}". Tracks: ${seq.tracks.map((t) => t.name).join(", ")}`);
}

function clipLine(seq: Sequence, c: Clip): string {
  const tr = getTrack(seq, c.trackId)?.name ?? "?";
  const src = c.assetId ? ` src ${f2(c.sourceIn)}–${f2(c.sourceIn + c.duration * c.speed)}` : "";
  return `${c.id} [${tr}] ${f2(c.start)}–${f2(clipEnd(c))}s "${c.name}"${src}`;
}

function linkedIds(seq: Sequence, ids: string[], include = true): string[] {
  for (const id of ids) clipOf(seq, id);
  return include ? expandLinked(seq, ids) : ids;
}

/** Audio clip(s) for a clip id: itself if audio, else its linked audio partners. */
function audioClipsFor(seq: Sequence, id: string): Clip[] {
  const c = clipOf(seq, id);
  if (isAudioClip(seq, c)) return [c];
  return linkedClips(seq, c).filter((x) => isAudioClip(seq, x));
}

function visualMediaClips(seq: Sequence): Clip[] {
  return seq.clips.filter((c) => isVisualClip(seq, c) && (c.assetId || c.sequenceId));
}

function formatTranscript(a: MediaAsset, start = 0, end = Infinity, words = true, maxWords = 900): string {
  if (!a.transcript) return `(no transcript for ${a.id})`;
  const lines: string[] = [];
  let count = 0;
  let truncated = false;
  for (const s of a.transcript.segments) {
    if (s.end < start || s.start > end) continue;
    lines.push(`[${f2(s.start)}–${f2(s.end)}] ${s.text}`);
    if (words) {
      if (count + s.words.length > maxWords) {
        truncated = true;
        continue;
      }
      count += s.words.length;
      lines.push("   " + s.words.map((w) => `${w.text}[${f2(w.start)},${f2(w.end)}]`).join(" "));
    }
  }
  if (truncated) lines.push(`(word timings truncated at ${maxWords} words — call get_transcript with start/end for a range)`);
  return lines.join("\n");
}

async function ensureTranscript(ctx: ToolContext, a: MediaAsset, language?: string): Promise<MediaAsset> {
  if (a.transcript) return a;
  if (!a.hasAudio) fail(`"${a.name}" has no audio to transcribe.`);
  const w = whisperStatus();
  if (!w.available) fail("Speech-to-text is unavailable: whisper.cpp or a whisper model is missing (see AI Settings).");
  const p = await assetPath(a);
  a.transcript = await transcribeMedia(a.id, p, { language, signal: ctx.signal });
  return a;
}

function usedAssetIds(seq: Sequence): ID[] {
  return [...new Set(seq.clips.map((c) => c.assetId).filter(Boolean) as ID[])];
}

// ---------------------------------------------------------------- inspection tools

tool({
  name: "get_timeline",
  description:
    "Describe the active sequence: settings, every track with its clips (ids, timeline start→end in seconds, source in/out, links, effects), transitions, markers, playhead, in/out and the user's current selection. Also lists all sequences. Pass clip_ids to get full JSON detail (motion, opacity, audio volume, effect params, keyframes) for specific clips. Call this before editing and again to verify your edits.",
  schema: z.object({ clip_ids: z.array(z.string()).optional().describe("Clips to return in full detail.") }),
  mutates: false,
  run: ({ clip_ids }, ctx) => {
    const p = ctx.project;
    const lines: string[] = [];
    lines.push("Sequences: " + (Object.values(p.sequences).map((s) => `${s.id} "${s.name}" ${s.settings.width}x${s.settings.height}${s.id === p.activeSequenceId ? " (active)" : ""}`).join("; ") || "none"));
    const seq = p.activeSequenceId ? p.sequences[p.activeSequenceId] : undefined;
    if (!seq) return lines.concat("No active sequence.").join("\n");
    lines.push(describeSequence(p, seq));
    lines.push(`Playhead: ${f2(ctx.playhead)}s. Selected clips: ${ctx.selection.clipIds.join(", ") || "none"}.`);
    for (const id of clip_ids ?? []) {
      const c = clipOf(seq, id);
      lines.push(`Detail ${id}: ` + JSON.stringify({ ...c, effects: c.effects.map((e) => ({ id: e.id, type: e.type, enabled: e.enabled, params: Object.fromEntries(Object.entries(e.params).map(([k, v]) => [k, v.keyframes?.length ? v : v.value])), options: e.options })) }));
    }
    return { text: lines.join("\n"), summary: `${seq.clips.length} clips, ${f2(sequenceDuration(seq))}s` };
  },
});

tool({
  name: "list_media",
  description:
    "List every media asset in the project: id, name, kind (video/audio/image), duration, resolution, fps, audio presence, file size, whether a transcript exists (with its opening words), media In/Out marks, and how often it is used in the active sequence. Never invent asset ids — use the ids from here.",
  schema: z.object({}),
  mutates: false,
  run: (_i, ctx) => {
    const seq = ctx.project.activeSequenceId ? ctx.project.sequences[ctx.project.activeSequenceId] : undefined;
    const list = Object.values(ctx.project.media);
    if (!list.length) return { text: "No media in the project. Ask the user to import footage.", summary: "No media" };
    const lines = list.map((a) => {
      const words = a.transcript ? flattenWords(a) : [];
      const uses = seq ? assetUsageClips(seq, a.id).length : 0;
      return [
        `${a.id} "${a.name}" ${a.kind}${a.status !== "ready" ? ` [${a.status}]` : ""}`,
        a.kind === "image" ? "still" : `${f2(a.duration)}s`,
        a.width ? `${a.width}x${a.height}` : "",
        a.fps ? `${a.fps}fps` : "",
        a.hasVideo ? "video" : "",
        a.hasAudio ? `audio${a.audioChannels ? ` ${a.audioChannels}ch` : ""}` : "no-audio",
        a.sizeBytes ? `${(a.sizeBytes / 1e6).toFixed(1)}MB` : "",
        a.transcript ? `transcript: ${words.length} words "${words.slice(0, 14).map((w) => w.text).join(" ")}${words.length > 14 ? "…" : ""}"` : "no transcript",
        a.inPoint !== undefined || a.outPoint !== undefined ? `marks ${f2(a.inPoint ?? 0)}–${f2(a.outPoint ?? a.duration)}` : "",
        a.markers?.length ? `${a.markers.length} markers` : "",
        seq ? `used ${uses}x in active sequence` : "",
      ].filter(Boolean).join(", ");
    });
    return { text: lines.join("\n"), summary: `${list.length} assets` };
  },
});

const timesSchema = {
  times: z.array(sec).optional().describe("Specific times in seconds (max 8)."),
  count: z.number().int().optional().describe("Instead of times: this many evenly spaced frames (default 4, max 8)."),
  width: z.number().int().optional().describe("Frame width in px (default 512, max 768)."),
};

function pickTimes(duration: number, times?: number[], count?: number): number[] {
  if (times?.length) return times.slice(0, 8);
  const n = Math.max(1, Math.min(8, count ?? 4));
  return Array.from({ length: n }, (_, i) => r3(((i + 0.5) / n) * Math.max(duration, 0.04)));
}

tool({
  name: "view_media_frames",
  description:
    "Look at a media asset: returns JPEG frames sampled at the given source times (or evenly spaced) so you can see the footage — content, framing, subject position, lighting, color. Use it to choose shots, find the best moments, decide reframe focus points, and judge color. Costs tokens: keep counts small.",
  schema: z.object({ asset_id: z.string(), ...timesSchema }),
  mutates: false,
  run: async ({ asset_id, times, count, width }, ctx) => {
    const a = assetOf(ctx, asset_id);
    if (!a.hasVideo) fail(`"${a.name}" has no video frames (audio only).`);
    const p = await assetPath(a);
    const ts = pickTimes(a.kind === "image" ? 0.04 : a.duration, times, count).map((t) => Math.max(0, Math.min(t, Math.max(0, a.duration - 0.05))));
    const w = Math.min(768, width ?? 512);
    const images: ToolImage[] = [];
    const labels: string[] = [];
    for (const t of ts) {
      const buf = await frameJpeg(p, a.kind === "image" ? 0 : t, w, ctx.signal);
      images.push({ data: buf.toString("base64"), mediaType: "image/jpeg" });
      labels.push(`Frame ${images.length}: "${a.name}" at ${f2(t)}s`);
    }
    return { text: labels.join("\n"), images, summary: `${images.length} frames of ${a.name}` };
  },
});

tool({
  name: "view_timeline_frames",
  description:
    "Look at the edited sequence: for each sequence time, returns the frame of the topmost visible media clip at that time (source frame, before effects/color/motion), labelled with the clip and any text/caption overlays on top. Use it to verify a cut, check shot order or pick reframe focus points.",
  schema: z.object(timesSchema),
  mutates: false,
  run: async ({ times, count, width }, ctx) => {
    const seq = activeSeq(ctx);
    const dur = sequenceDuration(seq);
    if (dur <= 0) fail("The sequence is empty.");
    const ts = pickTimes(dur, times, count);
    const w = Math.min(768, width ?? 512);
    const images: ToolImage[] = [];
    const labels: string[] = [];
    const vids = tracksOfKind(seq, "video");
    for (const t of ts) {
      const layers = clipsAtTime(seq, t)
        .filter((c) => c.enabled && isVisualClip(seq, c) && !getTrack(seq, c.trackId)?.muted)
        .sort((a, b) => vids.findIndex((v) => v.id === b.trackId) - vids.findIndex((v) => v.id === a.trackId));
      const overlays = layers.filter((c) => c.generator).map((c) => (c.generator!.kind === "text" ? `text "${c.generator!.style.text}"` : c.generator!.kind));
      const captions = seq.clips.filter((c) => c.caption && t >= c.start && t < clipEnd(c)).map((c) => `caption "${c.caption!.text}"`);
      const media = layers.find((c) => c.assetId && ctx.project.media[c.assetId]?.hasVideo);
      if (!media) {
        labels.push(`t=${f2(t)}s: no media visible${overlays.length ? ` (overlays: ${overlays.join(", ")})` : " (black)"}`);
        continue;
      }
      const a = ctx.project.media[media.assetId!];
      const st = sourceTimeAt(media, t);
      try {
        const buf = await frameJpeg(await assetPath(a), a.kind === "image" ? 0 : st, w, ctx.signal);
        images.push({ data: buf.toString("base64"), mediaType: "image/jpeg" });
        labels.push(`Image ${images.length}: t=${f2(t)}s clip ${media.id} [${getTrack(seq, media.trackId)?.name}] "${a.name}" @src ${f2(st)}s${overlays.length ? `; overlays: ${overlays.join(", ")}` : ""}${captions.length ? `; ${captions.join(", ")}` : ""}${media.effects.length ? `; effects not shown: ${media.effects.map((e) => e.type).join(",")}` : ""}`);
      } catch (e) {
        labels.push(`t=${f2(t)}s: could not read frame (${(e as Error).message})`);
      }
    }
    return { text: labels.join("\n"), images, summary: `${images.length} timeline frames` };
  },
});

tool({
  name: "transcribe_media",
  description:
    "Speech-to-text (local whisper.cpp) for an asset with audio. Returns segments with timestamps and per-word timings in SOURCE seconds (word[start,end]). Cached on the asset, so it's cheap to call again. Required for captions, filler-word removal and choosing soundbites from talking footage.",
  schema: z.object({ asset_id: z.string(), language: z.string().optional().describe("ISO code like 'en', or 'auto' (default).") }),
  mutates: true,
  run: async ({ asset_id, language }, ctx) => {
    const a = assetOf(ctx, asset_id);
    const had = !!a.transcript;
    await ensureTranscript(ctx, a, language);
    const words = flattenWords(a).length;
    return { text: `Transcript of "${a.name}" (${a.transcript!.language ?? "?"}, ${words} words, source times):\n` + formatTranscript(a), summary: `${words} words${had ? " (cached)" : ""}`, label: had ? undefined : `Transcribe ${a.name}` };
  },
});

tool({
  name: "get_transcript",
  description: "Read an existing transcript (source seconds), optionally only a time range, with or without word timings.",
  schema: z.object({ asset_id: z.string(), start: sec.optional(), end: sec.optional(), include_words: z.boolean().optional().describe("Default true.") }),
  mutates: false,
  run: ({ asset_id, start, end, include_words }, ctx) => {
    const a = assetOf(ctx, asset_id);
    if (!a.transcript) fail(`"${a.name}" is not transcribed yet — call transcribe_media first.`);
    return { text: formatTranscript(a, start ?? 0, end ?? Infinity, include_words !== false, 2000), summary: "transcript" };
  },
});

tool({
  name: "detect_scenes",
  description:
    "Find shot changes (scene cuts) in a video asset via ffmpeg scene detection. Returns cut times in source seconds (threshold 0.1–0.6, default 0.3; lower = more sensitive). With split_in_sequence=true it also splits every clip of that asset in the active sequence at those cuts (Premiere 'Scene Edit Detection').",
  schema: z.object({ asset_id: z.string(), threshold: z.number().optional(), split_in_sequence: z.boolean().optional() }),
  mutates: true,
  run: async ({ asset_id, threshold, split_in_sequence }, ctx) => {
    const a = assetOf(ctx, asset_id);
    if (!a.hasVideo || a.kind === "image") fail(`"${a.name}" is not a video.`);
    const cuts = await sceneCuts(await assetPath(a), threshold ?? 0.3, ctx.signal);
    let text = `${cuts.length} scene cuts in "${a.name}" (source s): ${cuts.map(f2).join(", ") || "none"}`;
    if (split_in_sequence && cuts.length) {
      const seq = activeSeq(ctx);
      let n = 0;
      for (const cut of cuts) {
        for (const c of assetUsageClips(seq, a.id)) {
          const src = { start: c.sourceIn, end: c.sourceIn + c.duration * c.speed };
          if (cut <= src.start + 0.02 || cut >= src.end - 0.02) continue;
          const t = c.start + (cut - c.sourceIn) / c.speed;
          n += splitAt(seq, t, [...new Set(linkedClips(seq, c).map((x) => x.trackId))]).length;
        }
      }
      repairLinks(seq);
      text += `\nSplit ${n} clip pieces at those cuts in the sequence.`;
      return { text, summary: `${cuts.length} cuts, ${n} splits`, label: "Scene Edit Detection" };
    }
    return { text, summary: `${cuts.length} cuts` };
  },
});

tool({
  name: "detect_silences",
  description:
    "Find silent/pause ranges in an asset's audio (ffmpeg silencedetect; noise_db default -35, min_duration default 0.5s). Returns source ranges plus the matching ranges in the active sequence. With remove=true it ripple-deletes those pauses from the sequence on all tracks (keeping `padding` seconds, default 0.12, of air on each side) — the fastest way to tighten talking footage.",
  schema: z.object({ asset_id: z.string(), noise_db: z.number().optional(), min_duration: z.number().optional(), remove: z.boolean().optional(), padding: z.number().optional() }),
  mutates: true,
  run: async ({ asset_id, noise_db, min_duration, remove, padding }, ctx) => {
    const a = assetOf(ctx, asset_id);
    if (!a.hasAudio) fail(`"${a.name}" has no audio.`);
    const sil = await silences(await assetPath(a), noise_db ?? -35, min_duration ?? 0.5, ctx.signal);
    const seq = ctx.project.activeSequenceId ? ctx.project.sequences[ctx.project.activeSequenceId] : undefined;
    const padded = padSilences(sil, padding ?? 0.12);
    const mapped = seq ? mergeRanges(padded.flatMap((s) => sourceRangeToSequence(seq, a.id, s.start, s.end))) : [];
    let text = `${sil.length} silences in "${a.name}" (source s): ${sil.map((s) => `${f2(s.start)}–${f2(s.end)}`).join(", ") || "none"}`;
    if (seq) text += `\nIn sequence (padded ${padding ?? 0.12}s): ${mapped.map((s) => `${f2(s.start)}–${f2(s.end)}`).join(", ") || "not used / none"}`;
    if (remove) {
      if (!seq) fail("No active sequence to remove silences from.");
      const before = sequenceDuration(seq!);
      const removed = rippleDeleteRanges(seq!, mapped);
      text += `\nRemoved ${mapped.length} pauses (${f2(removed)}s). Sequence ${f2(before)}s → ${f2(sequenceDuration(seq!))}s.`;
      return { text, summary: `Removed ${mapped.length} pauses (${f2(removed)}s)`, label: "Remove silences" };
    }
    return { text, summary: `${sil.length} silences` };
  },
});

// ---------------------------------------------------------------- sequences

tool({
  name: "create_sequence",
  description:
    `Create a new sequence and make it active. Use preset (${SEQUENCE_PRESETS.map((p) => p.id).join(", ")}) or explicit width/height/fps, or match_asset_id to match a clip's resolution and frame rate. Default: 1920x1080 @ 30fps with 3 video + 3 audio tracks.`,
  schema: z.object({ name: z.string(), preset: z.string().optional(), width: z.number().int().optional(), height: z.number().int().optional(), fps: z.number().optional(), match_asset_id: z.string().optional() }),
  mutates: true,
  run: ({ name, preset, width, height, fps, match_asset_id }, ctx) => {
    let settings: Record<string, number> = {};
    if (preset) {
      const pr = SEQUENCE_PRESETS.find((p) => p.id === preset);
      if (!pr) fail(`Unknown preset "${preset}". Options: ${SEQUENCE_PRESETS.map((p) => p.id).join(", ")}`);
      settings = { ...(pr!.settings as Record<string, number>) };
    }
    if (match_asset_id) {
      const a = assetOf(ctx, match_asset_id);
      if (a.width && a.height) settings = { ...settings, width: a.width, height: a.height };
      if (a.fps) settings.fps = Math.round(a.fps * 1000) / 1000;
    }
    if (width) settings.width = width;
    if (height) settings.height = height;
    if (fps) settings.fps = fps;
    const seq = makeSequence(name, settings);
    ctx.project.sequences[seq.id] = seq;
    ctx.project.items.push({ id: seq.id, type: "sequence", name, parentId: null });
    ctx.project.activeSequenceId = seq.id;
    return { text: `Created and activated sequence ${seq.id} "${name}" ${seq.settings.width}x${seq.settings.height} @ ${seq.settings.fps}fps (tracks V1-V3, A1-A3).`, summary: `${name} ${seq.settings.width}x${seq.settings.height}`, label: `New sequence ${name}` };
  },
});

tool({
  name: "set_active_sequence",
  description: "Switch which sequence is open/active (all editing tools act on the active sequence).",
  schema: z.object({ sequence_id: z.string() }),
  mutates: true,
  run: ({ sequence_id }, ctx) => {
    const seq = ctx.project.sequences[sequence_id];
    if (!seq) fail(`Unknown sequence "${sequence_id}". Sequences: ${Object.values(ctx.project.sequences).map((s) => `${s.id} "${s.name}"`).join(", ")}`);
    ctx.project.activeSequenceId = sequence_id;
    return { text: `Active sequence is now "${seq!.name}".`, summary: seq!.name, label: `Open ${seq!.name}` };
  },
});

// ---------------------------------------------------------------- placing clips

const clipSrcSchema = z.object({
  asset_id: z.string(),
  source_in: sec.optional().describe("Source in-point (s). Default: asset In mark or 0."),
  source_out: sec.optional().describe("Source out-point (s). Default: asset Out mark or end."),
  still_duration: sec.optional().describe("Duration for images (default 5s)."),
});

function checkSource(a: MediaAsset, sIn?: number, sOut?: number): void {
  if (a.kind === "image") return;
  if (sIn !== undefined && (sIn < 0 || sIn >= a.duration)) fail(`source_in ${sIn} is outside "${a.name}" (0–${f2(a.duration)}s).`);
  if (sOut !== undefined && sOut > a.duration + 0.05) fail(`source_out ${sOut} exceeds "${a.name}" duration ${f2(a.duration)}s.`);
  if (sIn !== undefined && sOut !== undefined && sOut <= sIn) fail(`source_out must be greater than source_in.`);
}

tool({
  name: "place_clip",
  description:
    "Edit one asset (or a source range of it) into the active sequence at a timeline time. mode 'overwrite' (default) replaces what's there; 'insert' pushes later material right on all sync-locked tracks. Video goes to video_track (1 = V1, default 1), audio to audio_track (1 = A1, default 1); missing tracks are created. Set include_audio=false for b-roll without its sound, include_video=false for music/VO.",
  schema: clipSrcSchema.extend({
    at: sec.describe("Timeline time (s)."),
    video_track: z.number().int().optional(),
    audio_track: z.number().int().optional(),
    mode: z.enum(["overwrite", "insert"]).optional(),
    include_video: z.boolean().optional(),
    include_audio: z.boolean().optional(),
  }),
  mutates: true,
  run: (i, ctx) => {
    const seq = activeSeq(ctx);
    const a = assetOf(ctx, i.asset_id);
    checkSource(a, i.source_in, i.source_out);
    const clips = placeAsset(seq, a, {
      at: Math.max(0, i.at), sourceIn: i.source_in, sourceOut: i.source_out, videoTrackIndex: (i.video_track ?? 1) - 1, audioTrackIndex: (i.audio_track ?? 1) - 1,
      includeVideo: i.include_video, includeAudio: i.include_audio, mode: i.mode ?? "overwrite", stillDuration: i.still_duration,
    });
    if (!clips.length) fail("Nothing placed (asset has no matching video/audio streams for the include flags).");
    return { text: `Placed:\n${clips.map((c) => clipLine(seq, c)).join("\n")}`, summary: `${a.name} at ${f2(i.at)}s`, label: `Place ${a.name}` };
  },
});

tool({
  name: "append_clips",
  description:
    "The main rough-cut tool: append a list of source ranges back-to-back on the timeline (overwrite edits starting at `at`, default = end of the existing material on the target tracks). Each item: asset_id + source_in/source_out (seconds). Linked video+audio are created for assets that have both. Use it to assemble selects, soundbites or b-roll sequences in order.",
  schema: z.object({
    clips: z.array(clipSrcSchema).describe("Ordered list of source ranges."),
    at: sec.optional(),
    video_track: z.number().int().optional().describe("1-based, default 1."),
    audio_track: z.number().int().optional().describe("1-based, default 1."),
    include_audio: z.boolean().optional().describe("Default true."),
    include_video: z.boolean().optional().describe("Default true."),
  }),
  mutates: true,
  run: (i, ctx) => {
    const seq = activeSeq(ctx);
    if (!i.clips.length) fail("clips is empty.");
    const vt = ensureTrack(seq, "video", (i.video_track ?? 1) - 1);
    const at = ensureTrack(seq, "audio", (i.audio_track ?? 1) - 1);
    let cursor = i.at ?? Math.max(0, ...seq.clips.filter((c) => c.trackId === vt.id || c.trackId === at.id).map(clipEnd));
    const start = cursor;
    const placed: Clip[] = [];
    for (const item of i.clips) {
      const a = assetOf(ctx, item.asset_id);
      checkSource(a, item.source_in, item.source_out);
      const cs = placeAsset(seq, a, {
        at: cursor, sourceIn: item.source_in, sourceOut: item.source_out, videoTrackIndex: (i.video_track ?? 1) - 1, audioTrackIndex: (i.audio_track ?? 1) - 1,
        includeVideo: i.include_video, includeAudio: i.include_audio, mode: "overwrite", stillDuration: item.still_duration,
      });
      if (!cs.length) continue;
      placed.push(...cs);
      cursor = Math.max(...cs.map(clipEnd));
    }
    return {
      text: `Appended ${i.clips.length} items, ${f2(start)}–${f2(cursor)}s:\n${placed.map((c) => clipLine(seq, c)).join("\n")}`,
      summary: `${i.clips.length} clips, ${f2(cursor - start)}s`,
      label: "Assemble clips",
    };
  },
});

tool({
  name: "move_clips",
  description:
    "Move clips in time and/or to another track. Give to_start (new start of the earliest moved clip) or delta (seconds). to_track like 'V2' moves the clips of that kind (linked partners on the other kind keep their track but move in time). mode 'overwrite' (default) or 'insert'. Linked partners move together unless include_linked=false.",
  schema: z.object({ clip_ids: z.array(z.string()), to_start: sec.optional(), delta: sec.optional(), to_track: z.string().optional(), mode: z.enum(["overwrite", "insert"]).optional(), include_linked: z.boolean().optional() }),
  mutates: true,
  run: (i, ctx) => {
    const seq = activeSeq(ctx);
    const ids = linkedIds(seq, i.clip_ids, i.include_linked !== false);
    const moving = ids.map((id) => clipOf(seq, id));
    const minStart = Math.min(...moving.map((c) => c.start));
    const dt = i.to_start !== undefined ? i.to_start - minStart : i.delta ?? 0;
    let groups: { ids: string[]; dTrack: number }[] = [{ ids, dTrack: 0 }];
    if (i.to_track) {
      const dest = trackRef(seq, i.to_track, true);
      const primary = moving.find((c) => getTrack(seq, c.trackId)?.kind === dest.kind) ?? fail(`None of the clips are on a ${dest.kind} track.`);
      const dTrack = trackIndex(seq, dest.id) - trackIndex(seq, primary.trackId);
      const same = moving.filter((c) => getTrack(seq, c.trackId)?.kind === dest.kind).map((c) => c.id);
      groups = [{ ids: same, dTrack }, { ids: ids.filter((x) => !same.includes(x)), dTrack: 0 }];
    }
    for (const g of groups) if (g.ids.length) moveClips(seq, g.ids, dt, g.dTrack, i.mode ?? "overwrite");
    const after = ids.map((id) => getClip(seq, id)).filter(Boolean) as Clip[];
    return { text: `Moved:\n${after.map((c) => clipLine(seq, c)).join("\n")}`, summary: `${after.length} clips moved`, label: "Move clips" };
  },
});

tool({
  name: "trim_clip",
  description:
    "Trim a clip edge. Specify edge ('in' or 'out') with delta seconds (positive = later), OR absolute targets: new_source_in / new_source_out (source seconds) or new_start / new_end (timeline seconds). mode: 'normal' leaves a gap, 'ripple' (default) shifts later material to stay contiguous, 'roll' moves the edit point with the neighbour. Linked audio/video trims together.",
  schema: z.object({
    clip_id: z.string(),
    edge: z.enum(["in", "out"]).optional(),
    delta: sec.optional(),
    new_source_in: sec.optional(),
    new_source_out: sec.optional(),
    new_start: sec.optional(),
    new_end: sec.optional(),
    mode: z.enum(["normal", "ripple", "roll"]).optional(),
    include_linked: z.boolean().optional(),
  }),
  mutates: true,
  run: (i, ctx) => {
    const seq = activeSeq(ctx);
    const c = clipOf(seq, i.clip_id);
    let edge = i.edge;
    let delta = i.delta;
    if (i.new_source_in !== undefined) [edge, delta] = ["in", (i.new_source_in - c.sourceIn) / c.speed];
    else if (i.new_start !== undefined) [edge, delta] = ["in", i.new_start - c.start];
    else if (i.new_source_out !== undefined) [edge, delta] = ["out", (i.new_source_out - (c.sourceIn + c.duration * c.speed)) / c.speed];
    else if (i.new_end !== undefined) [edge, delta] = ["out", i.new_end - clipEnd(c)];
    if (!edge || delta === undefined) fail("Provide edge+delta or one of new_source_in/new_source_out/new_start/new_end.");
    const mode = i.mode ?? "ripple";
    const partners = i.include_linked === false ? [] : linkedClips(seq, c).filter((x) => x.id !== c.id);
    const applied = trimClip(ctx.project, seq, c.id, edge!, delta!, mode);
    for (const p of partners) {
      if (mode === "ripple") {
        if (edge === "in") {
          p.sourceIn += applied * p.speed;
          p.duration -= applied;
        } else p.duration += applied;
      } else trimClip(ctx.project, seq, p.id, edge!, applied, mode);
    }
    const note = Math.abs(applied - delta!) > 1e-3 ? ` (requested ${f2(delta!)}s, limited by media/neighbours to ${f2(applied)}s)` : "";
    return { text: `Trimmed ${edge} edge by ${f2(applied)}s${note}:\n${[c, ...partners].map((x) => clipLine(seq, x)).join("\n")}`, summary: `${edge} ${applied >= 0 ? "+" : ""}${f2(applied)}s`, label: "Trim clip" };
  },
});

tool({
  name: "split_at",
  description: "Razor: split clips at a timeline time on the given tracks (e.g. ['V1','A1']; default all unlocked tracks). Returns the new right-hand clip ids.",
  schema: z.object({ time: sec, tracks: z.array(z.string()).optional() }),
  mutates: true,
  run: ({ time, tracks }, ctx) => {
    const seq = activeSeq(ctx);
    const ids = tracks?.map((t) => trackRef(seq, t).id);
    const created = splitAt(seq, time, ids);
    if (!created.length) return { text: `No clip crosses ${f2(time)}s on those tracks.`, summary: "nothing to split" };
    return { text: `Split at ${f2(time)}s. New clips:\n${created.map((c) => clipLine(seq, c)).join("\n")}`, summary: `${created.length} splits at ${f2(time)}s`, label: "Razor" };
  },
});

tool({
  name: "delete_clips",
  description: "Delete clips. ripple=true (default) closes the gap like Premiere's Ripple Delete; false leaves a gap (Lift). Linked partners are deleted too unless include_linked=false.",
  schema: z.object({ clip_ids: z.array(z.string()), ripple: z.boolean().optional(), include_linked: z.boolean().optional() }),
  mutates: true,
  run: ({ clip_ids, ripple, include_linked }, ctx) => {
    const seq = activeSeq(ctx);
    const ids = linkedIds(seq, clip_ids, include_linked !== false);
    const before = sequenceDuration(seq);
    deleteClips(seq, ids, ripple !== false);
    return { text: `Deleted ${ids.length} clips${ripple !== false ? " (ripple)" : ""}. Sequence ${f2(before)}s → ${f2(sequenceDuration(seq))}s.`, summary: `${ids.length} clips deleted`, label: "Delete clips" };
  },
});

tool({
  name: "delete_range",
  description:
    "Remove time ranges from the sequence across tracks — for cutting out sections, bad takes, pauses or words. Ranges are TIMELINE seconds, or SOURCE seconds of asset_id when given (they are mapped to everywhere that asset plays — ideal with transcript word timings). ripple=true (default) closes the gaps on all sync-locked tracks (Extract); false leaves gaps (Lift). tracks limits which tracks are cut (default all unlocked).",
  schema: z.object({ ranges: z.array(z.object({ start: sec, end: sec })), asset_id: z.string().optional(), ripple: z.boolean().optional(), tracks: z.array(z.string()).optional() }),
  mutates: true,
  run: ({ ranges, asset_id, ripple, tracks }, ctx) => {
    const seq = activeSeq(ctx);
    let seqRanges: Range[] = ranges.filter((r) => r.end > r.start);
    if (!seqRanges.length) fail("No valid ranges (end must be greater than start).");
    if (asset_id) {
      assetOf(ctx, asset_id);
      seqRanges = mergeRanges(seqRanges.flatMap((r) => sourceRangeToSequence(seq, asset_id, r.start, r.end)));
      if (!seqRanges.length) fail(`Those source ranges of ${asset_id} are not used in the active sequence.`);
    }
    const trackIds = tracks?.map((t) => trackRef(seq, t).id);
    const before = sequenceDuration(seq);
    let removed = 0;
    if (ripple === false) {
      for (const r of seqRanges) lift(seq, r.start, r.end, trackIds ?? seq.tracks.filter((t) => !t.locked).map((t) => t.id));
      repairLinks(seq);
    } else removed = rippleDeleteRanges(seq, seqRanges, trackIds);
    return {
      text: `${ripple === false ? "Lifted" : "Extracted"} ${seqRanges.length} ranges (${seqRanges.map((r) => `${f2(r.start)}–${f2(r.end)}`).join(", ")}). Sequence ${f2(before)}s → ${f2(sequenceDuration(seq))}s.`,
      summary: ripple === false ? `${seqRanges.length} ranges lifted` : `Cut ${f2(removed)}s in ${seqRanges.length} ranges`,
      label: "Delete range",
    };
  },
});

tool({
  name: "close_gaps",
  description: "Close all gaps on the given tracks (default all) by sliding clips left.",
  schema: z.object({ tracks: z.array(z.string()).optional() }),
  mutates: true,
  run: ({ tracks }, ctx) => {
    const seq = activeSeq(ctx);
    const before = sequenceDuration(seq);
    closeAllGaps(seq, tracks?.map((t) => trackRef(seq, t).id));
    return { text: `Closed gaps. Sequence ${f2(before)}s → ${f2(sequenceDuration(seq))}s.`, summary: "gaps closed", label: "Close gaps" };
  },
});

tool({
  name: "set_clip_speed",
  description: "Change playback speed (1 = 100%, 2 = 200% fast, 0.5 = slow motion), optionally reverse. ripple=true (default) shifts later clips. Linked audio follows.",
  schema: z.object({ clip_ids: z.array(z.string()), speed: z.number(), reverse: z.boolean().optional(), maintain_pitch: z.boolean().optional(), ripple: z.boolean().optional() }),
  mutates: true,
  run: ({ clip_ids, speed, reverse, maintain_pitch, ripple }, ctx) => {
    const seq = activeSeq(ctx);
    if (speed <= 0.01 || speed > 100) fail("speed must be between 0.01 and 100.");
    const ids = linkedIds(seq, clip_ids);
    // ripple only once per link group (partners are on other tracks that already ripple via sync lock)
    const done = new Set<string>();
    for (const id of ids) {
      const c = clipOf(seq, id);
      const group = c.linkId ?? c.id;
      setClipSpeed(ctx.project, seq, id, speed, { ripple: ripple !== false && !done.has(group), reverse, maintainPitch: maintain_pitch });
      done.add(group);
    }
    return { text: `Speed ${Math.round(speed * 100)}%${reverse ? " reversed" : ""}:\n${ids.map((id) => clipLine(seq, clipOf(seq, id))).join("\n")}`, summary: `${Math.round(speed * 100)}%`, label: "Speed/Duration" };
  },
});

// ---------------------------------------------------------------- motion / properties

const MOTION_KEYS = {
  position_x: "positionX", position_y: "positionY", scale: "scale", scale_width: "scaleWidth", rotation: "rotation",
  anchor_x: "anchorX", anchor_y: "anchorY", crop_left: "cropLeft", crop_right: "cropRight", crop_top: "cropTop", crop_bottom: "cropBottom",
} as const;
type PropName = keyof typeof MOTION_KEYS | "opacity" | "volume_db";
const PROP_NAMES = [...Object.keys(MOTION_KEYS), "opacity", "volume_db"] as unknown as [PropName, ...PropName[]];
const EASINGS = ["linear", "easeIn", "easeOut", "easeInOut", "hold", "bezier"] as const;

tool({
  name: "set_clip_properties",
  description:
    "Set intrinsic properties of clips (Effect Controls > Motion/Opacity/Volume). position_x/position_y are pixels in sequence space (center = width/2, height/2); scale in % (100 = native); rotation in degrees; opacity 0–100; crops in %; blend_mode; enabled; name. keyframes animate a property: times are seconds RELATIVE TO THE CLIP START; giving keyframes for a property replaces its existing keyframes (e.g. slow push-in: scale 100→110 over the clip).",
  schema: z.object({
    clip_ids: z.array(z.string()),
    position_x: z.number().optional(), position_y: z.number().optional(), scale: z.number().optional(), scale_width: z.number().optional(), uniform_scale: z.boolean().optional(),
    rotation: z.number().optional(), anchor_x: z.number().optional(), anchor_y: z.number().optional(),
    crop_left: z.number().optional(), crop_right: z.number().optional(), crop_top: z.number().optional(), crop_bottom: z.number().optional(),
    opacity: z.number().optional(),
    blend_mode: z.enum(["normal", "darken", "multiply", "colorBurn", "lighten", "screen", "colorDodge", "add", "overlay", "softLight", "hardLight", "difference", "exclusion", "hue", "saturation", "color", "luminosity"]).optional(),
    enabled: z.boolean().optional(),
    name: z.string().optional(),
    keyframes: z.array(z.object({ property: z.enum(PROP_NAMES), time: sec, value: z.number(), easing: z.enum(EASINGS).optional() })).optional(),
  }),
  mutates: true,
  run: (i, ctx) => {
    const seq = activeSeq(ctx);
    const changed: string[] = [];
    for (const id of i.clip_ids) {
      const c = clipOf(seq, id);
      if (i.enabled !== undefined) c.enabled = i.enabled;
      if (i.name) c.name = i.name;
      const visualProps = Object.keys(MOTION_KEYS).some((k) => (i as Record<string, unknown>)[k] !== undefined) || i.opacity !== undefined || i.blend_mode || i.uniform_scale !== undefined;
      if (visualProps && !c.motion) fail(`Clip ${id} is not a visual clip (no Motion/Opacity).`);
      if (c.motion) {
        for (const [k, key] of Object.entries(MOTION_KEYS)) {
          const v = (i as Record<string, unknown>)[k];
          if (typeof v === "number") c.motion[key] = { value: v };
        }
        if (i.uniform_scale !== undefined) c.motion.uniformScale = i.uniform_scale;
      }
      if (c.opacity) {
        if (i.opacity !== undefined) c.opacity.opacity = { value: Math.max(0, Math.min(100, i.opacity)) };
        if (i.blend_mode) c.opacity.blendMode = i.blend_mode;
      }
      const byProp = new Map<PropName, { t: number; v: number; interp: (typeof EASINGS)[number] }[]>();
      for (const k of i.keyframes ?? []) {
        if (k.time < -1e-6 || k.time > c.duration + 1e-3) fail(`Keyframe time ${k.time} is outside clip ${id} (0–${f2(c.duration)}s, relative to clip start).`);
        const list = byProp.get(k.property) ?? [];
        list.push({ t: k.time, v: k.value, interp: k.easing ?? "linear" });
        byProp.set(k.property, list);
      }
      for (const [prop, kfs] of byProp) {
        kfs.sort((a, b) => a.t - b.t);
        if (prop === "opacity") {
          if (!c.opacity) fail(`Clip ${id} has no opacity.`);
          c.opacity!.opacity = { value: kfs[0].v, keyframes: kfs };
        } else if (prop === "volume_db") {
          const targets = audioClipsFor(seq, id);
          if (!targets.length) fail(`Clip ${id} has no audio.`);
          for (const t of targets) t.audio!.volumeDb = { value: kfs[0].v, keyframes: kfs };
        } else {
          if (!c.motion) fail(`Clip ${id} has no Motion.`);
          c.motion![MOTION_KEYS[prop]] = { value: kfs[0].v, keyframes: kfs };
        }
      }
      changed.push(id);
    }
    return { text: `Updated ${changed.length} clips.`, summary: `${changed.length} clips updated`, label: "Clip properties" };
  },
});

// ---------------------------------------------------------------- effects & color

const VIDEO_FX = EFFECTS.filter((e) => e.kind === "video");
const AUDIO_FX = EFFECTS.filter((e) => e.kind === "audio");
const fxDoc = (list: typeof EFFECTS) =>
  list
    .map((e) => `${e.type} (${e.name}: ${e.description}) params: ${e.params.map((p) => `${p.key}[${p.min}..${p.max}, default ${p.default}]`).join(" ") || "none"}${e.options?.length ? `; options: ${e.options.map((o) => `${o.key}${o.choices ? `=${o.choices.join("|")}` : `(${o.type})`}`).join(" ")}` : ""}`)
    .join("\n");

tool({
  name: "add_effect",
  description:
    "Apply an effect from the registry to clips (if the clip already has one of that type it is updated). Audio effects given a video clip id are applied to its linked audio. Params are clamped to range. Video effects:\n" +
    fxDoc(VIDEO_FX.filter((e) => e.type !== "lumetri")) +
    "\nAudio effects:\n" + fxDoc(AUDIO_FX) +
    "\nFor color grading prefer apply_color_grade (Lumetri).",
  schema: z.object({ clip_ids: z.array(z.string()), type: z.string(), params: z.record(z.string(), z.number()).optional(), options: z.record(z.string(), z.union([z.string(), z.boolean()])).optional() }),
  mutates: true,
  run: ({ clip_ids, type, params, options }, ctx) => {
    const seq = activeSeq(ctx);
    const def = EFFECT_MAP[type] ?? fail(`Unknown effect "${type}". Valid: ${EFFECTS.map((e) => e.type).join(", ")}`);
    const out: string[] = [];
    for (const id of clip_ids) {
      const targets = def.kind === "audio" ? audioClipsFor(seq, id) : [clipOf(seq, id)].filter((c) => isVisualClip(seq, c));
      if (!targets.length) fail(`Clip ${id} has no ${def.kind} to apply ${def.name} to.`);
      for (const t of targets) {
        const fx = upsertEffect(t, type, params ?? {}, options ?? {});
        out.push(`${t.id}: ${def.name} (${fx.id})`);
      }
    }
    return { text: `Applied:\n${out.join("\n")}`, summary: `${def.name} on ${out.length} clips`, label: `Apply ${def.name}` };
  },
});

tool({
  name: "update_effect",
  description: "Change an existing effect on a clip (identify by effect_id or type): params, options, enabled, or animate params with keyframes (times relative to clip start).",
  schema: z.object({
    clip_id: z.string(), effect_id: z.string().optional(), type: z.string().optional(),
    params: z.record(z.string(), z.number()).optional(), options: z.record(z.string(), z.union([z.string(), z.boolean()])).optional(), enabled: z.boolean().optional(),
    keyframes: z.array(z.object({ param: z.string(), time: sec, value: z.number(), easing: z.enum(EASINGS).optional() })).optional(),
  }),
  mutates: true,
  run: (i, ctx) => {
    const seq = activeSeq(ctx);
    const c = clipOf(seq, i.clip_id);
    const fx = c.effects.find((e) => (i.effect_id ? e.id === i.effect_id : e.type === i.type)) ?? fail(`Effect not found on ${c.id}. It has: ${c.effects.map((e) => `${e.id} ${e.type}`).join(", ") || "no effects"}`);
    upsertEffect(c, fx.type, i.params ?? {}, i.options ?? {});
    if (i.enabled !== undefined) fx.enabled = i.enabled;
    const def = EFFECT_MAP[fx.type];
    const groups = new Map<string, { t: number; v: number; interp: (typeof EASINGS)[number] }[]>();
    for (const k of i.keyframes ?? []) {
      if (!def.params.some((p) => p.key === k.param)) fail(`${fx.type} has no param "${k.param}".`);
      groups.set(k.param, [...(groups.get(k.param) ?? []), { t: k.time, v: k.value, interp: k.easing ?? "linear" }]);
    }
    for (const [k, kfs] of groups) fx.params[k] = { value: kfs[0].v, keyframes: kfs.sort((a, b) => a.t - b.t) };
    return { text: `Updated ${fx.type} (${fx.id}) on ${c.id}.`, summary: `${def.name} updated`, label: `Edit ${def.name}` };
  },
});

tool({
  name: "remove_effect",
  description: "Remove effects from clips by effect_id or by type.",
  schema: z.object({ clip_ids: z.array(z.string()), effect_id: z.string().optional(), type: z.string().optional() }),
  mutates: true,
  run: ({ clip_ids, effect_id, type }, ctx) => {
    const seq = activeSeq(ctx);
    if (!effect_id && !type) fail("Give effect_id or type.");
    let n = 0;
    for (const id of clip_ids) {
      for (const c of [clipOf(seq, id), ...audioClipsFor(seq, id)]) {
        const before = c.effects.length;
        c.effects = c.effects.filter((e) => !(effect_id ? e.id === effect_id : e.type === type));
        n += before - c.effects.length;
      }
    }
    return { text: `Removed ${n} effects.`, summary: `${n} removed`, label: "Remove effect" };
  },
});

const lumetri = EFFECT_MAP.lumetri;
tool({
  name: "apply_color_grade",
  description:
    "Color grade with Lumetri Color. look: one of " + Object.keys(LOOKS).map((l) => `"${l}"`).join(", ") + ` (or "None"); intensity 0–200 (%, default 100). params (any subset): ${lumetri.params.map((p) => `${p.key}[${p.min}..${p.max}]`).join(" ")}. ` +
    "target 'clips' grades clip_ids (default: every visual media clip in the sequence, each gets its own Lumetri so they can be matched individually); 'adjustment_layer' puts one Lumetri on an adjustment layer covering the whole sequence (one grade for everything). Existing Lumetri settings are updated, not stacked. Look at frames first to judge exposure/white balance.",
  schema: z.object({
    target: z.enum(["clips", "adjustment_layer"]).optional(),
    clip_ids: z.array(z.string()).optional(),
    look: z.string().optional(),
    intensity: z.number().optional(),
    params: z.record(z.string(), z.number()).optional(),
  }),
  mutates: true,
  run: ({ target, clip_ids, look, intensity, params }, ctx) => {
    const seq = activeSeq(ctx);
    if (look && look !== "None" && !LOOKS[look]) fail(`Unknown look "${look}". Looks: ${Object.keys(LOOKS).join(", ")}`);
    const p = { ...(params ?? {}) };
    if (intensity !== undefined) p.lookIntensity = intensity;
    const opts: Record<string, string> = look ? { look } : {};
    let clips: Clip[];
    if (target === "adjustment_layer") {
      const dur = sequenceDuration(seq);
      if (dur <= 0) fail("Sequence is empty.");
      const existing = seq.clips.find((c) => c.generator?.kind === "adjustmentLayer" && c.effects.some((e) => e.type === "lumetri"));
      clips = [existing ?? addAdjustmentLayer(seq, 0, dur, "Color Grade")];
      if (existing) {
        existing.start = 0;
        existing.duration = dur;
      }
    } else {
      clips = clip_ids?.length ? clip_ids.map((id) => clipOf(seq, id)) : visualMediaClips(seq);
      clips = clips.filter((c) => isVisualClip(seq, c));
      if (!clips.length) fail("No visual clips to grade.");
    }
    for (const c of clips) upsertEffect(c, "lumetri", p, opts);
    return { text: `Lumetri on ${clips.length} ${target === "adjustment_layer" ? "adjustment layer" : "clips"}${look ? `, look ${look}` : ""}: ${JSON.stringify(p)}`, summary: `${look ?? "Grade"} on ${clips.length}`, label: `Color grade${look ? ` (${look})` : ""}` };
  },
});

tool({
  name: "enhance_speech",
  description: "One-click dialogue cleanup on audio clips (video clip ids map to their linked audio): high-pass 80Hz, DeNoise, presence EQ, compression and a -1dB limiter. amount 0.5–1.5 (default 1). Default targets: every audio clip of assets that have transcripts or are on A1.",
  schema: z.object({ clip_ids: z.array(z.string()).optional(), amount: z.number().optional() }),
  mutates: true,
  run: ({ clip_ids, amount }, ctx) => {
    const seq = activeSeq(ctx);
    const a1 = tracksOfKind(seq, "audio")[0];
    const targets = clip_ids?.length ? clip_ids.flatMap((id) => audioClipsFor(seq, id)) : seq.clips.filter((c) => isAudioClip(seq, c) && (c.trackId === a1?.id || (c.assetId && ctx.project.media[c.assetId]?.transcript)));
    if (!targets.length) fail("No audio clips to enhance.");
    for (const c of targets) enhanceSpeech(c, Math.max(0.3, Math.min(1.5, amount ?? 1)));
    return { text: `Enhanced speech on ${targets.length} audio clips: ${targets.map((c) => c.id).join(", ")}`, summary: `${targets.length} clips`, label: "Enhance speech" };
  },
});

// ---------------------------------------------------------------- transitions

tool({
  name: "add_transition",
  description:
    `Add a transition at the edit point nearest 'at' on a track (default V1), or at every cut with all_cuts=true. A cut at the very start/end of a clip with nothing adjacent becomes a one-sided transition (e.g. dipToBlack at 0 = fade in from black). Types: ${TRANSITIONS.filter((t) => t.kind === "video").map((t) => t.type).join(", ")} (video); ${TRANSITIONS.filter((t) => t.kind === "audio").map((t) => t.type).join(", ")} (audio). duration seconds (default 0.5; use 0.5–1). include_audio=true also adds a constantPower crossfade on the linked audio track.`,
  schema: z.object({ at: sec.optional(), all_cuts: z.boolean().optional(), track: z.string().optional(), type: z.string().optional(), duration: sec.optional(), include_audio: z.boolean().optional() }),
  mutates: true,
  run: ({ at, all_cuts, track, type, duration, include_audio }, ctx) => {
    const seq = activeSeq(ctx);
    const tr = trackRef(seq, track ?? "V1");
    const ty = (type ?? (tr.kind === "audio" ? "constantPower" : "crossDissolve")) as TransitionType;
    const def = TRANSITION_MAP[ty] ?? fail(`Unknown transition "${type}". Valid: ${TRANSITIONS.map((t) => t.type).join(", ")}`);
    if (def.kind === "video" && tr.kind !== "video") fail(`${def.name} is a video transition; track ${tr.name} is ${tr.kind}.`);
    const dur = Math.max(1 / seq.settings.fps, Math.min(5, duration ?? 0.5));
    const points = editPoints(seq, [tr.id]).filter((p) => clipsOnTrack(seq, tr.id).length && p <= Math.max(...clipsOnTrack(seq, tr.id).map(clipEnd)) + 1e-6);
    let targets: number[];
    if (all_cuts) {
      const clips = clipsOnTrack(seq, tr.id);
      targets = points.filter((p) => clips.some((c) => Math.abs(c.start - p) < 1e-3) && clips.some((c) => Math.abs(clipEnd(c) - p) < 1e-3));
    } else {
      if (at === undefined) fail("Give at (seconds) or all_cuts=true.");
      if (!points.length) fail(`Track ${tr.name} has no clips.`);
      targets = [points.reduce((b, p) => (Math.abs(p - at!) < Math.abs(b - at!) ? p : b), points[0])];
    }
    const added: string[] = [];
    for (const p of targets) {
      const t = addTransition(seq, tr.id, p, ty, dur);
      if (t) added.push(`${t.id} ${ty} at ${f2(t.at)}s (${t.alignment})`);
      if (include_audio && tr.kind === "video") {
        const clipAtCut = clipsOnTrack(seq, tr.id).find((c) => Math.abs(c.start - p) < 1e-3 || Math.abs(clipEnd(c) - p) < 1e-3);
        const audio = clipAtCut ? linkedClips(seq, clipAtCut).find((c) => isAudioClip(seq, c)) : undefined;
        if (audio) {
          const at2 = addTransition(seq, audio.trackId, p, "constantPower", dur);
          if (at2) added.push(`${at2.id} constantPower at ${f2(at2.at)}s on ${getTrack(seq, audio.trackId)?.name}`);
        }
      }
    }
    if (!added.length) fail("No edit point found to add a transition to.");
    return { text: `Added ${added.length} transitions:\n${added.join("\n")}`, summary: `${def.name} ×${added.length}`, label: `Add ${def.name}` };
  },
});

// ---------------------------------------------------------------- text & captions

const styleSchema = z.object({
  font_size: z.number().optional().describe("px at sequence resolution"),
  font_family: z.string().optional(),
  font_weight: z.number().optional().describe("100–900"),
  italic: z.boolean().optional(),
  color: z.string().optional().describe("CSS color, e.g. #ffffff"),
  align: z.enum(["left", "center", "right"]).optional(),
  stroke_color: z.string().optional(),
  stroke_width: z.number().optional(),
  background_color: z.string().optional().describe("Box behind the text, e.g. rgba(0,0,0,0.6)"),
  letter_spacing: z.number().optional(),
});
type StyleIn = z.infer<typeof styleSchema>;
function toStyle(s: StyleIn | undefined, fontSize = 64): Partial<import("../../shared/types").TextStyle> {
  if (!s) return {};
  const out: Record<string, unknown> = {};
  if (s.font_size) out.fontSize = s.font_size;
  if (s.font_family) out.fontFamily = s.font_family;
  if (s.font_weight) out.fontWeight = s.font_weight;
  if (s.italic !== undefined) out.italic = s.italic;
  if (s.color) out.color = s.color;
  if (s.align) out.align = s.align;
  if (s.stroke_color) out.strokeColor = s.stroke_color;
  if (s.stroke_width !== undefined) out.strokeWidth = s.stroke_width;
  if (s.letter_spacing !== undefined) out.letterSpacing = s.letter_spacing;
  if (s.background_color) out.background = { color: s.background_color, padding: Math.round((s.font_size ?? fontSize) * 0.4), radius: 6 };
  return out;
}

tool({
  name: "add_text",
  description:
    "Add a title / text graphic (Essential Graphics text clip) on a free video track above the footage. position: center (big title), upper_third, top, lower_third (name/locator with a dark box), bottom. Default start = playhead, duration 4s (titles 3–5s), 0.3s fade in/out. Use \\n for line breaks. Optional style overrides.",
  schema: z.object({
    text: z.string(), start: sec.optional(), duration: sec.optional(),
    position: z.enum(["center", "upper_third", "top", "lower_third", "bottom"]).optional(),
    style: styleSchema.optional(), fade_in: sec.optional(), fade_out: sec.optional(), track: z.string().optional(),
  }),
  mutates: true,
  run: (i, ctx) => {
    const seq = activeSeq(ctx);
    const start = Math.max(0, i.start ?? ctx.playhead);
    const clip = addTextClip(seq, {
      text: i.text.replace(/\\n/g, "\n"), start, duration: i.duration ?? 4, position: i.position as TextPosition | undefined,
      style: toStyle(i.style), fadeIn: i.fade_in, fadeOut: i.fade_out, trackId: i.track ? trackRef(seq, i.track, true).id : undefined,
    });
    return { text: `Added text ${clipLine(seq, clip)}`, summary: `"${i.text.slice(0, 30)}"`, label: "Add title" };
  },
});

tool({
  name: "update_text",
  description: "Edit the text of caption clips or text graphics (e.g. fix transcription typos, translate captions, rewrite a title), and/or restyle text graphics. edits: [{clip_id, text}]. style applies to text graphics among clip_ids/edits.",
  schema: z.object({ edits: z.array(z.object({ clip_id: z.string(), text: z.string() })).optional(), clip_ids: z.array(z.string()).optional(), style: styleSchema.optional() }),
  mutates: true,
  run: ({ edits, clip_ids, style }, ctx) => {
    const seq = activeSeq(ctx);
    let n = 0;
    for (const e of edits ?? []) {
      const c = clipOf(seq, e.clip_id);
      const text = e.text.replace(/\\n/g, "\n");
      if (c.caption) c.caption.text = text;
      else if (c.generator?.kind === "text") c.generator.style.text = text;
      else fail(`Clip ${c.id} is not a caption or text graphic.`);
      c.name = text.slice(0, 40);
      n++;
    }
    const ids = [...new Set([...(clip_ids ?? []), ...(edits ?? []).map((e) => e.clip_id)])];
    if (style) for (const id of ids) {
      const c = clipOf(seq, id);
      if (c.generator?.kind === "text") Object.assign(c.generator.style, toStyle(style, c.generator.style.fontSize));
    }
    return { text: `Updated ${n} texts${style ? ` and restyled ${ids.length} clips` : ""}.`, summary: `${n || ids.length} text clips`, label: "Edit text" };
  },
});

tool({
  name: "add_captions",
  description:
    "Generate captions synchronized to word timings for all dialogue in the active sequence (or only asset_ids). Untranscribed assets are transcribed automatically. style 'standard' = subtitle track (max_chars_per_line default 42, lines 1|2 default 2, min_duration default 0.8s, gap_frames default 2) — exportable as SRT/burn-in; 'social' = big bold centered word-groups as text graphics on a 'Captions' video track (TikTok/Reels look, ~18 chars, uppercase). replace=true (default) replaces previous captions of the same style.",
  schema: z.object({
    asset_ids: z.array(z.string()).optional(), style: z.enum(["standard", "social"]).optional(), max_chars_per_line: z.number().int().optional(), lines: z.number().int().optional(),
    min_duration: sec.optional(), gap_frames: z.number().int().optional(), uppercase: z.boolean().optional(), replace: z.boolean().optional(),
  }),
  mutates: true,
  run: async (i, ctx) => {
    const seq = activeSeq(ctx);
    const ids = i.asset_ids ?? usedAssetIds(seq).filter((id) => ctx.project.media[id]?.hasAudio);
    if (!ids.length) fail("No clips with audio in the sequence to caption.");
    for (const id of ids) await ensureTranscript(ctx, assetOf(ctx, id));
    const words = sequenceWords(ctx.project, seq, ids);
    if (!words.length) fail("No spoken words found in the sequence's audio.");
    const res = addCaptionClips(seq, words, {
      style: i.style, maxCharsPerLine: i.max_chars_per_line, lines: i.lines === 1 ? 1 : i.lines === 2 ? 2 : undefined, minDuration: i.min_duration,
      gapFrames: i.gap_frames, uppercase: i.uppercase, replace: i.replace, fps: seq.settings.fps,
    });
    const sample = res.clipIds.slice(0, 6).map((id) => {
      const c = getClip(seq, id)!;
      return `${f2(c.start)}–${f2(clipEnd(c))} ${JSON.stringify(c.caption?.text ?? (c.generator?.kind === "text" ? c.generator.style.text : ""))}`;
    });
    return { text: `Created ${res.count} ${i.style ?? "standard"} captions from ${words.length} words on track ${getTrack(seq, res.trackId)?.name}. First: \n${sample.join("\n")}`, summary: `${res.count} captions`, label: "Add captions" };
  },
});

// ---------------------------------------------------------------- audio

tool({
  name: "set_volume",
  description: "Set clip volume in dB (0 = unity, -6 = half, +6 louder; video clip ids map to linked audio) with optional fade_in/fade_out seconds, or set a whole track's fader (track like 'A2' + volume_db) or mute it.",
  schema: z.object({ clip_ids: z.array(z.string()).optional(), track: z.string().optional(), volume_db: z.number().optional(), fade_in: sec.optional(), fade_out: sec.optional(), mute: z.boolean().optional() }),
  mutates: true,
  run: ({ clip_ids, track, volume_db, fade_in, fade_out, mute }, ctx) => {
    const seq = activeSeq(ctx);
    const out: string[] = [];
    if (track) {
      const tr = trackRef(seq, track);
      if (volume_db !== undefined) tr.volumeDb = Math.max(-60, Math.min(15, volume_db));
      if (mute !== undefined) tr.muted = mute;
      out.push(`Track ${tr.name}: ${tr.volumeDb}dB${tr.muted ? " muted" : ""}`);
    }
    for (const id of clip_ids ?? []) {
      for (const c of audioClipsFor(seq, id)) {
        setVolume(c, volume_db === undefined ? undefined : Math.max(-60, Math.min(15, volume_db)), fade_in ?? 0, fade_out ?? 0);
        if (mute !== undefined) c.audio!.muted = mute;
        out.push(`${c.id}: ${f2(c.audio!.volumeDb.value)}dB${fade_in ? ` fade-in ${fade_in}s` : ""}${fade_out ? ` fade-out ${fade_out}s` : ""}`);
      }
    }
    if (!out.length) fail("Give clip_ids or track.");
    return { text: out.join("\n"), summary: `${out.length} volume changes`, label: "Volume" };
  },
});

tool({
  name: "duck_music",
  description:
    "Auto-duck: lower music under dialogue with volume keyframes (Essential Sound 'Ducking'). Music = music_clip_ids or every clip on music_track (default 'A2'). Dialogue regions come from transcripts of the dialogue clips (dialogue_track, default 'A1'); without transcripts, silence detection is used. duck_db default -12, fade default 0.35s.",
  schema: z.object({ music_clip_ids: z.array(z.string()).optional(), music_track: z.string().optional(), dialogue_track: z.string().optional(), duck_db: z.number().optional(), fade: sec.optional() }),
  mutates: true,
  run: async ({ music_clip_ids, music_track, dialogue_track, duck_db, fade }, ctx) => {
    const seq = activeSeq(ctx);
    const music = music_clip_ids?.length ? music_clip_ids.flatMap((id) => audioClipsFor(seq, id)) : clipsOnTrack(seq, trackRef(seq, music_track ?? "A2").id);
    if (!music.length) fail("No music clips found (put music on A2 or pass music_clip_ids).");
    const dTrack = trackRef(seq, dialogue_track ?? "A1");
    const dialog = clipsOnTrack(seq, dTrack.id).filter((c) => !music.includes(c));
    if (!dialog.length) fail(`No dialogue clips on ${dTrack.name}.`);
    const speech: Range[] = [];
    const words = sequenceWords(ctx.project, seq).filter((w) => dialog.some((c) => c.id === w.clipId || (c.linkId && getClip(seq, w.clipId)?.linkId === c.linkId)));
    if (words.length) speech.push(...words.map((w) => ({ start: w.start, end: w.end })));
    for (const c of dialog) {
      if (!c.assetId) continue;
      if (words.some((w) => w.assetId === c.assetId)) continue;
      const a = ctx.project.media[c.assetId];
      if (!a?.hasAudio) continue;
      const sil = await silences(await assetPath(a), -35, 0.4, ctx.signal);
      const src = { start: c.sourceIn, end: c.sourceIn + c.duration * c.speed };
      let cur = src.start;
      for (const s of [...sil, { start: src.end, end: src.end }]) {
        const e = Math.min(s.start, src.end);
        if (e > cur) speech.push({ start: c.start + (cur - c.sourceIn) / c.speed, end: c.start + (e - c.sourceIn) / c.speed });
        cur = Math.max(cur, s.end);
        if (cur >= src.end) break;
      }
    }
    const regions = mergeRanges(speech, 0.6);
    const n = duckClips(music, regions, duck_db ?? -12, fade ?? 0.35);
    return { text: `Ducked ${music.length} music clips by ${duck_db ?? -12}dB under ${regions.length} dialogue regions (${regions.slice(0, 12).map((r) => `${f2(r.start)}–${f2(r.end)}`).join(", ")}${regions.length > 12 ? "…" : ""}).`, summary: `${n} duck regions`, label: "Duck music" };
  },
});

tool({
  name: "set_track_properties",
  description: "Rename, lock/unlock, mute/unmute (video: hide), solo, or toggle sync lock on a track ('V2', 'A1', ...).",
  schema: z.object({ track: z.string(), name: z.string().optional(), locked: z.boolean().optional(), muted: z.boolean().optional(), solo: z.boolean().optional(), sync_lock: z.boolean().optional() }),
  mutates: true,
  run: ({ track, name, locked, muted, solo, sync_lock }, ctx) => {
    const seq = activeSeq(ctx);
    const tr = trackRef(seq, track);
    if (name) tr.name = name;
    if (locked !== undefined) tr.locked = locked;
    if (muted !== undefined) tr.muted = muted;
    if (solo !== undefined) tr.solo = solo;
    if (sync_lock !== undefined) tr.syncLock = sync_lock;
    return { text: `Track ${tr.name}: locked=${tr.locked} muted=${tr.muted} solo=${tr.solo} syncLock=${tr.syncLock}`, summary: tr.name, label: "Track settings" };
  },
});

// ---------------------------------------------------------------- markers / in-out

tool({
  name: "add_marker",
  description: "Add a sequence marker (comment, chapter for YouTube chapters, segmentation) at a time, with name/comment/color and optional duration.",
  schema: z.object({ time: sec, name: z.string().optional(), comment: z.string().optional(), color: z.enum(["green", "red", "purple", "orange", "yellow", "white", "blue", "cyan"]).optional(), type: z.enum(["comment", "chapter", "segmentation"]).optional(), duration: sec.optional() }),
  mutates: true,
  run: ({ time, name, comment, color, type, duration }, ctx) => {
    const seq = activeSeq(ctx);
    const m = addMarker(seq, Math.max(0, time), { name: name ?? "", comment: comment ?? "", color: (color ?? (type === "chapter" ? "red" : "green")) as MarkerColor, type: type ?? "comment", duration: duration ?? 0 });
    return { text: `Marker ${m.id} at ${f2(m.time)}s "${m.name}"`, summary: `${f2(m.time)}s ${m.name}`, label: "Add marker" };
  },
});

tool({
  name: "set_in_out",
  description: "Set or clear the sequence In/Out points (used for 'export In to Out'). Pass null to clear a point.",
  schema: z.object({ in: sec.nullable().optional(), out: sec.nullable().optional() }),
  mutates: true,
  run: (i, ctx) => {
    const seq = activeSeq(ctx);
    if (i.in !== undefined) seq.inPoint = i.in === null ? undefined : Math.max(0, i.in);
    if (i.out !== undefined) seq.outPoint = i.out === null ? undefined : Math.max(0, i.out);
    if (seq.inPoint !== undefined && seq.outPoint !== undefined && seq.outPoint <= seq.inPoint) fail("Out must be after In.");
    return { text: `In ${seq.inPoint ?? "-"} / Out ${seq.outPoint ?? "-"}`, summary: `In/Out ${seq.inPoint ?? "-"}–${seq.outPoint ?? "-"}`, label: "Set In/Out" };
  },
});

// ---------------------------------------------------------------- AI-assisted edits

const ASPECTS: Record<string, [number, number]> = { "9:16": [1080, 1920], "4:5": [1080, 1350], "1:1": [1080, 1080], "16:9": [1920, 1080] };

tool({
  name: "auto_reframe",
  description:
    "Auto Reframe for social: change the frame to aspect 9:16 (1080x1920, TikTok/Reels/Shorts), 4:5, 1:1 or 16:9 and scale every visual clip to fill the frame. duplicate=true (default) makes a new sequence '<name> (9x16)' and leaves the original untouched. focus lets you keep the subject in frame per clip: [{clip_id, x, y}] where x/y are 0–1 positions of the subject in the SOURCE frame (0.5 = center) — check with view_media_frames/view_timeline_frames first. Text graphics are repositioned and resized proportionally.",
  schema: z.object({ aspect: z.enum(["9:16", "4:5", "1:1", "16:9"]), duplicate: z.boolean().optional(), name: z.string().optional(), focus: z.array(z.object({ clip_id: z.string(), x: z.number().optional(), y: z.number().optional() })).optional() }),
  mutates: true,
  run: ({ aspect, duplicate, name, focus }, ctx) => {
    let seq = activeSeq(ctx);
    const [w, h] = ASPECTS[aspect];
    const focusMap: Record<string, { x?: number; y?: number }> = {};
    for (const f of focus ?? []) {
      clipOf(seq, f.clip_id);
      focusMap[f.clip_id] = { x: f.x, y: f.y };
    }
    if (duplicate !== false) {
      const dup = duplicateSequence(ctx.project, seq.id, name ?? `${seq.name} (${aspect.replace(":", "x")})`);
      const mapped: typeof focusMap = {};
      for (const [k, v] of Object.entries(focusMap)) {
        const nk = dup.clipMap.get(k);
        if (nk) mapped[nk] = v;
        // linked partners share the same focus
        const orig = getClip(seq, k);
        for (const l of orig ? linkedClips(seq, orig) : []) {
          const lk = dup.clipMap.get(l.id);
          if (lk) mapped[lk] = v;
        }
      }
      seq = dup.seq;
      ctx.project.activeSequenceId = seq.id;
      Object.assign(focusMap, mapped);
    }
    const n = reframeSequence(ctx.project, seq, { width: w, height: h, focus: focusMap });
    return { text: `Reframed ${n} visual clips to ${w}x${h} in ${duplicate !== false ? "new " : ""}sequence ${seq.id} "${seq.name}" (now active).`, summary: `${aspect} · ${n} clips`, label: `Auto reframe ${aspect}` };
  },
});

tool({
  name: "remove_filler_words",
  description:
    "Text-based cleanup: find filler words (um, uh, erm, ah, hmm…) in the transcripts of the dialogue used in the active sequence and ripple-delete each one (with the pause right after it). include_phrases=true also removes 'you know', 'I mean', 'like', 'basically', 'actually', 'sort of', 'kind of' — riskier, check context. extra adds custom words/phrases. dry_run=true only lists what would be cut. Transcribes automatically if needed.",
  schema: z.object({ asset_ids: z.array(z.string()).optional(), include_phrases: z.boolean().optional(), extra: z.array(z.string()).optional(), dry_run: z.boolean().optional() }),
  mutates: true,
  run: async ({ asset_ids, include_phrases, extra, dry_run }, ctx) => {
    const seq = activeSeq(ctx);
    const ids = asset_ids ?? usedAssetIds(seq).filter((id) => ctx.project.media[id]?.hasAudio);
    if (!ids.length) fail("No dialogue clips in the sequence.");
    const ranges: Range[] = [];
    const found: string[] = [];
    for (const id of ids) {
      const a = await ensureTranscript(ctx, assetOf(ctx, id));
      const hits = findFillers(flattenWords(a), { includePhrases: include_phrases, extra });
      for (const h of hits) {
        const mapped = sourceRangeToSequence(seq, id, h.start, h.end);
        if (!mapped.length) continue;
        ranges.push(...mapped);
        found.push(`"${h.text}" @${f2(mapped[0].start)}s`);
      }
    }
    if (!ranges.length) return { text: "No filler words found in the sequence's dialogue.", summary: "No fillers" };
    if (dry_run) return { text: `Would remove ${found.length}: ${found.join(", ")}`, summary: `${found.length} fillers found` };
    const before = sequenceDuration(seq);
    const removed = rippleDeleteRanges(seq, ranges);
    return { text: `Removed ${found.length} fillers (${f2(removed)}s): ${found.join(", ")}. Sequence ${f2(before)}s → ${f2(sequenceDuration(seq))}s.`, summary: `${found.length} fillers cut`, label: "Remove filler words" };
  },
});

tool({
  name: "beat_sync",
  description:
    "Detect the tempo and beats of a music asset (onset analysis). Returns BPM, beat and downbeat times in source seconds. apply='markers' adds sequence markers at the beats where that music plays; apply='cut_track' re-times the consecutive clips on `track` (default V1) so every cut lands on a beat, holding each shot for beats_per_cut beats (default 2), starting at start_at (default first clip start) — place the music first.",
  schema: z.object({ music_asset_id: z.string(), apply: z.enum(["none", "markers", "cut_track"]).optional(), track: z.string().optional(), beats_per_cut: z.number().int().optional(), start_at: sec.optional(), downbeats_only: z.boolean().optional() }),
  mutates: true,
  run: async ({ music_asset_id, apply, track, beats_per_cut, start_at, downbeats_only }, ctx) => {
    const a = assetOf(ctx, music_asset_id);
    if (!a.hasAudio) fail(`"${a.name}" has no audio.`);
    const res = await detectBeats(await assetPath(a), ctx.signal);
    if (!res.beats.length) fail("No clear beat detected in that audio.");
    const srcBeats = downbeats_only ? res.downbeats : res.beats;
    let text = `Tempo ≈ ${res.bpm} BPM, ${res.beats.length} beats (${res.downbeats.length} downbeats). Beats (source s): ${srcBeats.slice(0, 48).map(f2).join(", ")}${srcBeats.length > 48 ? "…" : ""}`;
    if (!apply || apply === "none") return { text, summary: `${res.bpm} BPM` };
    const seq = activeSeq(ctx);
    const musicClip = assetUsageClips(seq, a.id)[0] ?? fail(`Place "${a.name}" in the sequence first (e.g. place_clip with include_video=false on audio_track 2).`);
    const seqBeats = srcBeats
      .filter((b) => b >= musicClip.sourceIn && b <= musicClip.sourceIn + musicClip.duration * musicClip.speed)
      .map((b) => r3(musicClip.start + (b - musicClip.sourceIn) / musicClip.speed));
    if (apply === "markers") {
      for (const b of seqBeats) addMarker(seq, b, { name: "Beat", color: "cyan" });
      return { text: text + `\nAdded ${seqBeats.length} beat markers.`, summary: `${res.bpm} BPM · ${seqBeats.length} markers`, label: "Beat markers" };
    }
    const tr = trackRef(seq, track ?? "V1");
    const r = cutClipsToBeats(ctx.project, seq, tr.id, seqBeats, Math.max(1, beats_per_cut ?? 2), start_at);
    text += `\nRe-timed ${r.cuts} clips on ${tr.name} to the beat; picture now ends at ${f2(r.endsAt)}s.`;
    return { text, summary: `${res.bpm} BPM · ${r.cuts} cuts on beat`, label: "Cut to the beat" };
  },
});

// ---------------------------------------------------------------- export

tool({
  name: "export_sequence",
  description:
    "Render the active sequence to a file in the user's export folder (ffmpeg). preset: an export preset id (e.g. youtube-1080, youtube-4k, tiktok-916, instagram-45, square-11, prores-422hq, gif; call with preset='list' for all; default 'match-high' = sequence size H.264). file_name without extension. range 'entire' (default) or 'inOut'. burn_captions burns the caption track into the picture; captions_sidecar writes .srt/.vtt. Only export when the user asked for it or clearly expects a file.",
  schema: z.object({ preset: z.string().optional(), file_name: z.string().optional(), range: z.enum(["entire", "inOut"]).optional(), burn_captions: z.boolean().optional(), captions_sidecar: z.enum(["none", "srt", "vtt"]).optional() }),
  mutates: false,
  run: async ({ preset, file_name, range, burn_captions, captions_sidecar }, ctx) => {
    if (preset === "list") return { text: EXPORT_PRESETS.map((p) => `${p.id}: ${p.name} — ${p.description}`).join("\n"), summary: `${EXPORT_PRESETS.length} presets` };
    const seq = activeSeq(ctx);
    if (sequenceDuration(seq) <= 0) fail("The sequence is empty.");
    let settings = defaultExportSettings(seq);
    if (preset) {
      if (!PRESET_MAP[preset]) fail(`Unknown preset "${preset}". Presets: ${EXPORT_PRESETS.map((p) => p.id).join(", ")}`);
      settings = applyPreset(settings, preset, seq);
    }
    settings.fileName = (file_name ?? seq.name).replace(/[/\\:*?"<>|]+/g, "_");
    if (range) settings.range = range;
    if (burn_captions !== undefined) settings.burnCaptions = burn_captions;
    if (captions_sidecar) settings.exportCaptionsSidecar = captions_sidecar;
    const hasGraphics = seq.clips.some((c) => c.generator && c.generator.kind !== "adjustmentLayer") || (settings.burnCaptions && seq.clips.some((c) => c.caption));
    const start = (exportModule as unknown as Record<string, unknown>).startExportJob as undefined | ((p: Project, s: ID, st: ExportSettings, g: Record<ID, string>) => unknown);
    if (hasGraphics || typeof start !== "function") {
      // titles/captions are rasterized by the browser renderer so the export matches the preview
      ctx.emit({ type: "export_request", sequenceId: seq.id, settings });
      return { text: `Export of "${seq.name}" handed to the app (${settings.width}x${settings.height} ${settings.format}, file "${settings.fileName}"). It appears in the Export Queue.`, summary: `Exporting ${settings.fileName}` };
    }
    const job = (await start(JSON.parse(JSON.stringify(ctx.project)), seq.id, settings, {})) as import("../../shared/types").ExportJob;
    ctx.emit({ type: "export_started", job });
    return { text: `Export started: ${job.outputPath} (job ${job.id}). It renders in the background; progress shows in the Export Queue.`, summary: `Exporting ${job.outputPath.split("/").pop()}` };
  },
});

// ---------------------------------------------------------------- registry export

export const TOOLS = tools;
export const TOOL_MAP = new Map(tools.map((t) => [t.name, t]));

/** JSON schema for the API: drop $schema; keep additionalProperties:false objects. */
function toInputSchema(s: z.ZodType): { type: "object"; properties?: unknown; required?: string[]; [k: string]: unknown } {
  const js = z.toJSONSchema(s, { unrepresentable: "any" }) as Record<string, unknown>;
  delete js.$schema;
  return js as { type: "object" };
}

export function apiToolDefinitions(): { name: string; description: string; input_schema: { type: "object"; [k: string]: unknown } }[] {
  return tools.map((t) => ({ name: t.name, description: t.description, input_schema: toInputSchema(t.schema) }));
}

export interface ToolRunResult { output: ToolOutput; isError: boolean; changed: boolean }

/** Validate + execute a tool against the context. Never throws. */
export async function runTool(name: string, input: unknown, ctx: ToolContext): Promise<ToolRunResult> {
  const def = TOOL_MAP.get(name);
  if (!def) return { output: { text: `Unknown tool "${name}".`, summary: "unknown tool" }, isError: true, changed: false };
  const parsed = def.schema.safeParse(input ?? {});
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".") || "(input)"}: ${i.message}`).join("; ");
    return { output: { text: `Invalid input for ${name}: ${issues}`, summary: "invalid input" }, isError: true, changed: false };
  }
  const before = def.mutates ? JSON.stringify(ctx.project) : "";
  try {
    const r = await def.run(parsed.data, ctx);
    const output = typeof r === "string" ? { text: r } : r;
    const changed = def.mutates && JSON.stringify(ctx.project) !== before;
    return { output, isError: false, changed };
  } catch (e) {
    // roll back partial mutations so a failed tool leaves no half-applied edit
    if (def.mutates && before) {
      const restored = JSON.parse(before) as Project;
      for (const k of Object.keys(ctx.project)) delete (ctx.project as unknown as Record<string, unknown>)[k];
      Object.assign(ctx.project, restored);
    }
    const msg = e instanceof ToolError ? e.message : `${name} failed: ${(e as Error).message}`;
    return { output: { text: msg, summary: msg.slice(0, 120) }, isError: true, changed: false };
  }
}
