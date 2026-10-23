// Timeline commands: edit.*, clip.*, sequence.*, markers.*, tool.* (see src/commands/menus.ts).
import type { Clip, ID, MediaAsset, Sequence } from "@shared/types";
import {
  clipEnd, closeAllGaps, deleteClips, getClip, getTrack, lift, linkClips, moveClips, rippleDeleteGap, sequenceDuration,
  slideClip, slipClip, tracksOfKind, unlinkClips, normalizeTransitions, overwriteClips,
} from "@shared/ops";
import { fitMotion, makeMarker, uid } from "@shared/factory";
import { snapToFrame } from "@shared/time";
import { registerCommands, runCommand, type Command } from "../../commands/registry";
import { editor, getActiveSequence, useEditor, type ToolId } from "../../store/store";
import { playback } from "../../store/playback";
import { openPanel } from "../../dock";
import {
  activateSequence, addEditAtPlayhead, applyDefaultTransition, clipsAtPlayheadOnTargets, goToEdit, liftOrExtractRange,
  matchFrame, openSequenceTab, playheadTime, reverseMatchFrame, targetedTrackIds,
} from "./editing";
import {
  addFrameHold, copyClips, extendEditsTo, freshCopies, insertFrameHoldSegment, pasteClips, plain, removeTransition,
  renderSegments, trimEditToPlayhead,
} from "./ops-extra";
import { getClipboard, setClipboard, tl } from "./state";
import { TOOL_DEFS } from "./tools";
import { ensureVisible, zoomAroundPlayhead, zoomToFit } from "./view";
import "./dialogs";

const ed = () => useEditor.getState();
const hasSeq = () => !!getActiveSequence();
const sel = () => ed().selection.clipIds;
const hasSel = () => hasSeq() && sel().length > 0;
const fps = () => getActiveSequence()?.settings.fps ?? 30;

function selectedClips(seq: Sequence | null = getActiveSequence()): Clip[] {
  if (!seq) return [];
  const ids = sel();
  return seq.clips.filter((c) => ids.includes(c.id));
}

function needSelection(): boolean {
  if (sel().length) return true;
  ed().toast("Select clips in the timeline first", "error");
  return false;
}

// ---------------------------------------------------------------- clipboard / delete

function copySelection(): boolean {
  const seq = getActiveSequence();
  if (!seq || !needSelection()) return false;
  const data = copyClips(seq, sel());
  setClipboard(data);
  return !!data;
}

function paste(mode: "overwrite" | "insert"): void {
  const data = getClipboard();
  const seq = getActiveSequence();
  if (!data || !seq) return;
  const at = playheadTime();
  let ids: ID[] = [];
  ed().applySeq(mode === "insert" ? "Paste Insert" : "Paste", (s) => {
    ids = pasteClips(s, data, at, mode).map((c) => c.id);
  });
  ed().select({ clipIds: ids, transitionId: null });
  playback().setTime(at + data.duration);
}

function clearSelection(ripple: boolean): void {
  const st = ed();
  const seq = getActiveSequence();
  if (!seq) return;
  const t = tl();
  if (st.selection.transitionId) {
    const id = st.selection.transitionId;
    st.applySeq("Clear Transition", (s) => removeTransition(s, id));
    st.select({ transitionId: null });
    return;
  }
  if (!st.selection.clipIds.length && t.selectedGap) {
    const g = t.selectedGap;
    st.applySeq("Ripple Delete", (s) => {
      if (!rippleDeleteGap(s, g.trackId, g.time)) st.toast("Can't close the gap: clips on sync-locked tracks would overlap", "error");
    });
    t.set({ selectedGap: null });
    return;
  }
  if (!st.selection.clipIds.length && t.selectedMarkerId) {
    const mid = t.selectedMarkerId;
    st.applySeq("Clear Marker", (s) => void (s.markers = s.markers.filter((m) => m.id !== mid)));
    t.set({ selectedMarkerId: null });
    return;
  }
  const ids = st.selection.clipIds;
  if (!ids.length) return;
  st.applySeq(ripple ? "Ripple Delete" : "Clear", (s) => deleteClips(s, ids, ripple));
  st.select({ clipIds: [] });
}

function duplicateSelection(): void {
  const seq = getActiveSequence();
  if (!seq || !needSelection()) return;
  const clips = selectedClips(seq);
  const t0 = Math.min(...clips.map((c) => c.start));
  const t1 = Math.max(...clips.map(clipEnd));
  let ids: ID[] = [];
  ed().applySeq("Duplicate", (s) => {
    const [copies] = freshCopies(clips.map((c) => getClip(s, c.id)!).filter(Boolean));
    for (const c of copies) c.start += t1 - t0;
    overwriteClips(s, copies);
    ids = copies.map((c) => c.id);
  });
  ed().select({ clipIds: ids });
}

// ---------------------------------------------------------------- clip helpers

function nudge(frames: number, dTrack = 0): void {
  const ids = sel();
  if (!ids.length) return;
  ed().applySeq(dTrack ? "Move Clips" : "Nudge Clips", (s) => moveClips(s, ids, frames / fps(), dTrack, "overwrite"));
}

