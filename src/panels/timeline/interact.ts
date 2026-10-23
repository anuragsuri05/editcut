// Pointer interactions for the timeline: per-tool clip drags with live preview
// (committed once on pointerup), snapping, marquee, razor, drops.
import { produce } from "immer";
import type { Clip, ID, MediaAsset, Project, Sequence, TrackKind, TransitionType } from "@shared/types";
import {
  addTransition, placeAsset, clipEnd, clipsOnTrack, deleteClips, ensureTrack, getClip, getTrack, insertClips, moveClips, slideClip,
  slipClip, splitAt, trackIndex, tracksOfKind,
} from "@shared/ops";
import { defaultTextStyle, makeEffect, makeGeneratorClip } from "@shared/factory";
import { EFFECT_MAP, TRANSITION_MAP } from "@shared/effects";
import { formatTimecode, snapToFrame } from "@shared/time";
import { editor, getActiveSequence } from "../../store/store";
import { playback } from "../../store/playback";
import { createSequenceForAsset, editItemsInto, openSequenceTab } from "./editing";
import { edgePartners, expandSelection, freshCopies, plain, rateStretch, rippleTrimGroup, rollGroup, trimGroup } from "./ops-extra";
import { tl } from "./state";
import { CURSORS } from "./cursors";
import { zoomBy } from "./view";
import { importFiles, markDropHandled, waitForProbe } from "../../projectIO";

// ---------------------------------------------------------------- geometry

let root: HTMLElement | null = null;
export function setTimelineRoot(el: HTMLElement | null): void {
  root = el;
}

export function lanesLeft(): number {
  const ov = root?.querySelector(".tl-overlay") as HTMLElement | null;
  return ov?.getBoundingClientRect().left ?? 0;
}

export function timeAt(clientX: number): number {
  const st = editor();
  return Math.max(0, st.scrollTime + (clientX - lanesLeft()) / st.pxPerSec);
}

export interface RowHit {
  kind: TrackKind;
  index: number;
  trackId?: ID;
}

/** Track row under a client Y (or a virtual "new track" index above/below the stacks). */
export function rowAt(clientY: number): RowHit | null {
  const seq = getActiveSequence();
  if (!root || !seq) return null;
  const rows = root.querySelectorAll<HTMLElement>(".tl-lane[data-track-id]");
  for (const el of rows) {
    const r = el.getBoundingClientRect();
    if (clientY >= r.top && clientY < r.bottom) {
      const id = el.dataset.trackId!;
      const tr = getTrack(seq, id);
      if (tr) return { kind: tr.kind, index: trackIndex(seq, id), trackId: id };
    }
  }
  const vp = root.querySelector(".tl-pane.video")?.getBoundingClientRect();
  const ap = root.querySelector(".tl-pane.audio")?.getBoundingClientRect();
  if (vp && clientY >= vp.top && clientY < vp.bottom) return { kind: "video", index: tracksOfKind(seq, "video").length };
  if (ap && clientY >= ap.top && clientY < ap.bottom) return { kind: "audio", index: tracksOfKind(seq, "audio").length };
  return null;
}

const fpsOf = (seq: Sequence) => seq.settings.fps;
const frame = (t: number, seq: Sequence) => snapToFrame(Math.max(0, t), fpsOf(seq));
const isMod = (e: { metaKey: boolean; ctrlKey: boolean }) => (navigator.platform.includes("Mac") ? e.metaKey : e.ctrlKey);

// ---------------------------------------------------------------- snapping

export function snapPoints(seq: Sequence, exclude: Set<ID>): number[] {
  const pts: number[] = [0, playback().time];
  for (const c of seq.clips) {
    if (exclude.has(c.id)) continue;
    pts.push(c.start, clipEnd(c));
  }
  for (const m of seq.markers) {
    pts.push(m.time);
    if (m.duration > 0) pts.push(m.time + m.duration);
  }
  if (seq.inPoint !== undefined) pts.push(seq.inPoint);
  if (seq.outPoint !== undefined) pts.push(seq.outPoint);
  return pts;
}

/** Snap any of `candidates` (+offset) to the nearest point; returns [adjustment, snappedPoint|null]. */
export function snapOffset(candidates: number[], points: number[], thresholdPx = 8): [number, number | null] {
  if (!editor().snapping) return [0, null];
  const thr = thresholdPx / editor().pxPerSec;
  let best = 0, bestAbs = Infinity, hit: number | null = null;
  for (const c of candidates)
    for (const p of points) {
      const d = p - c;
      if (Math.abs(d) < bestAbs && Math.abs(d) <= thr) {
        best = d;
        bestAbs = Math.abs(d);
        hit = p;
      }
    }
  return [best, hit];
}

