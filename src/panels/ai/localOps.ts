// Deterministic "AI" operations that run locally (no Claude/API key needed):
// transcription, silence removal, filler-word removal, scene edit detection,
// enhance speech, auto-duck, auto reframe and caption generation. Each edit is
// one undoable step through the editor store.
import type { Clip, ID, MediaAsset, Project, Sequence, Transcript } from "@shared/types";
import { clipsOnTrack, getTrack, linkedClips, splitAt, tracksOfKind } from "@shared/ops";
import { api, subscribeEvents } from "../../api";
import { getActiveSequence, useEditor } from "../../store/store";
import {
  addCaptionClips, assetUsageClips, duckClips, duplicateSequence, enhanceSpeech, findFillers, flattenWords, isAudioClip, mergeRanges,
  padSilences, reframeSequence, rippleDeleteRanges, sequenceWords, sourceRangeToSequence, repairLinks, type CaptionOptions, type Range,
} from "../../../server/ai/editOps";

const ed = () => useEditor.getState();

// ---------------------------------------------------------------- transcripts

/** Transcripts survive undo of unrelated steps through this cache (keyed by asset id). */
export const transcriptCache = new Map<ID, Transcript>();

let progressSub = false;
function ensureProgressEvents(): void {
  if (progressSub) return;
  progressSub = true;
  subscribeEvents((e) => {
    if (e.type !== "transcribe-progress") return;
    const name = ed().project.media[e.id]?.name ?? "media";
    if (e.progress >= 1) ed().setJob(`transcribe:${e.id}`, null);
    else ed().setJob(`transcribe:${e.id}`, { label: `Transcribing ${name}`, progress: e.progress });
  });
}

export function transcriptOf(a: MediaAsset | undefined): Transcript | undefined {
  if (!a) return undefined;
  return a.transcript ?? transcriptCache.get(a.id);
}

/** Project view with cached transcripts filled in (for word mapping). */
export function withTranscripts(p: Project): Project {
  let changed = false;
  const media: Project["media"] = {};
  for (const [id, a] of Object.entries(p.media)) {
    const t = !a.transcript ? transcriptCache.get(id) : undefined;
    if (t) {
      media[id] = { ...a, transcript: t };
      changed = true;
    } else media[id] = a;
  }
  return changed ? { ...p, media } : p;
}

export async function transcribeAsset(id: ID, opts: { force?: boolean; language?: string } = {}): Promise<Transcript> {
  ensureProgressEvents();
  const a = ed().project.media[id];
  const label = `Transcribing ${a?.name ?? "media"}`;
  ed().setJob(`transcribe:${id}`, { label, progress: 0.02 });
  try {
    const t = await api.transcribe(id, opts.language ?? "auto");
    transcriptCache.set(id, t);
    ed().patchMedia(id, { transcript: t });
    return t;
  } finally {
    ed().setJob(`transcribe:${id}`, null);
  }
}

function usedAudioAssets(seq: Sequence): MediaAsset[] {
  const p = ed().project;
  const ids = [...new Set(seq.clips.map((c) => c.assetId).filter(Boolean) as ID[])];
  return ids.map((id) => p.media[id]).filter((a): a is MediaAsset => !!a && a.hasAudio && a.status !== "error");
}

/** Transcribe every asset with audio used in the sequence (skips cached ones). */
export async function ensureSequenceTranscripts(seq: Sequence): Promise<number> {
  let n = 0;
  for (const a of usedAudioAssets(seq)) {
    if (transcriptOf(a)) {
      if (!a.transcript) ed().patchMedia(a.id, { transcript: transcriptCache.get(a.id) });
      continue;
    }
    await transcribeAsset(a.id);
    n++;
  }
  return n;
}

function requireSeq(): Sequence {
  const s = getActiveSequence();
  if (!s) throw new Error("Open a sequence first.");
  return s;
}

async function guard(label: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (e) {
    ed().toast(`${label}: ${(e as Error).message}`, "error");
  }
}

// ---------------------------------------------------------------- edits

export function removeSilences(opts: { noiseDb?: number; minDuration?: number; padding?: number } = {}): Promise<void> {
  return guard("Remove silences", async () => {
    const seq = requireSeq();
    const assets = usedAudioAssets(seq);
    if (!assets.length) throw new Error("No clips with audio in the sequence.");
    ed().setJob("ai-silence", { label: "Detecting silences…", progress: 0.3 });
    const ranges: Range[] = [];
    try {
      for (const a of assets) {
        const { silences } = await api.detectSilence(a.id, opts.noiseDb ?? -35, opts.minDuration ?? 0.5);
        for (const s of padSilences(silences, opts.padding ?? 0.12)) ranges.push(...sourceRangeToSequence(seq, a.id, s.start, s.end));
      }
    } finally {
      ed().setJob("ai-silence", null);
    }
    const merged = mergeRanges(ranges);
    if (!merged.length) return void ed().toast("No silences found");
    let removed = 0;
    ed().applySeq("Remove Silences", (s) => {
      removed = rippleDeleteRanges(s, merged);
    });
    ed().toast(`Removed ${merged.length} pauses (${removed.toFixed(1)}s)`, "success");
  });
}