function slipSel(frames: number): void {
  const ids = sel();
  if (!ids.length) return;
  ed().applySeq("Slip", (s, p) => {
    for (const id of ids) slipClip(p, s, id, frames / fps());
  });
}

function slideSel(frames: number): void {
  const ids = sel();
  if (!ids.length) return;
  ed().applySeq("Slide", (s, p) => {
    for (const id of ids) slideClip(p, s, id, frames / fps());
  });
}

function toggleLink(): void {
  const clips = selectedClips();
  if (!clips.length) return;
  const sameLink = clips.every((c) => c.linkId && c.linkId === clips[0].linkId);
  const ids = clips.map((c) => c.id);
  if (sameLink || (clips.length === 1 && clips[0].linkId)) ed().applySeq("Unlink", (s) => unlinkClips(s, ids));
  else ed().applySeq("Link", (s) => linkClips(s, ids));
}

function setGroup(on: boolean): void {
  const ids = sel();
  if (!ids.length) return;
  const gid = uid("grp_");
  ed().applySeq(on ? "Group" : "Ungroup", (s) => {
    for (const c of s.clips) if (ids.includes(c.id)) c.groupId = on ? gid : undefined;
  });
}

function toggleEnable(): void {
  const clips = selectedClips();
  if (!clips.length) return;
  const to = !clips.every((c) => c.enabled);
  const ids = clips.map((c) => c.id);
  ed().applySeq(to ? "Enable" : "Disable", (s) => {
    for (const c of s.clips) if (ids.includes(c.id)) c.enabled = to;
  });
}

function scaleToFrame(label: string): void {
  const seq = getActiveSequence();
  if (!seq) return;
  const media = ed().project.media;
  const ids = sel();
  ed().applySeq(label, (s) => {
    for (const c of s.clips) {
      if (!ids.includes(c.id) || !c.motion) continue;
      const a = c.assetId ? media[c.assetId] : undefined;
      const w = a?.width ?? s.settings.width, h = a?.height ?? s.settings.height;
      const m = fitMotion(s.settings, w, h, true);
      c.motion.scale = m.scale;
      c.motion.anchorX = m.anchorX;
      c.motion.anchorY = m.anchorY;
    }
  });
}

function frameHold(insert: boolean): void {
  const seq = getActiveSequence();
  if (!seq) return;
  const t = playheadTime();
  const vids = new Set(tracksOfKind(seq, "video").map((x) => x.id));
  let clip = selectedClips(seq).find((c) => vids.has(c.trackId) && t >= c.start && t < clipEnd(c));
  clip ??= clipsAtPlayheadOnTargets(seq).find((c) => vids.has(c.trackId));
  if (!clip) {
    ed().toast("Place the playhead over a selected video clip", "error");
    return;
  }
  const id = clip.id;
  ed().applySeq(insert ? "Insert Frame Hold Segment" : "Add Frame Hold", (s) => {
    if (insert) insertFrameHoldSegment(s, id, t, s.settings.fps, 2);
    else addFrameHold(s, id, t, s.settings.fps);
  });
}

function replaceWithSource(): void {
  const st = ed();
  const asset = st.sourceAssetId ? st.project.media[st.sourceAssetId] : null;
  if (!asset) {
    st.toast("Load a clip in the Source Monitor first", "error");
    return;
  }
  const ids = sel();
  if (!ids.length) return void needSelection();
  st.applySeq("Replace With Clip", (s) => {
    for (const c of s.clips) {
      if (!ids.includes(c.id) || c.generator || c.caption) continue;
      const kind = getTrack(s, c.trackId)?.kind;
      if ((kind === "video" && !asset.hasVideo) || (kind === "audio" && !asset.hasAudio)) continue;
      c.assetId = asset.id;
      c.sequenceId = undefined;
      c.name = asset.name;
      c.sourceIn = asset.inPoint ?? 0;
      const avail = asset.kind === "image" ? Infinity : (asset.duration - c.sourceIn) / c.speed;
      if (c.duration > avail) c.duration = Math.max(1 / s.settings.fps, avail);
    }
    normalizeTransitions(s);
  });
}

function makeSubclip(): void {
  const st = ed();
  const seq = getActiveSequence();
  const c = selectedClips(seq).find((x) => x.assetId);
  const asset = c?.assetId ? st.project.media[c.assetId] : st.sourceAssetId ? st.project.media[st.sourceAssetId] : null;
  if (!asset) {
    st.toast("Select a clip or load one in the Source Monitor", "error");
    return;
  }
  const inP = c ? c.sourceIn : asset.inPoint ?? 0;
  const outP = c ? c.sourceIn + c.duration * c.speed : asset.outPoint ?? asset.duration;
  const id = uid("med_");
  st.apply("Make Subclip", (d) => {
    const sub: MediaAsset = { ...plain(asset), id, name: `${asset.name.replace(/\.[^.]+$/, "")}.Subclip`, inPoint: inP, outPoint: outP, markers: [], importedAt: Date.now() };
    d.media[id] = sub;
    d.items.push({ id, type: "media", name: sub.name, parentId: null });
  });
  st.toast("Subclip created in the Project panel", "success");
}

