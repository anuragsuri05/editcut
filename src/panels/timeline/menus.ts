// Premiere-style right-click menus for clips, gaps, transitions, track headers and the ruler.
import type { Clip, ID, LabelColor, Track } from "@shared/types";
import { LABEL_COLORS } from "@shared/types";
import { addTrack, deleteTrack, getClip, getTrack, rippleDeleteGap, tracksOfKind } from "@shared/ops";
import { TRANSITION_MAP } from "@shared/effects";
import { getCommand, keysFor, prettyKey, runCommand } from "../../commands/registry";
import { showContextMenu, type ContextMenuItem } from "../../ui/kit";
import { editor, getActiveSequence } from "../../store/store";
import { expandSelection, removeTransition } from "./ops-extra";
import { setDefaultTransition } from "./dialogs";
import { setDisplay, tl } from "./state";

type Ev = { clientX: number; clientY: number; preventDefault: () => void; stopPropagation?: () => void };

/** Menu item bound to a registered command (label/shortcut/enabled from the registry). */
function cmd(id: string, label?: string, fallback?: string): ContextMenuItem {
  const c = getCommand(id);
  const enabled = c ? !c.enabled || c.enabled() : !!fallback;
  return {
    label: label ?? c?.label ?? id,
    shortcut: keysFor(id)[0] ? prettyKey(keysFor(id)[0]) : undefined,
    disabled: !enabled,
    checked: c?.checked?.(),
    onClick: () => {
      if (!runCommand(id) && fallback) editor().toast(fallback);
    },
  };
}

const stub = (label: string, msg?: string): ContextMenuItem => ({ label, onClick: () => editor().toast(msg ?? `${label.replace(/…$/, "")} is not available yet`) });
const sep: ContextMenuItem = { separator: true };

export function clipContextMenu(e: Ev, clip: Clip): void {
  e.stopPropagation?.();
  const st = editor();
  const seq = getActiveSequence();
  if (!seq) return;
  if (!st.selection.clipIds.includes(clip.id)) {
    st.select({ clipIds: expandSelection(seq, [clip.id], st.linkedSelection), transitionId: null });
  }
  const sel = seq.clips.filter((c) => editor().selection.clipIds.includes(c.id));
  const kind = getTrack(seq, clip.trackId)?.kind;
  const kinds = new Set([kind, ...seq.clips.filter((c) => editor().selection.clipIds.includes(c.id)).map((c) => getTrack(seq, c.trackId)?.kind)]);
  const hasAudio = kinds.has("audio"), hasVideo = kinds.has("video");
  const linkedAll = sel.length > 0 && sel.every((c) => c.linkId && c.linkId === sel[0].linkId);
  const grouped = sel.some((c) => c.groupId);
  const ids = sel.map((c) => c.id);
  const setLabel = (l: LabelColor) => editor().applySeq("Label", (s) => {
    for (const c of s.clips) if (ids.includes(c.id)) c.label = l;
  });
  const setInterp = (v: NonNullable<Clip["timeInterpolation"]>) => editor().applySeq("Time Interpolation", (s) => {
    for (const c of s.clips) if (ids.includes(c.id)) c.timeInterpolation = v;
  });
  const interp = clip.timeInterpolation ?? "frameSampling";
  showContextMenu(e, [
    cmd("edit.cut"), cmd("edit.copy"), cmd("edit.pasteAttributes"), cmd("edit.removeAttributes"), sep,
    cmd("edit.clear"), cmd("edit.rippleDelete"), sep,
    cmd("clip.editOriginal"),
    { label: "Replace With Clip", submenu: [cmd("clip.replaceWithClip", "From Source Monitor")] }, sep,
    { ...cmd("clip.enable"), checked: clip.enabled },
    { label: linkedAll ? "Unlink" : "Link", disabled: !sel.length, onClick: () => runCommand("clip.link") },
    grouped ? cmd("clip.ungroup") : cmd("clip.group"),
    stub("Synchronize…"), stub("Merge Clips…"), cmd("clip.nest", "Nest…"), cmd("sequence.makeSubsequence"),
    { label: "Multi-Camera", submenu: [{ label: "Enable", disabled: true }, { label: "Flatten", disabled: true }] }, sep,
    {
      label: "Label",
      submenu: (Object.keys(LABEL_COLORS) as LabelColor[]).map((l) => ({ label: l[0].toUpperCase() + l.slice(1), checked: clip.label === l, onClick: () => setLabel(l) })),
    },
    sep,
    cmd("clip.speedDuration", "Speed/Duration…"),
    { label: "Scene Edit Detection…", disabled: kind !== "video" || !clip.assetId, onClick: () => runCommand("clip.sceneEditDetection") || editor().toast("Scene Edit Detection is not available") },
    sep,
    { ...cmd("clip.audioGain", "Audio Gain…"), disabled: !hasAudio },
    { ...cmd("clip.modifyAudioChannels", "Audio Channels…"), disabled: !hasAudio },
    sep,
    { ...cmd("clip.frameHold", "Frame Hold Options…"), disabled: !hasVideo },
    { ...cmd("clip.addFrameHold"), disabled: !hasVideo },
    { ...cmd("clip.insertFrameHold"), disabled: !hasVideo },
    stub("Field Options…"),
    {
      label: "Time Interpolation",
      submenu: [
        { label: "Frame Sampling", checked: interp === "frameSampling", onClick: () => setInterp("frameSampling") },
        { label: "Frame Blending", checked: interp === "frameBlending", onClick: () => setInterp("frameBlending") },
        { label: "Optical Flow", checked: interp === "opticalFlow", onClick: () => setInterp("opticalFlow") },
      ],
    },
    { ...cmd("clip.scaleToFrameSize"), disabled: !hasVideo },
    { ...cmd("clip.setToFrameSize"), disabled: !hasVideo },
    { label: "Adjustment Layer", checked: clip.generator?.kind === "adjustmentLayer", disabled: true }, sep,
    cmd("file.linkMedia", "Link Media…", "Link Media is handled in the Project panel"),
    cmd("file.makeOffline", "Make Offline…", "Make Offline is handled in the Project panel"), sep,
    cmd("clip.rename", "Rename…"), cmd("clip.reveal"), cmd("clip.revealInFinder"), sep,
    cmd("clip.properties"),
    { label: "Show Clip Keyframes", checked: tl().display.keyframes, onClick: () => setDisplay({ keyframes: !tl().display.keyframes }) },
  ]);
}