// ---------------------------------------------------------------- preview / commit

function baseState(): { seq: Sequence; project: Project } | null {
  const project = editor().project;
  const seq = project.activeSequenceId ? project.sequences[project.activeSequenceId] : null;
  return seq ? { seq, project } : null;
}

function setPreview(base: Sequence, project: Project, fn: (d: Sequence, p: Project) => void): void {
  tl().set({ preview: produce(base, (d) => fn(d as Sequence, project)) });
}

function commitPreview(label: string): void {
  const p = tl().preview;
  tl().set({ preview: null, snapLine: null, tooltip: null });
  if (!p) return;
  editor().apply(label, (d) => {
    d.sequences[p.id] = p as Sequence;
  });
}

function cancelPreview(): void {
  tl().set({ preview: null, snapLine: null, tooltip: null, marquee: null });
}

const tc = (t: number, seq: Sequence) => (t < 0 ? "-" : "+") + formatTimecode(Math.abs(t), fpsOf(seq));

// ---------------------------------------------------------------- generic drag session

interface DragHandlers {
  move: (e: PointerEvent, moved: boolean) => void;
  up: (e: PointerEvent, moved: boolean) => void;
  cancel?: () => void;
  cursor?: string;
  threshold?: number;
}

let activeDrag: { cancel: () => void } | null = null;
let lastPointer: PointerEvent | null = null;

export function beginDrag(e: { clientX: number; clientY: number; pointerId?: number }, h: DragHandlers): void {
  const x0 = e.clientX, y0 = e.clientY;
  let moved = false;
  const thr = h.threshold ?? 3;
  const prevCursor = document.body.style.cursor;
  const onMove = (ev: PointerEvent) => {
    lastPointer = ev;
    if (!moved && Math.abs(ev.clientX - x0) < thr && Math.abs(ev.clientY - y0) < thr) return;
    if (!moved && h.cursor) document.body.style.cursor = h.cursor;
    moved = true;
    h.move(ev, moved);
  };
  const end = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("keydown", onKey, true);
    window.removeEventListener("keyup", onKeyUp, true);
    document.body.style.cursor = prevCursor;
    activeDrag = null;
    lastPointer = null;
  };
  const onUp = (ev: PointerEvent) => {
    end();
    h.up(ev, moved);
  };
  const onKey = (ev: KeyboardEvent) => {
    if (ev.key === "Escape") {
      ev.stopPropagation();
      end();
      (h.cancel ?? cancelPreview)();
      return;
    }
    // modifier changes re-evaluate the drag (e.g. Cmd turns overwrite into insert)
    if (moved && lastPointer && ["Meta", "Control", "Alt", "Shift"].includes(ev.key)) {
      h.move(new PointerEvent("pointermove", { clientX: lastPointer.clientX, clientY: lastPointer.clientY, metaKey: ev.metaKey, ctrlKey: ev.ctrlKey, altKey: ev.altKey, shiftKey: ev.shiftKey }), true);
    }
  };
  const onKeyUp = (ev: KeyboardEvent) => onKey(ev);
  activeDrag?.cancel();
  activeDrag = { cancel: () => { end(); (h.cancel ?? cancelPreview)(); } };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("keydown", onKey, true);
  window.addEventListener("keyup", onKeyUp, true);
}

// ---------------------------------------------------------------- selection

function selectFromClick(e: { shiftKey: boolean; altKey: boolean }, seq: Sequence, clip: Clip): { ids: ID[]; collapseOnClick: ID[] | null } {
  const st = editor();
  const linked = st.linkedSelection && !e.altKey;
  const group = e.altKey ? [clip.id] : expandSelection(seq, [clip.id], linked);
  const cur = st.selection.clipIds;
  let ids: ID[];
  let collapse: ID[] | null = null;
  if (e.shiftKey) {
    const allIn = group.every((id) => cur.includes(id));
    ids = allIn ? cur.filter((id) => !group.includes(id)) : [...new Set([...cur, ...group])];
  } else if (cur.includes(clip.id)) {
    ids = cur;
    collapse = group; // a click without drag on an already-selected clip selects just it
  } else ids = group;
  st.select({ clipIds: ids, transitionId: null });
  tl().set({ selectedEdits: [], selectedGap: null, selectedMarkerId: null });
  return { ids, collapseOnClick: collapse };
}