function makeSubsequence(): void {
  const st = ed();
  const seq = getActiveSequence();
  if (!seq) return;
  const a = seq.inPoint ?? 0;
  const b = seq.outPoint ?? sequenceDuration(seq);
  const targeted = new Set(targetedTrackIds(seq, ["video", "audio", "caption"]));
  let newId: ID | null = null;
  st.apply("Make Subsequence", (d) => {
    const copy: Sequence = plain(d.sequences[seq.id]);
    copy.id = uid("seq_");
    copy.name = `${seq.name}_Sub_01`;
    copy.createdAt = Date.now();
    copy.inPoint = copy.outPoint = undefined;
    copy.clips = copy.clips.filter((c) => targeted.has(c.trackId) || selectedClips(seq).some((x) => x.id === c.id));
    const all = copy.tracks.map((t) => t.id);
    lift(copy, 0, a, all);
    lift(copy, b, Math.max(b, sequenceDuration(copy)) + 1, all);
    const [fresh] = freshCopies(copy.clips);
    copy.clips = fresh.map((c) => ({ ...c, start: c.start - a }));
    copy.transitions = [];
    copy.markers = copy.markers.filter((m) => m.time >= a && m.time < b).map((m) => ({ ...m, time: m.time - a }));
    copy.playhead = 0;
    d.sequences[copy.id] = copy;
    d.items.push({ id: copy.id, type: "sequence", name: copy.name, parentId: null });
    newId = copy.id;
  });
  if (newId) {
    openSequenceTab(newId);
    st.toast("Subsequence created", "success");
  }
}

// ---------------------------------------------------------------- markers / in-out

function setInOut(inPoint: number | undefined | null, outPoint: number | undefined | null, label: string): void {
  ed().applySeq(label, (s) => {
    if (inPoint !== null) s.inPoint = inPoint;
    if (outPoint !== null) s.outPoint = outPoint;
    if (s.inPoint !== undefined && s.outPoint !== undefined && s.outPoint < s.inPoint) {
      if (inPoint !== null && inPoint !== undefined) s.outPoint = undefined;
      else s.inPoint = undefined;
    }
  });
}

function markRange(clips: Clip[], label: string): void {
  if (!clips.length) return void ed().toast("Nothing to mark", "error");
  setInOut(Math.min(...clips.map((c) => c.start)), Math.max(...clips.map(clipEnd)), label);
}

function addMarker(chapter = false): void {
  const st = ed();
  const seq = getActiveSequence();
  if (!seq) return;
  const t = playheadTime();
  const clips = selectedClips(seq).filter((c) => t >= c.start - 1e-6 && t <= clipEnd(c) + 1e-6);
  if (chapter) return void st.openDialog("timeline.marker", { preset: { type: "chapter", color: "red" } });
  if (clips.length) {
    st.applySeq("Add Clip Marker", (s) => {
      for (const c of s.clips) if (clips.some((x) => x.id === c.id)) c.markers.push(makeMarker(t - c.start));
    });
    return;
  }
  const existing = seq.markers.find((m) => Math.abs(m.time - t) < 0.5 / fps());
  if (existing) return void st.openDialog("timeline.marker", { markerId: existing.id }); // M twice opens the dialog
  st.applySeq("Add Marker", (s) => {
    s.markers.push(makeMarker(t));
    s.markers.sort((a, b) => a.time - b.time);
  });
}

function goToMarker(dir: 1 | -1): void {
  const seq = getActiveSequence();
  if (!seq) return;
  const t = playback().time;
  const eps = 0.5 / fps();
  const times = [...seq.markers.map((m) => m.time)];
  for (const c of selectedClips(seq)) for (const m of c.markers) times.push(c.start + m.time);
  times.sort((a, b) => a - b);
  const target = dir > 0 ? times.find((x) => x > t + eps) : [...times].reverse().find((x) => x < t - eps);
  if (target !== undefined) {
    playback().setTime(target);
    ensureVisible(target);
  }
}

function markerAtPlayhead(seq: Sequence) {
  const t = playback().time;
  const id = tl().selectedMarkerId;
  return seq.markers.find((m) => m.id === id) ?? seq.markers.find((m) => Math.abs(m.time - t) < 0.5 / seq.settings.fps);
}

// ---------------------------------------------------------------- track heights

function setAllTrackHeights(h: number | ((cur: number, kind: string) => number), kinds = ["video", "audio", "caption"]): void {
  const id = editor().project.activeSequenceId;
  if (!id) return;
  editor().patch((d) => {
    const s = d.sequences[id];
    if (!s) return;
    for (const t of s.tracks) if (kinds.includes(t.kind)) t.height = Math.max(22, Math.min(320, typeof h === "number" ? h : h(t.height, t.kind)));
  });
}

// ---------------------------------------------------------------- registration

const cmds: Command[] = [];
const add = (c: Command) => cmds.push(c);

