// Store-level timeline editing actions. Exported for the Source Monitor
// (insert/overwrite buttons), the AI agent and the timeline commands.
import type { Clip, ID, MediaAsset, Project, Sequence, TrackKind } from "@shared/types";
import {
  addTransition, clipEnd, clipsOnTrack, editPoints, extract, getClip, getTrack, insertClips, lift, overwriteClips,
  placeAsset, sequenceDuration, splitAt, tracksOfKind, trackIndex,
} from "@shared/ops";
import { makeSequence } from "@shared/factory";
import { TRANSITION_MAP } from "@shared/effects";
import { snapToFrame } from "@shared/time";
import { editor, getActiveSequence, useEditor } from "../../store/store";
import { playback } from "../../store/playback";
import { flattenSequenceClips, makeNestClips, sequenceContains } from "./ops-extra";
import { tl } from "./state";

const fpsOf = (seq: Sequence | null) => seq?.settings.fps ?? 30;

/** The live playhead snapped to the active sequence's frame grid. */
export function playheadTime(): number {
  return snapToFrame(playback().time, fpsOf(getActiveSequence()));
}

export function targetedTrackIds(seq: Sequence, kinds: TrackKind[] = ["video", "audio"]): ID[] {
  return seq.tracks.filter((t) => t.targeted && !t.locked && kinds.includes(t.kind)).map((t) => t.id);
}

/** Ensure the sequence id is in the open-tab list. */
export function openSequenceTab(id: ID): void {
  const s = tl();
  if (!s.openSeqIds.includes(id)) s.set({ openSeqIds: [...s.openSeqIds, id] });
}

/** Switch the active sequence (non-undoable), remembering the playhead per sequence. */
export function activateSequence(id: ID | null): void {
  const st = editor();
  const prev = st.project.activeSequenceId;
  if (prev === id) return;
  const t = playback().time;
  st.patch((d) => {
    if (prev && d.sequences[prev]) d.sequences[prev].playhead = t;
    d.activeSequenceId = id;
  });
  if (id) {
    openSequenceTab(id);
    playback().setTime(st.project.sequences[id]?.playhead ?? 0);
  }
  st.select({ clipIds: [], transitionId: null });
  tl().set({ selectedEdits: [], preview: null });
}

/** Create a sequence matching an asset's settings, add it to the project, and make it active. Call inside apply(). */
export function createSequenceForAsset(d: Project, asset: MediaAsset | null, name?: string): Sequence {
  const settings = asset && asset.kind !== "audio" && asset.width && asset.height ? { width: asset.width, height: asset.height, fps: asset.fps ? Math.round(asset.fps * 1000) / 1000 : 30 } : {};
  const seq = makeSequence(name ?? asset?.name.replace(/\.[^.]+$/, "") ?? "Sequence 01", settings);
  d.sequences[seq.id] = seq;
  d.items.push({ id: seq.id, type: "sequence", name: seq.name, parentId: null });
  d.activeSequenceId = seq.id;
  return seq;
}

/**
 * Edit project items (media or sequences) into a sequence at `at`.
 * videoIdx/audioIdx = 0-based destination tracks. Returns clips created.
 */
export function editItemsInto(d: Project, seq: Sequence, itemIds: ID[], at: number, mode: "insert" | "overwrite", videoIdx: number, audioIdx: number, nestSequences = tl().nestSequences): Clip[] {
  const created: Clip[] = [];
  let t = at;
  for (const id of itemIds) {
    const asset = d.media[id];
    if (asset) {
      if (asset.status === "error") continue;
      const clips = placeAsset(seq, asset as MediaAsset, { at: t, mode, videoTrackIndex: videoIdx, audioTrackIndex: audioIdx });
      created.push(...clips);
      if (clips.length) t = Math.max(...clips.map(clipEnd));
      continue;
    }
    const nested = d.sequences[id];
    if (nested) {
      if (sequenceContains(d as Project, nested.id, seq.id)) {
        editor().toast(`Can't nest "${nested.name}" into itself`, "error");
        continue;
      }
      const clips = nestSequences ? makeNestClips(seq, nested, t, videoIdx, audioIdx) : flattenSequenceClips(seq, nested, t, videoIdx, audioIdx);
      if (!clips.length) continue;
      if (mode === "insert") insertClips(seq, clips);
      else overwriteClips(seq, clips);
      created.push(...clips);
      t = Math.max(...clips.map(clipEnd));
    }
  }
  return created;
}

/**
 * Three-point edit from the Source Monitor (Premiere "," Insert / "." Overwrite).
 * Uses source In/Out (asset.inPoint/outPoint) and sequence In (or playhead);
 * respects source patching; afterwards moves the playhead to the end of the new
 * clip and clears the sequence In/Out.
 */