// ---------------------------------------------------------------- clip pointer down

export type ClipZone = "body" | "in" | "out";

export function onClipPointerDown(e: React.PointerEvent, clipId: ID, zone: ClipZone): void {
  if (e.button !== 0) return;
  const b = baseState();
  if (!b) return;
  const { seq } = b;
  const clip = getClip(seq, clipId);
  if (!clip) return;
  const track = getTrack(seq, clip.trackId);
  if (!track) return;
  e.stopPropagation();
  const st = editor();
  const tool = st.tool;
  const t = timeAt(e.clientX);

  switch (tool) {
    case "razor":
      return razorAt(e, seq, clip, t);
    case "zoom":
      return void zoomBy(e.altKey ? 0.5 : 2, t, e.clientX - lanesLeft());
    case "hand":
      return handDrag(e);
    case "type":
      return addTextClip();
    case "trackForward":
    case "trackBackward":
      return trackSelect(e, seq, t, tool === "trackForward", track.id);
  }
  if (track.locked) return;
  if (tool === "slip" || tool === "slide") {
    selectFromClick({ shiftKey: false, altKey: e.altKey }, seq, clip);
    return slipSlideDrag(e, clip, tool, t);
  }
  if (zone !== "body" && (tool === "select" || tool === "ripple" || tool === "roll" || tool === "rateStretch")) {
    const mode = tool === "ripple" ? "ripple" : tool === "roll" ? "roll" : tool === "rateStretch" ? "rate" : isMod(e) ? "ripple" : "normal";
    return trimDrag(e, clip, zone, mode, t);
  }
  if (tool === "pen") return; // pen on clip body handled by the rubber band layer
  // selection tool body
  const { ids, collapseOnClick } = selectFromClick(e, seq, clip);
  if (e.shiftKey && !ids.includes(clip.id)) return;
  if (tool !== "select") return;
  moveDrag(e, ids, clip, t, collapseOnClick);
}

// ---------------------------------------------------------------- move

function moveDrag(e: React.PointerEvent, ids: ID[], grabbed: Clip, grabT: number, collapseOnClick: ID[] | null): void {
  const b = baseState()!;
  const { seq, project } = b;
  const moving = seq.clips.filter((c) => ids.includes(c.id) && !getTrack(seq, c.trackId)?.locked);
  if (!moving.length) return;
  const excl = new Set(moving.map((c) => c.id));
  const points = snapPoints(seq, excl);
  const minStart = Math.min(...moving.map((c) => c.start));
  const edges = moving.flatMap((c) => [c.start, clipEnd(c)]);
  const grabKind = getTrack(seq, grabbed.trackId)!.kind;
  const grabIdx = trackIndex(seq, grabbed.trackId);
  const minIdx = Math.min(...moving.map((c) => trackIndex(seq, c.trackId)));
  const altStart = e.altKey;
  let dTrack = 0;
  beginDrag(e, {
    cursor: "default",
    move: (ev) => {
      let dt = timeAt(ev.clientX) - grabT;
      dt = frame(minStart + dt, seq) - minStart;
      const [adj, hit] = snapOffset(edges.map((x) => x + dt), points);
      dt += adj;
      if (minStart + dt < 0) dt = -minStart;
      const row = rowAt(ev.clientY);
      if (row && row.kind === grabKind) dTrack = Math.max(-minIdx, row.index - grabIdx);
      const mode = isMod(ev) && ev.altKey ? "extractInsert" : isMod(ev) ? "insert" : "overwrite";
      const dup = (altStart || ev.altKey) && !isMod(ev);
      setPreview(seq, project, (d) => {
        let moveIds = moving.map((c) => c.id);
        if (dup) {
          const [copies] = freshCopies(moveIds.map((id) => getClip(d, id)!));
          d.clips.push(...copies);
          moveIds = copies.map((c) => c.id);
        }
        if (mode === "extractInsert") {
          const clips = moveIds.map((id) => plain(getClip(d, id)!));
          const span = Math.max(...clips.map(clipEnd)) - Math.min(...clips.map((c) => c.start));
          const origEnd = Math.max(...clips.map(clipEnd));
          deleteClips(d, moveIds, true);
          const shift = minStart + dt >= origEnd ? -span : 0;
          for (const c of clips) {
            const tr = getTrack(seq, c.trackId)!;
            c.trackId = ensureTrack(d, tr.kind, Math.max(0, trackIndex(seq, c.trackId) + dTrack)).id;
            c.start = c.start + dt + shift;
          }
          insertClips(d, clips);
        } else moveClips(d, moveIds, dt, dTrack, mode);
      });
      tl().set({ snapLine: hit, tooltip: { x: ev.clientX, y: ev.clientY, text: `${tc(dt, seq)}${mode === "insert" ? "  Insert" : mode === "extractInsert" ? "  Extract + Insert" : dup ? "  Duplicate" : ""}` } });
    },
    up: (ev, moved) => {
      if (!moved) {
        if (collapseOnClick && !ev.shiftKey) editor().select({ clipIds: collapseOnClick });
        cancelPreview();
        return;
      }
      const label = isMod(ev) && ev.altKey ? "Rearrange" : isMod(ev) ? "Insert Move" : ev.altKey || altStart ? "Duplicate" : "Move";
      commitPreview(label);
    },
  });
}