// tools
const toolKeys: Partial<Record<ToolId, string[]>> = {
  select: ["V"], trackForward: ["A"], trackBackward: ["Shift+A"], ripple: ["B"], roll: ["N"], rateStretch: ["R"], razor: ["C"],
  slip: ["Y"], slide: ["U"], pen: ["P"], hand: ["H"], zoom: ["Z"], type: ["T"],
};
for (const def of Object.values(TOOL_DEFS)) {
  add({ id: `tool.${def.id}`, label: def.label, keys: toolKeys[def.id], run: () => ed().setUI({ tool: def.id }), checked: () => ed().tool === def.id });
}

// edit.*
add({ id: "edit.cut", label: "Cut", keys: ["Mod+X"], enabled: hasSel, run: () => {
  if (!copySelection()) return;
  const ids = sel();
  ed().applySeq("Cut", (s) => deleteClips(s, ids, false));
  ed().select({ clipIds: [] });
} });
add({ id: "edit.copy", label: "Copy", keys: ["Mod+C"], enabled: hasSel, run: () => void copySelection() });
add({ id: "edit.paste", label: "Paste", keys: ["Mod+V"], enabled: () => hasSeq() && !!getClipboard(), run: () => paste("overwrite") });
add({ id: "edit.pasteInsert", label: "Paste Insert", keys: ["Mod+Shift+V"], enabled: () => hasSeq() && !!getClipboard(), run: () => paste("insert") });
add({ id: "edit.pasteAttributes", label: "Paste Attributes…", keys: ["Mod+Alt+V"], enabled: () => hasSel() && !!getClipboard(), run: () => ed().openDialog("timeline.pasteAttributes") });
add({ id: "edit.removeAttributes", label: "Remove Attributes…", enabled: hasSel, run: () => ed().openDialog("timeline.removeAttributes") });
add({ id: "edit.clear", label: "Clear", keys: ["Delete", "Backspace"], enabled: hasSeq, run: () => clearSelection(false) });
add({ id: "edit.rippleDelete", label: "Ripple Delete", keys: ["Shift+Delete", "Shift+Backspace", "Alt+Delete", "Alt+Backspace"], enabled: hasSeq, run: () => clearSelection(true) });
add({ id: "edit.duplicate", label: "Duplicate", keys: ["Mod+Shift+/"], enabled: hasSel, run: duplicateSelection });
add({ id: "edit.selectAll", label: "Select All", keys: ["Mod+A"], enabled: hasSeq, run: () => {
  const seq = getActiveSequence()!;
  ed().select({ clipIds: seq.clips.filter((c) => !getTrack(seq, c.trackId)?.locked).map((c) => c.id), transitionId: null });
} });
add({ id: "edit.deselectAll", label: "Deselect All", keys: ["Mod+Shift+A"], run: () => {
  ed().select({ clipIds: [], transitionId: null });
  tl().set({ selectedEdits: [], selectedGap: null, selectedMarkerId: null });
} });
add({ id: "edit.find", label: "Find…", keys: ["Mod+F", "Mod+Alt+F"], enabled: hasSeq, run: () => ed().openDialog("timeline.find") });
add({ id: "edit.label", label: "Label…", enabled: hasSel, run: () => ed().openDialog("timeline.label") });