export function insertFromSource(mode: "insert" | "overwrite"): void {
  const st = editor();
  const assetId = st.sourceAssetId;
  const asset = assetId ? st.project.media[assetId] : null;
  if (!asset) {
    st.toast("Load a clip in the Source Monitor first", "error");
    return;
  }
  if (asset.status !== "ready" && asset.status !== "importing") {
    st.toast("Source media is offline", "error");
    return;
  }
  const includeVideo = st.patchVideo !== null && asset.hasVideo;
  const includeAudio = st.patchAudio !== null && asset.hasAudio;
  if (!includeVideo && !includeAudio) {
    st.toast("No source tracks are patched", "error");
    return;
  }
  let endTime = 0;
  st.apply(mode === "insert" ? "Insert" : "Overwrite", (d) => {
    let seq = d.activeSequenceId ? d.sequences[d.activeSequenceId] : undefined;
    if (!seq) seq = createSequenceForAsset(d, asset);
    const fps = seq.settings.fps;
    let sIn = asset.inPoint ?? 0;
    let sOut = asset.outPoint ?? (asset.kind === "image" ? sIn + 5 : asset.duration);
    if (sOut <= sIn) sOut = sIn + 1 / fps;
    const t = snapToFrame(playback().time, fps);
    let at: number;
    if (seq.inPoint !== undefined && seq.outPoint !== undefined && seq.outPoint > seq.inPoint) {
      // sequence In+Out define duration; backtime the source if only source Out is marked
      at = seq.inPoint;
      const dur = seq.outPoint - seq.inPoint;
      if (asset.inPoint === undefined && asset.outPoint !== undefined) sIn = Math.max(0, sOut - dur);
      else sOut = sIn + dur;
    } else if (seq.inPoint !== undefined) {
      at = seq.inPoint;
    } else if (seq.outPoint !== undefined) {
      at = Math.max(0, seq.outPoint - (sOut - sIn)); // backtiming
    } else at = t;
    const clips = placeAsset(seq, asset as MediaAsset, {
      at, sourceIn: sIn, sourceOut: sOut, mode, includeVideo, includeAudio,
      videoTrackIndex: st.patchVideo ?? 0, audioTrackIndex: st.patchAudio ?? 0,
    });
    endTime = clips.length ? Math.max(...clips.map(clipEnd)) : at;
    seq.inPoint = undefined;
    seq.outPoint = undefined;
    seq.playhead = endTime;
    if (d.activeSequenceId) openSequenceTab(d.activeSequenceId);
  });
  playback().setTime(endTime);
}

/** Lift (";") or Extract ("'") the sequence In→Out range on targeted tracks. */
export function liftOrExtractRange(mode: "lift" | "extract"): void {
  const st = editor();
  const seq = getActiveSequence();
  if (!seq) return;
  const a = seq.inPoint ?? 0;
  const b = seq.outPoint;
  if (seq.inPoint === undefined && b === undefined) {
    st.toast("Set In and Out points first", "error");
    return;
  }
  const end = b ?? sequenceDuration(seq);
  if (end - a <= 0) return;
  const tracks = targetedTrackIds(seq, ["video", "audio", "caption"]);
  if (!tracks.length) {
    st.toast("No tracks are targeted", "error");
    return;
  }
  st.applySeq(mode === "lift" ? "Lift" : "Extract", (s) => {
    if (mode === "lift") lift(s, a, end, tracks);
    else extract(s, a, end, tracks);
    s.inPoint = undefined;
    s.outPoint = undefined;
  });
  playback().setTime(a);
}

/** Up/Down arrows: go to the previous/next edit point on targeted (or all) tracks. */
export function goToEdit(direction: "prev" | "next", allTracks: boolean): void {
  const seq = getActiveSequence();
  if (!seq) return;
  const ids = allTracks ? undefined : targetedTrackIds(seq, ["video", "audio", "caption"]);
  const pts = editPoints(seq, ids && ids.length ? ids : undefined);
  const t = playback().time;
  const half = 0.5 / seq.settings.fps;
  const target = direction === "next" ? pts.find((p) => p > t + half) : [...pts].reverse().find((p) => p < t - half);
  if (target !== undefined) playback().setTime(target);
}

/** Split targeted (or all) tracks at the playhead (Add Edit). */
export function addEditAtPlayhead(allTracks: boolean): void {
  const seq = getActiveSequence();
  if (!seq) return;
  const t = playheadTime();
  const ids = allTracks ? seq.tracks.filter((x) => !x.locked).map((x) => x.id) : targetedTrackIds(seq, ["video", "audio", "caption"]);
  if (!ids.length) return;
  editor().applySeq(allTracks ? "Add Edit to All Tracks" : "Add Edit", (s) => {
    splitAtKeepLinks(s, t, ids);
  });
}