// ---------------------------------------------------------------- trims

type TrimKind = "normal" | "ripple" | "roll" | "rate";

function trimDrag(e: React.PointerEvent, clip: Clip, edge: "in" | "out", startMode: TrimKind, grabT: number): void {
  const b = baseState()!;
  const { seq, project } = b;
  const st = editor();
  const linked = st.linkedSelection && !e.altKey;
  const partners = linked ? edgePartners(seq, clip, edge) : [];
  const items = [{ clipId: clip.id, edge }, ...partners.map((p) => ({ clipId: p.id, edge }))];
  const origEdge = edge === "in" ? clip.start : clipEnd(clip);
  const excl = new Set(items.map((i) => i.clipId));
  if (startMode === "roll") {
    // the neighbour's edge is moving too
    const list = clipsOnTrack(seq, clip.trackId);
    const i = list.findIndex((x) => x.id === clip.id);
    const nb = edge === "out" ? list[i + 1] : list[i - 1];
    if (nb) excl.add(nb.id);
  }
  const points = snapPoints(seq, excl);
  const cursorFor = (m: TrimKind) =>
    m === "ripple" ? (edge === "in" ? CURSORS.rippleIn : CURSORS.rippleOut) : m === "roll" ? CURSORS.roll : m === "rate" ? CURSORS.rate : edge === "in" ? CURSORS.trimIn : CURSORS.trimOut;
  let mode = startMode;
  beginDrag(e, {
    cursor: cursorFor(mode),
    move: (ev) => {
      if (startMode === "normal" || startMode === "ripple") {
        if (st.tool === "select") mode = isMod(ev) ? "ripple" : "normal";
      }
      document.body.style.cursor = cursorFor(mode);
      let target = frame(origEdge + (timeAt(ev.clientX) - grabT), seq);
      const [adj, hit] = snapOffset([target], points);
      target += adj;
      const delta = target - origEdge;
      let applied = 0;
      setPreview(seq, project, (d, p) => {
        if (mode === "ripple") applied = rippleTrimGroup(p, d, items, delta, 1 / fpsOf(seq));
        else if (mode === "roll") applied = rollGroup(p, d, items, delta);
        else if (mode === "rate") applied = rateStretch(d, items.map((i) => i.clipId), edge, delta, 1 / fpsOf(seq));
        else applied = trimGroup(p, d, items, delta, 1 / fpsOf(seq));
      });
      const pv = tl().preview;
      const nc = pv ? getClip(pv, clip.id) : null;
      const extra = nc ? (mode === "rate" ? `  Speed ${(nc.speed * 100).toFixed(1)}%` : `  Duration ${formatTimecode(nc.duration, fpsOf(seq))}`) : "";
      tl().set({ snapLine: hit, tooltip: { x: ev.clientX, y: ev.clientY, text: `${edge === "in" ? "In" : "Out"}: ${tc(applied, seq)}${extra}` } });
    },
    up: (_ev, moved) => {
      if (!moved) {
        // click on an edge selects the edit point (Premiere)
        cancelPreview();
        editor().select({ clipIds: [], transitionId: null });
        tl().set({ selectedEdits: items, selectedGap: null });
        return;
      }
      commitPreview(mode === "ripple" ? "Ripple Trim" : mode === "roll" ? "Rolling Edit" : mode === "rate" ? "Rate Stretch" : "Trim");
    },
  });
}