// clip.*
add({ id: "clip.rename", label: "Rename…", enabled: hasSel, run: () => ed().openDialog("timeline.renameClip") });
add({ id: "clip.makeSubclip", label: "Make Subclip…", keys: ["Mod+U"], run: makeSubclip });
add({ id: "clip.editSubclip", label: "Edit Subclip…", run: () => ed().toast("Edit Subclip: adjust the subclip's In/Out in the Source Monitor") });
add({ id: "clip.modifyAudioChannels", label: "Audio Channels…", keys: ["Shift+G"], enabled: hasSel, run: () => ed().openDialog("timeline.audioChannels") });
add({ id: "clip.speedDuration", label: "Speed/Duration…", keys: ["Mod+R"], enabled: hasSel, run: () => ed().openDialog("timeline.speedDuration") });
add({ id: "clip.audioGain", label: "Audio Gain…", keys: ["G"], enabled: hasSel, run: () => ed().openDialog("timeline.audioGain") });
add({ id: "clip.enable", label: "Enable", keys: ["Shift+E"], enabled: hasSel, run: toggleEnable, checked: () => {
  const c = selectedClips();
  return c.length > 0 && c.every((x) => x.enabled);
} });
add({ id: "clip.link", label: "Link / Unlink", keys: ["Mod+L"], enabled: hasSel, run: toggleLink });
add({ id: "clip.unlink", label: "Unlink", enabled: () => selectedClips().some((c) => c.linkId), run: () => {
  const ids = sel();
  ed().applySeq("Unlink", (s) => unlinkClips(s, ids));
} });
add({ id: "clip.group", label: "Group", keys: ["Mod+G"], enabled: () => sel().length > 1, run: () => setGroup(true) });
add({ id: "clip.ungroup", label: "Ungroup", keys: ["Mod+Shift+G"], enabled: () => selectedClips().some((c) => c.groupId), run: () => setGroup(false) });
add({ id: "clip.nest", label: "Nest…", enabled: hasSel, run: () => ed().openDialog("timeline.nest") });
add({ id: "clip.replaceWithClip", label: "Replace With Clip (From Source Monitor)", enabled: hasSel, run: replaceWithSource });
add({ id: "clip.frameHold", label: "Frame Hold Options…", enabled: hasSel, run: () => ed().openDialog("timeline.frameHold") });
add({ id: "clip.addFrameHold", label: "Add Frame Hold", enabled: hasSeq, run: () => frameHold(false) });
add({ id: "clip.insertFrameHold", label: "Insert Frame Hold Segment", enabled: hasSeq, run: () => frameHold(true) });
add({ id: "clip.scaleToFrameSize", label: "Scale to Frame Size", enabled: hasSel, run: () => scaleToFrame("Scale to Frame Size") });
add({ id: "clip.setToFrameSize", label: "Set to Frame Size", enabled: hasSel, run: () => scaleToFrame("Set to Frame Size") });
add({ id: "clip.reveal", label: "Reveal in Project", enabled: () => selectedClips().some((c) => c.assetId || c.sequenceId), run: () => {
  const c = selectedClips().find((x) => x.assetId || x.sequenceId)!;
  ed().select({ itemIds: [c.assetId ?? c.sequenceId!] });
  openPanel("project");
} });
add({ id: "clip.revealInFinder", label: "Reveal in Finder", enabled: () => selectedClips().some((c) => c.assetId), run: () => {
  const c = selectedClips().find((x) => x.assetId)!;
  const a = ed().project.media[c.assetId!];
  ed().toast(a ? a.path : "Media not found");
} });
add({ id: "clip.editOriginal", label: "Edit Original", enabled: () => selectedClips().some((c) => c.assetId), run: () => ed().toast("Edit Original isn't available in the browser") });
add({ id: "clip.properties", label: "Properties", enabled: hasSel, run: () => ed().openDialog("timeline.clipProperties") });
add({ id: "clip.nudgeLeft", label: "Nudge Clip Left One Frame", keys: ["Alt+ArrowLeft"], enabled: hasSel, run: () => nudge(-1) });
add({ id: "clip.nudgeRight", label: "Nudge Clip Right One Frame", keys: ["Alt+ArrowRight"], enabled: hasSel, run: () => nudge(1) });
add({ id: "clip.nudgeLeft5", label: "Nudge Clip Left Five Frames", keys: ["Alt+Shift+ArrowLeft"], enabled: hasSel, run: () => nudge(-5) });
add({ id: "clip.nudgeRight5", label: "Nudge Clip Right Five Frames", keys: ["Alt+Shift+ArrowRight"], enabled: hasSel, run: () => nudge(5) });
add({ id: "clip.nudgeUp", label: "Nudge Clip Up One Track", keys: ["Alt+ArrowUp"], enabled: hasSel, run: () => nudge(0, 1) });
add({ id: "clip.nudgeDown", label: "Nudge Clip Down One Track", keys: ["Alt+ArrowDown"], enabled: hasSel, run: () => nudge(0, -1) });
add({ id: "clip.slipLeft", label: "Slip Clip Selection Left One Frame", keys: ["Mod+Alt+ArrowLeft"], enabled: hasSel, run: () => slipSel(-1) });
add({ id: "clip.slipRight", label: "Slip Clip Selection Right One Frame", keys: ["Mod+Alt+ArrowRight"], enabled: hasSel, run: () => slipSel(1) });
add({ id: "clip.slideLeft", label: "Slide Clip Selection Left One Frame", keys: ["Alt+,"], enabled: hasSel, run: () => slideSel(-1) });
add({ id: "clip.slideRight", label: "Slide Clip Selection Right One Frame", keys: ["Alt+."], enabled: hasSel, run: () => slideSel(1) });