/** Ripple-delete sequence ranges (used by the Text panel's text-based editing). */
export function deleteSequenceRanges(ranges: Range[], label = "Delete Words"): number {
  let removed = 0;
  ed().applySeq(label, (s) => {
    removed = rippleDeleteRanges(s, ranges);
  });
  return removed;
}

export function removeFillerWords(opts: { includePhrases?: boolean } = {}): Promise<void> {
  return guard("Remove filler words", async () => {
    const seq = requireSeq();
    await ensureSequenceTranscripts(seq);
    const p = withTranscripts(ed().project);
    const cur = p.sequences[seq.id];
    const ranges: Range[] = [];
    for (const a of usedAudioAssets(cur)) {
      const t = transcriptOf(p.media[a.id]);
      if (!t) continue;
      for (const h of findFillers(t.segments.flatMap((s) => s.words), opts)) ranges.push(...sourceRangeToSequence(cur, a.id, h.start, h.end));
    }
    if (!ranges.length) return void ed().toast("No filler words found");
    const n = mergeRanges(ranges).length;
    deleteSequenceRanges(ranges, "Remove Filler Words");
    ed().toast(`Removed ${n} filler words`, "success");
  });
}

/** Scene Edit Detection: split the selected clips (or all V1 clips) at detected shot changes. */
export function sceneEditDetection(): Promise<void> {
  return guard("Scene Edit Detection", async () => {
    const seq = requireSeq();
    const sel = ed().selection.clipIds;
    const v1 = tracksOfKind(seq, "video")[0];
    let clips = seq.clips.filter((c) => sel.includes(c.id) && c.assetId && getTrack(seq, c.trackId)?.kind === "video");
    if (!clips.length && v1) clips = clipsOnTrack(seq, v1.id).filter((c) => c.assetId);
    if (!clips.length) throw new Error("Select video clips to analyze.");
    const cutsByAsset = new Map<ID, number[]>();
    ed().setJob("ai-scenes", { label: "Detecting scenes…", progress: 0.4 });
    try {
      for (const id of new Set(clips.map((c) => c.assetId!))) {
        const a = ed().project.media[id];
        if (!a?.hasVideo || a.kind === "image") continue;
        cutsByAsset.set(id, (await api.detectScenes(id, 0.3)).cuts);
      }
    } finally {
      ed().setJob("ai-scenes", null);
    }
    let n = 0;
    const ids = clips.map((c) => c.id);
    ed().applySeq("Scene Edit Detection", (s) => {
      for (const id of ids) {
        const c = s.clips.find((x) => x.id === id);
        if (!c?.assetId) continue;
        const tracks = [...new Set(linkedClips(s, c).map((x) => x.trackId))];
        const times = (cutsByAsset.get(c.assetId) ?? [])
          .filter((cut) => cut > c.sourceIn + 0.04 && cut < c.sourceIn + c.duration * c.speed - 0.04)
          .map((cut) => c.start + (cut - c.sourceIn) / c.speed);
        for (const t of times) n += splitAt(s, t, tracks).length ? 1 : 0;
      }
      repairLinks(s);
    });
    ed().toast(n ? `Added ${n} edits at scene changes` : "No scene changes found", n ? "success" : "info");
  });
}

/** Enhance Speech on selected clips' audio (or every A1 clip). */
export function enhanceSpeechLocal(): void {
  const seq = getActiveSequence();
  if (!seq) return void ed().toast("Open a sequence first", "error");
  const sel = ed().selection.clipIds;
  const targets = new Set<ID>();
  for (const id of sel) {
    const c = seq.clips.find((x) => x.id === id);
    if (!c) continue;
    for (const l of linkedClips(seq, c)) if (isAudioClip(seq, l)) targets.add(l.id);
  }
  if (!targets.size) {
    const a1 = tracksOfKind(seq, "audio")[0];
    if (a1) for (const c of clipsOnTrack(seq, a1.id)) targets.add(c.id);
  }
  if (!targets.size) return void ed().toast("No dialogue clips to enhance", "error");
  ed().applySeq("Enhance Speech", (s) => {
    for (const c of s.clips) if (targets.has(c.id)) enhanceSpeech(c);
  });
  ed().toast(`Enhanced speech on ${targets.size} clips`, "success");
}