// ---------------------------------------------------------------- slip / slide

function slipSlideDrag(e: React.PointerEvent, clip: Clip, tool: "slip" | "slide", grabT: number): void {
  const b = baseState()!;
  const { seq, project } = b;
  const linked = editor().linkedSelection && !e.altKey;
  const ids = linked ? expandSelection(seq, [clip.id], true) : [clip.id];
  const points = snapPoints(seq, new Set(ids));
  beginDrag(e, {
    cursor: tool === "slip" ? CURSORS.slip : CURSORS.slide,
    move: (ev) => {
      let dt = frame(clip.start + (timeAt(ev.clientX) - grabT), seq) - clip.start;
      if (tool === "slide") {
        const [adj, hit] = snapOffset([clip.start + dt, clipEnd(clip) + dt], points);
        dt += adj;
        tl().set({ snapLine: hit });
      }
      setPreview(seq, project, (d, p) => {
        for (const id of ids) {
          if (tool === "slip") slipClip(p, d, id, -dt);
          else slideClip(p, d, id, dt);
        }
      });
      const nc = getClip(tl().preview!, clip.id)!;
      const fps = fpsOf(seq);
      const text = tool === "slip"
        ? `Slip ${tc(-dt, seq)}   In ${formatTimecode(nc.sourceIn, fps)}  Out ${formatTimecode(nc.sourceIn + nc.duration * nc.speed, fps)}`
        : `Slide ${tc(nc.start - clip.start, seq)}   Start ${formatTimecode(nc.start, fps)}`;
      tl().set({ tooltip: { x: ev.clientX, y: ev.clientY, text } });
    },
    up: (_ev, moved) => (moved ? commitPreview(tool === "slip" ? "Slip" : "Slide") : cancelPreview()),
  });
}

// ---------------------------------------------------------------- razor

export function razorTime(seq: Sequence, clientX: number): number {
  let t = frame(timeAt(clientX), seq);
  const [adj] = snapOffset([t], snapPoints(seq, new Set()));
  t += adj;
  return t;
}

export function razorTracks(seq: Sequence, clip: Clip | null, trackId: ID | null, shift: boolean, alt: boolean): ID[] | "all" {
  if (shift) return "all";
  const ids = new Set<ID>();
  if (trackId) ids.add(trackId);
  if (clip && editor().linkedSelection && !alt) for (const c of expandSelection(seq, [clip.id], true)) ids.add(getClip(seq, c)!.trackId);
  return [...ids];
}

function razorAt(e: React.PointerEvent, seq: Sequence, clip: Clip | null, _t: number, trackId?: ID): void {
  const t = razorTime(seq, e.clientX);
  const tracks = razorTracks(seq, clip, clip?.trackId ?? trackId ?? null, e.shiftKey, e.altKey);
  editor().applySeq("Razor", (s) => {
    splitAt(s, t, tracks === "all" ? undefined : tracks);
  });
}

// ---------------------------------------------------------------- hand / type / track select

function handDrag(e: React.PointerEvent): void {
  const st = editor();
  const t0 = st.scrollTime;
  const pane = (e.target as HTMLElement).closest(".tl-pane") as HTMLElement | null;
  const top0 = pane?.scrollTop ?? 0;
  const x0 = e.clientX, y0 = e.clientY;
  beginDrag(e, {
    cursor: CURSORS.handDrag,
    threshold: 1,
    move: (ev) => {
      editor().setUI({ scrollTime: Math.max(0, t0 - (ev.clientX - x0) / editor().pxPerSec) });
      if (pane) pane.scrollTop = top0 - (ev.clientY - y0);
    },
    up: () => undefined,
    cancel: () => undefined,
  });
}

export function addTextClip(): void {
  const seq = getActiveSequence();
  if (!seq) return;
  const t = frame(playback().time, seq);
  const dur = 5;
  let newId: ID | null = null;
  editor().applySeq("New Text Layer", (s) => {
    const vids = tracksOfKind(s, "video");
    const target = Math.max(0, vids.findIndex((x) => x.targeted && !x.locked));
    let idx = target;
    while (idx < vids.length && (vids[idx].locked || s.clips.some((c) => c.trackId === vids[idx].id && c.start < t + dur && clipEnd(c) > t))) idx++;
    const tr = ensureTrack(s, "video", idx);
    const c = makeGeneratorClip({ kind: "text", style: defaultTextStyle() }, s.settings, tr.id, t, dur);
    s.clips.push(c);
    newId = c.id;
  });
  if (newId) editor().select({ clipIds: [newId], transitionId: null });
}