/** splitAt from shared/ops relinks right halves per link group. */
export function splitAtKeepLinks(seq: Sequence, t: number, trackIds?: ID[]): Clip[] {
  return splitAt(seq, t, trackIds);
}

/**
 * Apply the default video/audio transition at the edit point nearest the
 * playhead on targeted tracks (Ctrl/Cmd+D, Ctrl/Cmd+Shift+D). When clips are
 * selected (Shift+D) the transitions go on the selected clips' ends.
 */
export function applyDefaultTransition(kind: "video" | "audio" | "both", selectionOnly = false): void {
  const st = editor();
  const seq = getActiveSequence();
  if (!seq) return;
  const t = playback().time;
  const { defaultVideoTransition: vt, defaultAudioTransition: at, defaultTransitionDuration: dur } = tl();
  const kinds: TrackKind[] = kind === "both" ? ["video", "audio"] : [kind];
  let count = 0;
  st.applySeq("Apply Default Transition", (s) => {
    if (selectionOnly) {
      for (const id of st.selection.clipIds) {
        const c = getClip(s, id);
        if (!c) continue;
        const tk = getTrack(s, c.trackId)?.kind;
        if (!tk || !kinds.includes(tk) || tk === "caption") continue;
        const type = tk === "audio" ? at : vt;
        const d = Math.min(dur, c.duration / 2);
        if (addTransition(s, c.trackId, c.start, type, d)) count++;
        const c2 = getClip(s, id);
        if (c2 && addTransition(s, c2.trackId, clipEnd(c2), type, d)) count++;
      }
      return;
    }
    for (const tr of s.tracks) {
      if (!tr.targeted || tr.locked || !kinds.includes(tr.kind)) continue;
      const pts = editPoints(s, [tr.id]).filter((p) => clipsOnTrack(s, tr.id).some((c) => Math.abs(c.start - p) < 1e-6 || Math.abs(clipEnd(c) - p) < 1e-6));
      if (!pts.length) continue;
      const p = pts.reduce((best, x) => (Math.abs(x - t) < Math.abs(best - t) ? x : best), pts[0]);
      const type = tr.kind === "audio" ? at : vt;
      if (TRANSITION_MAP[type] && addTransition(s, tr.id, p, type, dur)) count++;
    }
  });
  if (!count) st.toast("No edit point found for the transition", "error");
}

/** F: Match Frame — load the clip under the playhead (topmost targeted track) in the Source Monitor at the same frame. */
export function matchFrame(): void {
  const st = editor();
  const seq = getActiveSequence();
  if (!seq) return;
  const t = playback().time;
  const vids = tracksOfKind(seq, "video").slice().reverse();
  const auds = tracksOfKind(seq, "audio");
  const order = [...vids.filter((x) => x.targeted), ...auds.filter((x) => x.targeted), ...vids, ...auds];
  for (const tr of order) {
    const c = clipsOnTrack(seq, tr.id).find((x) => t >= x.start - 1e-6 && t < clipEnd(x) - 1e-6 && x.assetId);
    if (!c) continue;
    const src = c.reversed ? c.sourceIn + (clipEnd(c) - t) * c.speed : c.sourceIn + (t - c.start) * c.speed;
    st.patchMedia(c.assetId!, { inPoint: c.sourceIn, outPoint: c.sourceIn + c.duration * c.speed });
    st.setUI({ sourceAssetId: c.assetId!, focusedMonitor: "source" });
    playback().setSourceTime(src);
    return;
  }
  st.toast("No clip under the playhead", "error");
}

/** Shift+R: Reverse Match Frame — find the Source Monitor frame in the active sequence. */
export function reverseMatchFrame(): void {
  const st = editor();
  const seq = getActiveSequence();
  const id = st.sourceAssetId;
  if (!seq || !id) return;
  const src = playback().sourceTime;
  const c = seq.clips.find((x) => x.assetId === id && src >= x.sourceIn - 1e-6 && src <= x.sourceIn + x.duration * x.speed + 1e-6);
  if (!c) {
    st.toast("Source frame not found in the sequence", "error");
    return;
  }
  playback().setTime(c.start + (src - c.sourceIn) / c.speed);
  st.setUI({ focusedMonitor: "program" });
}

/** Clip at the playhead on targeted tracks (D = select clip at playhead). */
export function clipsAtPlayheadOnTargets(seq: Sequence): Clip[] {
  const t = playback().time;
  const ids = targetedTrackIds(seq, ["video", "audio", "caption"]);
  return seq.clips.filter((c) => ids.includes(c.trackId) && t >= c.start - 1e-6 && t < clipEnd(c) - 1e-6);
}

export { trackIndex, useEditor };