// sequence.*
add({ id: "sequence.renderInOut", label: "Render In to Out", keys: ["Enter"], enabled: hasSeq, run: () => {
  const seq = getActiveSequence()!;
  const a = seq.inPoint ?? 0, b = seq.outPoint ?? Infinity;
  const segs = renderSegments(seq, tl().rendered).filter((g) => g.end > a && g.start < b && g.color !== "green");
  const rendered = new Set(tl().rendered);
  for (const g of segs) rendered.add(g.key);
  tl().set({ rendered });
  ed().toast(segs.length ? `Rendered ${segs.length} segment${segs.length > 1 ? "s" : ""}` : "Nothing to render", "success");
} });
add({ id: "sequence.deleteRenderFiles", label: "Delete Render Files", enabled: hasSeq, run: () => {
  tl().set({ rendered: new Set() });
  ed().toast("Render files deleted");
} });
add({ id: "sequence.matchFrame", label: "Match Frame", keys: ["F"], enabled: hasSeq, run: matchFrame });
add({ id: "sequence.reverseMatchFrame", label: "Reverse Match Frame", keys: ["Shift+R"], enabled: () => hasSeq() && !!ed().sourceAssetId, run: reverseMatchFrame });
add({ id: "sequence.addEdit", label: "Add Edit", keys: ["Mod+K"], enabled: hasSeq, run: () => addEditAtPlayhead(false) });
add({ id: "sequence.addEditAllTracks", label: "Add Edit to All Tracks", keys: ["Mod+Shift+K"], enabled: hasSeq, run: () => addEditAtPlayhead(true) });
add({ id: "sequence.trimEdit", label: "Trim Edit", keys: ["Shift+T"], enabled: hasSeq, run: () => {
  const seq = getActiveSequence()!;
  const t = playback().time;
  const tracks = targetedTrackIds(seq);
  let best: { clipId: ID; edge: "in" | "out"; d: number } | null = null;
  for (const c of seq.clips) {
    if (!tracks.includes(c.trackId)) continue;
    for (const edge of ["in", "out"] as const) {
      const d = Math.abs((edge === "in" ? c.start : clipEnd(c)) - t);
      if (!best || d < best.d) best = { clipId: c.id, edge, d };
    }
  }
  if (!best) return;
  const c = getClip(seq, best.clipId)!;
  playback().setTime(best.edge === "in" ? c.start : clipEnd(c));
  tl().set({ selectedEdits: [{ clipId: best.clipId, edge: best.edge }] });
  ed().toast("Edit point selected — drag it, press E, or use Q/W to trim");
} });
add({ id: "sequence.extendEdit", label: "Extend Selected Edit to Playhead", keys: ["E"], enabled: hasSeq, run: () => {
  const edits = tl().selectedEdits;
  if (!edits.length) return void ed().toast("Select an edit point first", "error");
  const t = playheadTime();
  ed().applySeq("Extend Edit", (s, p) => extendEditsTo(p, s, edits, t));
} });
add({ id: "sequence.rippleTrimPrevious", label: "Ripple Trim Previous Edit to Playhead", keys: ["Q"], enabled: hasSeq, run: () => trimToPlayhead("prev", true) });
add({ id: "sequence.rippleTrimNext", label: "Ripple Trim Next Edit to Playhead", keys: ["W"], enabled: hasSeq, run: () => trimToPlayhead("next", true) });
add({ id: "sequence.trimPrevious", label: "Trim Previous Edit to Playhead", keys: ["Alt+Q"], enabled: hasSeq, run: () => trimToPlayhead("prev", false) });
add({ id: "sequence.trimNext", label: "Trim Next Edit to Playhead", keys: ["Alt+W"], enabled: hasSeq, run: () => trimToPlayhead("next", false) });
add({ id: "sequence.applyVideoTransition", label: "Apply Video Transition", keys: ["Mod+D"], enabled: hasSeq, run: () => applyDefaultTransition("video") });
add({ id: "sequence.applyAudioTransition", label: "Apply Audio Transition", keys: ["Mod+Shift+D"], enabled: hasSeq, run: () => applyDefaultTransition("audio") });
add({ id: "sequence.applyDefaultTransitionsToSelection", label: "Apply Default Transitions to Selection", keys: ["Shift+D"], enabled: hasSel, run: () => applyDefaultTransition("both", true) });
add({ id: "sequence.lift", label: "Lift", keys: [";"], enabled: hasSeq, run: () => liftOrExtractRange("lift") });
add({ id: "sequence.extract", label: "Extract", keys: ["'"], enabled: hasSeq, run: () => liftOrExtractRange("extract") });
add({ id: "sequence.rippleDeleteGap", label: "Ripple Delete Gap at Playhead", enabled: hasSeq, run: () => {
  const seq = getActiveSequence()!;
  const t = playback().time;
  const g = tl().selectedGap;
  const tracks = g ? [g.trackId] : targetedTrackIds(seq);
  const time = g ? g.time : t;
  let ok = false;
  ed().applySeq("Ripple Delete", (s) => {
    for (const id of tracks) if (rippleDeleteGap(s, id, time)) { ok = true; break; }
  });
  if (!ok) ed().toast("No gap at the playhead on targeted tracks", "error");
} });
add({ id: "sequence.closeGaps", label: "Close Gap", enabled: hasSeq, run: () => ed().applySeq("Close Gap", (s) => closeAllGaps(s)) });
add({ id: "sequence.goToNextGap", label: "Go to Next Gap in Sequence", enabled: hasSeq, run: () => goToGap(1) });
add({ id: "sequence.goToPrevGap", label: "Go to Previous Gap in Sequence", enabled: hasSeq, run: () => goToGap(-1) });
add({ id: "sequence.zoomIn", label: "Zoom In", keys: ["="], enabled: hasSeq, run: () => zoomAroundPlayhead(1.5, playback().time) });
add({ id: "sequence.zoomOut", label: "Zoom Out", keys: ["-"], enabled: hasSeq, run: () => zoomAroundPlayhead(1 / 1.5, playback().time) });
add({ id: "sequence.zoomToFit", label: "Zoom to Sequence", keys: ["\\"], enabled: hasSeq, run: () => zoomToFit(true) });
add({ id: "sequence.snapping", label: "Snap in Timeline", keys: ["S"], run: () => ed().setUI({ snapping: !ed().snapping }), checked: () => ed().snapping });
add({ id: "sequence.linkedSelection", label: "Linked Selection", run: () => ed().setUI({ linkedSelection: !ed().linkedSelection }), checked: () => ed().linkedSelection });
add({ id: "sequence.addTracks", label: "Add Tracks…", enabled: hasSeq, run: () => ed().openDialog("timeline.addTracks") });
add({ id: "sequence.deleteTracks", label: "Delete Tracks…", enabled: hasSeq, run: () => ed().openDialog("timeline.deleteTracks") });
add({ id: "sequence.deleteEmptyTracks", label: "Delete Empty Tracks", enabled: hasSeq, run: () => {
  ed().applySeq("Delete Empty Tracks", (s) => {
    for (const kind of ["video", "audio", "caption"] as const) {
      for (const t of tracksOfKind(s, kind)) {
        if (s.clips.some((c) => c.trackId === t.id)) continue;
        if (kind !== "caption" && tracksOfKind(s, kind).length <= 1) continue;
        s.tracks = s.tracks.filter((x) => x.id !== t.id);
      }
    }
    const names = /^[VAC]\d+$/;
    for (const kind of ["video", "audio", "caption"] as const) tracksOfKind(s, kind).forEach((t, i) => names.test(t.name) && (t.name = `${kind === "video" ? "V" : kind === "audio" ? "A" : "C"}${i + 1}`));
  });
} });
add({ id: "sequence.nest", label: "Nest…", enabled: hasSel, run: () => ed().openDialog("timeline.nest") });
add({ id: "sequence.makeSubsequence", label: "Make Subsequence", keys: ["Shift+U"], enabled: hasSeq, run: makeSubsequence });
add({ id: "sequence.simplify", label: "Simplify Sequence…", enabled: hasSeq, run: () => ed().openDialog("timeline.simplify") });
add({ id: "sequence.goToPrevEdit", label: "Go to Previous Edit Point", keys: ["ArrowUp"], enabled: hasSeq, run: () => goToEdit("prev", false) });
add({ id: "sequence.goToNextEdit", label: "Go to Next Edit Point", keys: ["ArrowDown"], enabled: hasSeq, run: () => goToEdit("next", false) });
add({ id: "sequence.goToPrevEditAny", label: "Go to Previous Edit Point on Any Track", keys: ["Shift+ArrowUp"], enabled: hasSeq, run: () => goToEdit("prev", true) });
add({ id: "sequence.goToNextEditAny", label: "Go to Next Edit Point on Any Track", keys: ["Shift+ArrowDown"], enabled: hasSeq, run: () => goToEdit("next", true) });
add({ id: "sequence.selectClipAtPlayhead", label: "Select Clip at Playhead", keys: ["D"], enabled: hasSeq, run: () => {
  const seq = getActiveSequence()!;
  ed().select({ clipIds: clipsAtPlayheadOnTargets(seq).map((c) => c.id), transitionId: null });
} });
add({ id: "sequence.expandAllTracks", label: "Expand All Tracks", keys: ["Shift+="], enabled: hasSeq, run: () => setAllTrackHeights((_, k) => (k === "caption" ? 48 : 110)) });
add({ id: "sequence.minimizeAllTracks", label: "Minimize All Tracks", keys: ["Shift+-"], enabled: hasSeq, run: () => setAllTrackHeights(24) });
add({ id: "sequence.increaseVideoHeights", label: "Increase Video Track Heights", keys: ["Mod+="], enabled: hasSeq, run: () => setAllTrackHeights((h) => h + 16, ["video"]) });
add({ id: "sequence.decreaseVideoHeights", label: "Decrease Video Track Heights", keys: ["Mod+-"], enabled: hasSeq, run: () => setAllTrackHeights((h) => h - 16, ["video"]) });
add({ id: "sequence.increaseAudioHeights", label: "Increase Audio Track Heights", keys: ["Alt+="], enabled: hasSeq, run: () => setAllTrackHeights((h) => h + 16, ["audio"]) });
add({ id: "sequence.decreaseAudioHeights", label: "Decrease Audio Track Heights", keys: ["Alt+-"], enabled: hasSeq, run: () => setAllTrackHeights((h) => h - 16, ["audio"]) });
add({ id: "sequence.close", label: "Close Sequence", enabled: hasSeq, run: () => {
  const id = ed().project.activeSequenceId!;
  const open = tl().openSeqIds.filter((x) => x !== id);
  tl().set({ openSeqIds: open });
  activateSequence(open[open.length - 1] ?? null);
} });