function trackSelect(e: React.PointerEvent, seq: Sequence, t: number, forward: boolean, trackId: ID): void {
  const singleTrack = e.shiftKey;
  const ids = seq.clips
    .filter((c) => !getTrack(seq, c.trackId)?.locked && (!singleTrack || c.trackId === trackId))
    .filter((c) => (forward ? clipEnd(c) > t + 1e-6 : c.start < t - 1e-6))
    .map((c) => c.id);
  const all = singleTrack && editor().linkedSelection ? expandSelection(seq, ids, true) : ids;
  editor().select({ clipIds: all, transitionId: null });
  if (!all.length) return;
  const grabbed = getClip(seq, all[0])!;
  moveDrag(e, all, grabbed, t, null);
}

// ---------------------------------------------------------------- empty lane pointer down

export function onLanePointerDown(e: React.PointerEvent, trackId: ID): void {
  if (e.button !== 0) return;
  const b = baseState();
  if (!b) return;
  const { seq } = b;
  const st = editor();
  const t = timeAt(e.clientX);
  switch (st.tool) {
    case "razor":
      if (e.shiftKey) razorAt(e, seq, null, t, trackId);
      return;
    case "zoom":
      return void zoomBy(e.altKey ? 0.5 : 2, t, e.clientX - lanesLeft());
    case "hand":
      return handDrag(e);
    case "type":
      return addTextClip();
    case "trackForward":
    case "trackBackward":
      return trackSelect(e, seq, t, st.tool === "trackForward", trackId);
  }
  marqueeDrag(e, seq, trackId, t);
}

function marqueeDrag(e: React.PointerEvent, seq: Sequence, trackId: ID, t: number): void {
  const st = editor();
  const base = e.shiftKey ? st.selection.clipIds : [];
  const x0 = e.clientX, y0 = e.clientY;
  beginDrag(e, {
    move: (ev) => {
      const marquee = { x0, y0, x1: ev.clientX, y1: ev.clientY };
      tl().set({ marquee });
      const ta = timeAt(Math.min(x0, ev.clientX)), tb = timeAt(Math.max(x0, ev.clientX));
      const ya = Math.min(y0, ev.clientY), yb = Math.max(y0, ev.clientY);
      const tracks = new Set<ID>();
      root?.querySelectorAll<HTMLElement>(".tl-lane[data-track-id]").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.bottom > ya && r.top < yb) tracks.add(el.dataset.trackId!);
      });
      let ids = seq.clips.filter((c) => tracks.has(c.trackId) && c.start < tb && clipEnd(c) > ta && !getTrack(seq, c.trackId)?.locked).map((c) => c.id);
      if (editor().linkedSelection && !ev.altKey) ids = expandSelection(seq, ids, true);
      editor().select({ clipIds: [...new Set([...base, ...ids])], transitionId: null });
    },
    up: (_ev, moved) => {
      tl().set({ marquee: null });
      if (moved) return;
      // plain click on empty space: deselect; select the gap if it's between clips
      editor().select({ clipIds: [], transitionId: null });
      const clips = clipsOnTrack(seq, trackId);
      const inGap = clips.some((c) => c.start > t) && !clips.some((c) => t >= c.start && t < clipEnd(c));
      tl().set({ selectedEdits: [], selectedGap: inGap ? { trackId, time: t } : null, selectedMarkerId: null });
    },
    cancel: () => tl().set({ marquee: null }),
  });
}

// ---------------------------------------------------------------- transitions

export function onTransitionPointerDown(e: React.PointerEvent, trId: ID, zone: "body" | "left" | "right"): void {
  if (e.button !== 0) return;
  e.stopPropagation();
  const b = baseState();
  if (!b) return;
  const { seq, project } = b;
  editor().select({ transitionId: trId, clipIds: [] });
  tl().set({ selectedGap: null, selectedEdits: [] });
  if (zone === "body") return;
  const tr = seq.transitions.find((t) => t.id === trId);
  if (!tr) return;
  const x0 = e.clientX;
  beginDrag(e, {
    cursor: "ew-resize",
    move: (ev) => {
      const dx = (ev.clientX - x0) / editor().pxPerSec;
      const k = tr.alignment === "center" ? 2 : 1;
      const grow = zone === "right" ? dx : -dx;
      const dur = Math.max(1 / fpsOf(seq), snapToFrame(tr.duration + grow * k, fpsOf(seq)));
      setPreview(seq, project, (d) => {
        const t = d.transitions.find((x) => x.id === trId);
        if (t) t.duration = dur;
      });
      tl().set({ tooltip: { x: ev.clientX, y: ev.clientY, text: `Duration ${formatTimecode(dur, fpsOf(seq))}` } });
    },
    up: (_ev, moved) => (moved ? commitPreview("Transition Duration") : cancelPreview()),
  });
}