/** Auto-duck A2+ music under A1 dialogue (transcripts when available, otherwise silence detection). */
export function autoDuck(duckDb = -12): Promise<void> {
  return guard("Auto-duck", async () => {
    const seq = requireSeq();
    const audio = tracksOfKind(seq, "audio");
    if (audio.length < 2) throw new Error("Put dialogue on A1 and music on A2.");
    const dialog = clipsOnTrack(seq, audio[0].id);
    const music = audio.slice(1).flatMap((t) => clipsOnTrack(seq, t.id));
    if (!dialog.length || !music.length) throw new Error("Need dialogue on A1 and music on A2 or below.");
    const p = withTranscripts(ed().project);
    const speech: Range[] = sequenceWords(p, p.sequences[seq.id])
      .filter((w) => dialog.some((c) => c.id === w.clipId || (c.linkId && seq.clips.find((x) => x.id === w.clipId)?.linkId === c.linkId)))
      .map((w) => ({ start: w.start, end: w.end }));
    for (const c of dialog) {
      if (!c.assetId || transcriptOf(p.media[c.assetId])) continue;
      const { silences } = await api.detectSilence(c.assetId, -35, 0.4);
      const src = { start: c.sourceIn, end: c.sourceIn + c.duration * c.speed };
      let cur = src.start;
      for (const s of [...silences, { start: src.end, end: src.end }]) {
        const e = Math.min(s.start, src.end);
        if (e > cur) speech.push({ start: c.start + (cur - c.sourceIn) / c.speed, end: c.start + (e - c.sourceIn) / c.speed });
        cur = Math.max(cur, s.end);
        if (cur >= src.end) break;
      }
    }
    if (!speech.length) throw new Error("No dialogue detected on A1.");
    const ids = new Set(music.map((m) => m.id));
    ed().applySeq("Auto Duck", (s) => {
      duckClips(s.clips.filter((c) => ids.has(c.id)), mergeRanges(speech, 0.6), duckDb, 0.35);
    });
    ed().toast(`Ducked ${music.length} music clips under dialogue`, "success");
  });
}

/** Sequence > Auto Reframe Sequence: duplicate to a vertical/portrait/square sequence and fill the frame. */
export function autoReframeSequence(aspect: "9:16" | "4:5" | "1:1" = "9:16"): void {
  const seq = getActiveSequence();
  if (!seq) return void ed().toast("Open a sequence first", "error");
  const size = { "9:16": [1080, 1920], "4:5": [1080, 1350], "1:1": [1080, 1080] }[aspect];
  let newName = "";
  ed().apply(`Auto Reframe ${aspect}`, (d) => {
    const { seq: copy } = duplicateSequence(d, seq.id, `${seq.name} (${aspect.replace(":", "x")})`);
    reframeSequence(d, copy, { width: size[0], height: size[1] });
    d.activeSequenceId = copy.id;
    newName = copy.name;
  });
  ed().toast(`Created "${newName}"`, "success");
}

/** Clip > Auto Reframe: scale the selected visual clips to fill the current frame (centered). */
export function autoReframeClips(): void {
  const seq = getActiveSequence();
  if (!seq) return void ed().toast("Open a sequence first", "error");
  const ids = ed().selection.clipIds.filter((id) => seq.clips.some((c) => c.id === id && getTrack(seq, c.trackId)?.kind === "video"));
  if (!ids.length) return void ed().toast("Select video clips to reframe", "error");
  ed().applySeq("Auto Reframe Clips", (s, p) => {
    reframeSequence(p, s, { width: s.settings.width, height: s.settings.height, only: ids });
  });
}

/** Captions > Create captions from the sequence transcript. */
export function generateCaptions(opts: CaptionOptions & { style?: "standard" | "social" } = {}): Promise<number> {
  let count = 0;
  return guard("Create captions", async () => {
    const seq = requireSeq();
    await ensureSequenceTranscripts(seq);
    const p = withTranscripts(ed().project);
    const words = sequenceWords(p, p.sequences[seq.id]);
    if (!words.length) throw new Error("No speech found in the sequence.");
    ed().applySeq("Create Captions", (s) => {
      count = addCaptionClips(s, words, { ...opts, fps: s.settings.fps }).count;
    });
    ed().toast(`Created ${count} captions`, "success");
  }).then(() => count);
}

export function transcribeSequence(): Promise<void> {
  return guard("Transcribe", async () => {
    const seq = getActiveSequence();
    const selected = ed().selection.itemIds.map((id) => ed().project.media[id]).filter((a): a is MediaAsset => !!a?.hasAudio);
    const targets = selected.length ? selected : seq ? usedAudioAssets(seq) : [];
    if (!targets.length) throw new Error("Select media with audio or open a sequence.");
    for (const a of targets) await transcribeAsset(a.id, { force: false });
    ed().toast(`Transcribed ${targets.length} clip${targets.length > 1 ? "s" : ""}`, "success");
  });
}

export { assetUsageClips, flattenWords };
export type { Clip };