export function gapContextMenu(e: Ev, trackId: ID, time: number): void {
  tl().set({ selectedGap: { trackId, time } });
  editor().select({ clipIds: [], transitionId: null });
  showContextMenu(e, [
    {
      label: "Ripple Delete",
      onClick: () => {
        let ok = false;
        editor().applySeq("Ripple Delete", (s) => {
          ok = rippleDeleteGap(s, trackId, time);
        });
        if (!ok) editor().toast("Can't ripple delete: clips on sync-locked tracks would overlap", "error");
        tl().set({ selectedGap: null });
      },
    },
    sep,
    cmd("edit.paste"), cmd("edit.pasteInsert"),
  ]);
}

export function transitionContextMenu(e: Ev, trId: ID): void {
  e.stopPropagation?.();
  const seq = getActiveSequence();
  const tr = seq?.transitions.find((t) => t.id === trId);
  if (!tr) return;
  editor().select({ transitionId: trId, clipIds: [] });
  showContextMenu(e, [
    { label: "Set Selected as Default Transition", onClick: () => setDefaultTransition(tr.type) },
    { label: "Duration…", onClick: () => editor().openDialog("timeline.transitionDuration", { transitionId: trId }) },
    {
      label: "Alignment",
      disabled: !(tr.clipAId && tr.clipBId),
      submenu: (["center", "start", "end"] as const).map((a) => ({
        label: { center: "Center at Cut", start: "Start at Cut", end: "End at Cut" }[a],
        checked: tr.alignment === a,
        onClick: () => editor().applySeq("Transition Alignment", (s) => {
          const t = s.transitions.find((x) => x.id === trId);
          if (t) t.alignment = a;
        }),
      })),
    },
    sep,
    { label: `Clear ${TRANSITION_MAP[tr.type]?.name ?? "Transition"}`, onClick: () => editor().applySeq("Clear Transition", (s) => removeTransition(s, trId)) },
  ]);
}

export function trackHeaderMenu(e: Ev, track: Track, startRename: () => void): void {
  const seq = getActiveSequence();
  if (!seq) return;
  const kind = track.kind;
  const count = tracksOfKind(seq, kind).length;
  showContextMenu(e, [
    { label: "Rename", onClick: startRename },
    sep,
    { label: "Add Track", onClick: () => editor().applySeq("Add Track", (s) => void addTrack(s, kind)) },
    { label: "Add Tracks…", onClick: () => editor().openDialog("timeline.addTracks", { kind }) },
    { label: "Delete Track", disabled: kind !== "caption" && count <= 1, onClick: () => editor().applySeq("Delete Track", (s) => deleteTrack(s, track.id)) },
    { label: "Delete Tracks…", onClick: () => editor().openDialog("timeline.deleteTracks") },
    ...(kind === "audio" ? [sep, stub("Add Audio Submix Track"), stub("Voice-Over Record Settings…")] : []),
    ...(kind === "video" ? [sep, { label: "Show Video Thumbnails", checked: tl().display.thumbnails, onClick: () => setDisplay({ thumbnails: !tl().display.thumbnails }) }] : []),
    ...(kind === "audio" ? [{ label: "Show Audio Waveforms", checked: tl().display.waveforms, onClick: () => setDisplay({ waveforms: !tl().display.waveforms }) }] : []),
    { label: "Show Clip Keyframes", checked: tl().display.keyframes, onClick: () => setDisplay({ keyframes: !tl().display.keyframes }) },
  ]);
}

export function rulerContextMenu(e: Ev): void {
  showContextMenu(e, [
    cmd("markers.addMarker"), cmd("markers.goToNextMarker"), cmd("markers.goToPrevMarker"), cmd("markers.clearSelectedMarker"), cmd("markers.clearAllMarkers"), sep,
    cmd("markers.markIn"), cmd("markers.markOut"), cmd("markers.clearInOut"), sep,
    cmd("sequence.renderInOut"), cmd("sequence.deleteRenderFiles"),
  ]);
}

export function markerContextMenu(e: Ev, markerId: ID): void {
  e.stopPropagation?.();
  tl().set({ selectedMarkerId: markerId });
  showContextMenu(e, [
    { label: "Edit Marker…", onClick: () => editor().openDialog("timeline.marker", { markerId }) },
    { label: "Clear Selected Marker", onClick: () => editor().applySeq("Clear Marker", (s) => void (s.markers = s.markers.filter((m) => m.id !== markerId))) },
    cmd("markers.clearAllMarkers"),
  ]);
}

export { getClip };