// ---------------------------------------------------------------- drag & drop from other panels

export const MIME_ITEMS = "application/x-editcut-items";
export const MIME_EFFECT = "application/x-editcut-effect";
export const MIME_TRANSITION = "application/x-editcut-transition";
export const MIME_SOURCE_RANGE = "application/x-editcut-source-range";

function nearestCut(seq: Sequence, trackId: ID, t: number, thrSec: number): number | null {
  let best: number | null = null;
  for (const c of clipsOnTrack(seq, trackId)) {
    for (const p of [c.start, clipEnd(c)]) if (Math.abs(p - t) <= thrSec && (best === null || Math.abs(p - t) < Math.abs(best - t))) best = p;
  }
  return best;
}

function clipUnder(e: { clientX: number; clientY: number }): ID | null {
  const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
  return (el?.closest(".tl-clip") as HTMLElement | null)?.dataset.clipId ?? null;
}

export function onDragOver(e: React.DragEvent): void {
  const types = e.dataTransfer.types;
  const seq = getActiveSequence();
  if (types.includes(MIME_ITEMS) || (types.includes("Files") && !types.includes(MIME_EFFECT) && !types.includes(MIME_TRANSITION))) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    if (!seq) return;
    let t = frame(timeAt(e.clientX), seq);
    const [adj] = snapOffset([t], snapPoints(seq, new Set()));
    t += adj;
    const row = rowAt(e.clientY);
    tl().set({ drop: { time: t, trackId: row?.trackId, kind: isMod(e) ? "insert" : "overwrite" } });
  } else if (types.includes(MIME_TRANSITION)) {
    if (!seq) return;
    const row = rowAt(e.clientY);
    if (!row?.trackId) return tl().set({ drop: null });
    const cut = nearestCut(seq, row.trackId, timeAt(e.clientX), 24 / editor().pxPerSec);
    if (cut === null) return tl().set({ drop: null });
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    tl().set({ drop: { time: cut, trackId: row.trackId, kind: "transition" } });
  } else if (types.includes(MIME_EFFECT)) {
    const id = clipUnder(e);
    if (!id) return tl().set({ drop: null });
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    if (tl().drop?.clipId !== id) tl().set({ drop: { time: 0, kind: "effect", clipId: id } });
  }
}

export function onDragLeave(e: React.DragEvent): void {
  const rel = e.relatedTarget as Node | null;
  if (rel && (e.currentTarget as Node).contains(rel)) return;
  tl().set({ drop: null });
}