// markers.*
add({ id: "markers.markIn", label: "Mark In", keys: ["I"], enabled: hasSeq, run: () => setInOut(playheadTime(), null, "Mark In") });
add({ id: "markers.markOut", label: "Mark Out", keys: ["O"], enabled: hasSeq, run: () => setInOut(null, playheadTime(), "Mark Out") });
add({ id: "markers.markClip", label: "Mark Clip", keys: ["X"], enabled: hasSeq, run: () => markRange(clipsAtPlayheadOnTargets(getActiveSequence()!), "Mark Clip") });
add({ id: "markers.markSelection", label: "Mark Selection", keys: ["/"], enabled: hasSel, run: () => markRange(selectedClips(), "Mark Selection") });
add({ id: "markers.goToIn", label: "Go to In", keys: ["Shift+I"], enabled: () => getActiveSequence()?.inPoint !== undefined, run: () => playback().setTime(getActiveSequence()!.inPoint!) });
add({ id: "markers.goToOut", label: "Go to Out", keys: ["Shift+O"], enabled: () => getActiveSequence()?.outPoint !== undefined, run: () => playback().setTime(getActiveSequence()!.outPoint!) });
add({ id: "markers.clearIn", label: "Clear In", keys: ["Alt+I", "Mod+Shift+I"], enabled: hasSeq, run: () => setInOut(undefined, null, "Clear In") });
add({ id: "markers.clearOut", label: "Clear Out", keys: ["Alt+O", "Mod+Shift+O"], enabled: hasSeq, run: () => setInOut(null, undefined, "Clear Out") });
add({ id: "markers.clearInOut", label: "Clear In and Out", keys: ["Alt+X", "Mod+Shift+X"], enabled: hasSeq, run: () => setInOut(undefined, undefined, "Clear In and Out") });
add({ id: "markers.addMarker", label: "Add Marker", keys: ["M"], enabled: hasSeq, run: () => addMarker(false) });
add({ id: "markers.addChapterMarker", label: "Add Chapter Marker…", enabled: hasSeq, run: () => addMarker(true) });
add({ id: "markers.goToNextMarker", label: "Go to Next Marker", keys: ["Shift+M"], enabled: hasSeq, run: () => goToMarker(1) });
add({ id: "markers.goToPrevMarker", label: "Go to Previous Marker", keys: ["Mod+Shift+M"], enabled: hasSeq, run: () => goToMarker(-1) });
add({ id: "markers.clearSelectedMarker", label: "Clear Selected Marker", keys: ["Alt+M"], enabled: hasSeq, run: () => {
  const seq = getActiveSequence()!;
  const m = markerAtPlayhead(seq);
  if (!m) return;
  ed().applySeq("Clear Marker", (s) => void (s.markers = s.markers.filter((x) => x.id !== m.id)));
  tl().set({ selectedMarkerId: null });
} });
add({ id: "markers.clearAllMarkers", label: "Clear All Markers", keys: ["Mod+Alt+M"], enabled: () => !!getActiveSequence()?.markers.length, run: () => ed().applySeq("Clear All Markers", (s) => void (s.markers = [])) });
add({ id: "markers.editMarker", label: "Edit Marker…", enabled: hasSeq, run: () => {
  const m = markerAtPlayhead(getActiveSequence()!);
  if (m) ed().openDialog("timeline.marker", { markerId: m.id });
  else ed().toast("No marker at the playhead", "error");
} });

