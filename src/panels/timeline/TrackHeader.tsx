// Track header: source patch, targeting, sync lock, lock, output/mute/solo/mic, name, volume, resize.
import { memo, useState } from "react";
import { ArrowLeftRight, Eye, EyeOff, Lock, LockOpen, Mic } from "lucide-react";
import type { Track } from "@shared/types";
import { tracksOfKind } from "@shared/ops";
import { HotNumber } from "../../ui/kit";
import { editor, useEditor } from "../../store/store";
import { trackHeaderMenu } from "./menus";
import { beginDrag } from "./interact";

type Flag = "locked" | "syncLock" | "muted" | "solo";

function toggleFlag(track: Track, flag: Flag, all: boolean, label: string): void {
  const to = !track[flag];
  editor().applySeq(label, (s) => {
    for (const t of s.tracks) if (t.id === track.id || (all && t.kind === track.kind)) t[flag] = to;
  });
}

function patchTrack(trackId: string, fn: (t: Track) => void): void {
  const id = editor().project.activeSequenceId;
  if (!id) return;
  editor().patch((d) => {
    const t = d.sequences[id]?.tracks.find((x) => x.id === trackId);
    if (t) fn(t);
  });
}

export const TrackHeader = memo(function TrackHeader(props: { track: Track; index: number; height: number; patched: boolean; patchLabel: string | null; patchKind: "video" | "audio" | null }) {
  const { track, height } = props;
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(track.name);
  const [vol, setVol] = useState<number | null>(null);
  const sourceLoaded = useEditor((s) => !!s.sourceAssetId);
  const isA = track.kind === "audio", isV = track.kind === "video";
  const startRename = () => {
    setName(track.name);
    setRenaming(true);
  };
  const commitRename = () => {
    setRenaming(false);
    if (name.trim() && name !== track.name) editor().applySeq("Rename Track", (s) => {
      const t = s.tracks.find((x) => x.id === track.id);
      if (t) t.name = name.trim();
    });
  };
  const defaultName = /^[VAC]\d+$/.test(track.name);
  const longName = isV ? `Video ${props.index + 1}` : isA ? `Audio ${props.index + 1}` : `Subtitle ${props.index + 1}`;
  return (
    <div
      className={"tl-header " + track.kind + (track.targeted ? " targeted" : "") + (height < 34 ? " compact" : "")}
      style={{ height }}
      onContextMenu={(e) => trackHeaderMenu(e, track, startRename)}
      onDoubleClick={(e) => {
        if ((e.target as HTMLElement).closest("button, input, .hot-number")) return;
        patchTrack(track.id, (t) => (t.height = t.height < 60 ? 110 : t.kind === "video" ? 56 : t.kind === "audio" ? 52 : 32));
      }}
    >
      {/* source patch column */}
      <div
        className="tl-patch-col"
        title={props.patchKind ? "Source patching: click to patch the source here; click the patched indicator to toggle it" : undefined}
        onClick={() => {
          if (!props.patchKind) return;
          const key = props.patchKind === "video" ? "patchVideo" : "patchAudio";
          const cur = editor()[key];
          editor().setUI({ [key]: cur === props.index ? null : props.index } as never);
        }}
      >
        {props.patchLabel && sourceLoaded ? <span className={"tl-patch" + (props.patched ? " on" : "")}>{props.patchLabel}</span> : null}
      </div>
      {/* track targeting (name box) */}
      <button
        className={"tl-target" + (track.targeted ? " on" : "")}
        title="Toggle track targeting (Shift-click: all tracks of this type)"
        onClick={(e) => {
          const to = !track.targeted;
          const id = editor().project.activeSequenceId;
          if (!id) return;
          editor().patch((d) => {
            for (const t of d.sequences[id].tracks) if (t.id === track.id || (e.shiftKey && t.kind === track.kind)) t.targeted = to;
          });
        }}
      >
        {isV ? `V${props.index + 1}` : isA ? `A${props.index + 1}` : `C${props.index + 1}`}
      </button>
      {track.kind !== "caption" ? (
        <button className={"tl-tbtn" + (track.syncLock ? " on" : "")} title="Toggle Sync Lock" onClick={(e) => toggleFlag(track, "syncLock", e.shiftKey, "Toggle Sync Lock")}>
          <ArrowLeftRight size={12} />
        </button>
      ) : null}
      <button className={"tl-tbtn" + (track.locked ? " on lock" : "")} title="Toggle Track Lock" onClick={(e) => toggleFlag(track, "locked", e.shiftKey, "Toggle Track Lock")}>
        {track.locked ? <Lock size={12} /> : <LockOpen size={12} />}
      </button>
      {isV || track.kind === "caption" ? (
        <button className={"tl-tbtn" + (track.muted ? " off" : "")} title="Toggle Track Output" onClick={(e) => toggleFlag(track, "muted", e.shiftKey, "Toggle Track Output")}>
          {track.muted ? <EyeOff size={12} /> : <Eye size={12} />}
        </button>
      ) : null}
      {isA ? (
        <>
          <button className={"tl-tbtn txt" + (track.muted ? " mute" : "")} title="Mute Track" onClick={(e) => toggleFlag(track, "muted", e.shiftKey, "Mute Track")}>M</button>
          <button className={"tl-tbtn txt" + (track.solo ? " solo" : "")} title="Solo Track" onClick={(e) => toggleFlag(track, "solo", e.shiftKey, "Solo Track")}>S</button>
          <button className="tl-tbtn" title="Voice-over record" onClick={() => editor().toast("Voice-over recording is not available yet")}>
            <Mic size={12} />
          </button>
        </>
      ) : null}
      <div className="tl-track-name">
        {renaming ? (
          <input
            className="text-input"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") setRenaming(false);
            }}
          />
        ) : height >= 34 ? (
          <span onDoubleClick={(e) => { e.stopPropagation(); startRename(); }} title="Double-click to rename">{defaultName ? longName : track.name}</span>
        ) : null}
        {isA && height >= 40 ? (
          <span className="tl-track-vol" title="Track volume">
            <HotNumber
              value={vol ?? track.volumeDb}
              min={-60}
              max={6}
              step={0.1}
              decimals={1}
              unit="dB"
              onChange={setVol}
              onCommit={(v) => {
                setVol(null);
                editor().applySeq("Track Volume", (s) => {
                  const t = s.tracks.find((x) => x.id === track.id);
                  if (t) t.volumeDb = v;
                });
              }}
            />
          </span>
        ) : null}
      </div>
      <div
        className="tl-resize"
        onPointerDown={(e) => {
          e.stopPropagation();
          const h0 = track.height;
          const y0 = e.clientY;
          // video tracks stack upward: dragging the top edge (rendered at the bottom for audio) feels natural either way
          beginDrag(e, { cursor: "ns-resize", threshold: 1, move: (ev) => patchTrack(track.id, (t) => (t.height = Math.max(22, Math.min(320, h0 + (ev.clientY - y0))))), up: () => undefined, cancel: () => undefined });
        }}
      />
    </div>
  );
});

/** Master "Mix" header under the audio tracks. */
export function MixHeader() {
  const vol = useEditor((s) => (s.project.activeSequenceId ? s.project.sequences[s.project.activeSequenceId]?.masterVolumeDb ?? 0 : 0));
  const [live, setLive] = useState<number | null>(null);
  return (
    <div className="tl-header tl-mixhdr" style={{ height: 30, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "nowrap" }}>
      <span className="tl-mix-label">Mix</span>
      <HotNumber value={live ?? vol} min={-60} max={6} step={0.1} decimals={1} unit="dB" onChange={setLive}
        onCommit={(v) => {
          setLive(null);
          editor().applySeq("Master Volume", (s) => void (s.masterVolumeDb = v));
        }} />
    </div>
  );
}

export { tracksOfKind };