export function onDrop(e: React.DragEvent): void {
  const drop = tl().drop;
  tl().set({ drop: null });
  const st = editor();
  const dt = e.dataTransfer;
  if (!dt.types.includes(MIME_ITEMS) && dt.files?.length) {
    // OS files dropped on the timeline: import, wait for probing, then edit them in here
    e.preventDefault();
    markDropHandled(e);
    const files = [...dt.files];
    const mode = isMod(e) ? "insert" : "overwrite";
    const row = rowAt(e.clientY);
    const at = drop?.time;
    const clientX = e.clientX;
    void importFiles(files).then(async (assets) => {
      const ready = await waitForProbe(assets.map((a) => a.id));
      if (ready.length) placeItems(ready.map((a) => a.id), mode, row, at, clientX);
    });
    return;
  }
  if (dt.types.includes(MIME_ITEMS)) {
    e.preventDefault();
    markDropHandled(e);
    let ids: ID[] = [];
    try {
      ids = JSON.parse(dt.getData(MIME_ITEMS));
    } catch {
      return;
    }
    if (!Array.isArray(ids) || !ids.length) return;
    let range: SourceRange | undefined;
    if (dt.types.includes(MIME_SOURCE_RANGE)) {
      try {
        range = JSON.parse(dt.getData(MIME_SOURCE_RANGE));
      } catch {
        range = undefined;
      }
    }
    placeItems(ids, isMod(e) ? "insert" : "overwrite", rowAt(e.clientY), drop?.time, e.clientX, range);
    return;
  }
  if (dt.types.includes(MIME_TRANSITION)) {
    e.preventDefault();
    const type = dt.getData(MIME_TRANSITION) as TransitionType;
    const def = TRANSITION_MAP[type];
    const seq = getActiveSequence();
    if (!def || !seq || !drop?.trackId) return;
    const tr = getTrack(seq, drop.trackId);
    if (!tr || tr.locked) return;
    if ((def.kind === "audio") !== (tr.kind === "audio")) return void st.toast(`${def.name} is ${def.kind === "audio" ? "an audio" : "a video"} transition`, "error");
    st.applySeq(`Add ${def.name}`, (s) => {
      const cl = clipsOnTrack(s, drop.trackId!).filter((c) => Math.abs(c.start - drop.time) < 1e-3 || Math.abs(clipEnd(c) - drop.time) < 1e-3);
      const maxDur = Math.min(tl().defaultTransitionDuration, ...cl.map((c) => c.duration));
      addTransition(s, drop.trackId!, drop.time, type, Math.max(1 / s.settings.fps, maxDur));
    });
    return;
  }
  if (dt.types.includes(MIME_EFFECT)) {
    e.preventDefault();
    const type = dt.getData(MIME_EFFECT);
    const def = EFFECT_MAP[type];
    const target = drop?.clipId ?? clipUnder(e);
    const seq = getActiveSequence();
    if (!def || !target || !seq) return;
    const sel = st.selection.clipIds;
    const ids = sel.includes(target) ? sel : [target];
    let applied = 0;
    st.applySeq(`Apply ${def.name}`, (s) => {
      for (const id of ids) {
        const c = getClip(s, id);
        const kind = c && getTrack(s, c.trackId)?.kind;
        if (!c || !kind || kind === "caption" || getTrack(s, c.trackId)?.locked) continue;
        if ((def.kind === "audio") !== (kind === "audio")) continue;
        try {
          c.effects.push(makeEffect(type));
          applied++;
        } catch {
          /* unknown effect */
        }
      }
    });
    if (!applied) st.toast(`${def.name} can't be applied to that clip`, "error");
  }
}

/** Edit project items (media/sequences) into the active sequence (creating one if needed). */
interface SourceRange { assetId: ID; in: number; out: number; video: boolean; audio: boolean }

function placeItems(ids: ID[], mode: "insert" | "overwrite", row: RowHit | null, dropTime: number | undefined, clientX: number, range?: SourceRange): void {
  const st = editor();
  const seq0 = getActiveSequence();
  if (row?.trackId && seq0 && getTrack(seq0, row.trackId)?.locked) return void st.toast("Track is locked", "error");
  const vIdx = row && row.kind !== "caption" ? row.index : st.patchVideo ?? 0;
  const aIdx = row && row.kind !== "caption" ? row.index : st.patchAudio ?? 0;
  let created: Clip[] = [];
  st.apply(mode === "insert" ? "Insert" : "Overwrite", (d) => {
    let seq = d.activeSequenceId ? d.sequences[d.activeSequenceId] : undefined;
    let at = dropTime ?? (seq ? frame(timeAt(clientX), seq) : 0);
    if (!seq) {
      // empty timeline: create a sequence matching the first clip's settings
      const first = ids.map((id) => d.media[id]).find(Boolean) ?? null;
      const nested = ids.map((id) => d.sequences[id]).find(Boolean);
      if (!first && nested) {
        d.activeSequenceId = nested.id;
        return;
      }
      seq = createSequenceForAsset(d as Project, first as never);
      at = 0;
    }
    const ra = range && d.media[range.assetId];
    if (range && ra && ids.length === 1 && ids[0] === range.assetId) {
      // Source Monitor drag: its In/Out and Drag Video Only / Drag Audio Only
      created = placeAsset(seq, ra as MediaAsset, {
        at, mode, sourceIn: range.in, sourceOut: range.out > range.in ? range.out : undefined,
        includeVideo: range.video, includeAudio: range.audio, videoTrackIndex: vIdx, audioTrackIndex: aIdx,
      });
    } else created = editItemsInto(d as Project, seq, ids, at, mode, vIdx, aIdx);
  });
  const p = editor().project;
  if (p.activeSequenceId) openSequenceTab(p.activeSequenceId);
  if (created.length) st.select({ clipIds: created.map((c) => c.id), transitionId: null });
}