function trimToPlayhead(which: "prev" | "next", ripple: boolean): void {
  const seq = getActiveSequence();
  if (!seq) return;
  const t = playheadTime();
  const tracks = targetedTrackIds(seq, ["video", "audio", "caption"]);
  let ok = false;
  let newT = t;
  ed().applySeq(ripple ? (which === "prev" ? "Ripple Trim Previous Edit" : "Ripple Trim Next Edit") : which === "prev" ? "Trim Previous Edit" : "Trim Next Edit", (s) => {
    // compute where the previous edit was so the playhead lands on the new cut
    if (which === "prev" && ripple) {
      const under = s.clips.filter((c) => tracks.includes(c.trackId) && t > c.start + 1e-6 && t < clipEnd(c) - 1e-6);
      if (under.length) newT = Math.max(...under.map((c) => c.start));
    }
    ok = trimEditToPlayhead(s, tracks, t, which, ripple);
  });
  if (ok && ripple && which === "prev") playback().setTime(snapToFrame(newT, seq.settings.fps));
}

function goToGap(dir: 1 | -1): void {
  const seq = getActiveSequence();
  if (!seq) return;
  const t = playback().time;
  const spans = seq.clips.map((c) => [c.start, clipEnd(c)] as [number, number]).sort((a, b) => a[0] - b[0]);
  const gaps: number[] = [];
  let cursor = 0;
  for (const [a, b] of spans) {
    if (a > cursor + 1e-6) gaps.push(cursor);
    cursor = Math.max(cursor, b);
  }
  const target = dir > 0 ? gaps.find((g) => g > t + 1e-6) : [...gaps].reverse().find((g) => g < t - 1e-6);
  if (target !== undefined) playback().setTime(target);
}

registerCommands(cmds);

/** Run a command, falling back to a toast when another module hasn't registered it. */
export function runOrToast(id: string, fallback: string): void {
  if (!runCommand(id)) editor().toast(fallback);
}
