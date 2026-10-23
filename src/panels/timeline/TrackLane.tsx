// One track's clip lane: culls clips to the visible range, draws transitions,
// through-edit bowties, selected edit points and lock stripes.
import { memo } from "react";
import type { Clip, ID, MediaAsset, Track, Transition } from "@shared/types";
import { clipEnd, transitionSpan } from "@shared/ops";
import { TRANSITION_MAP } from "@shared/effects";
import { useEditor } from "../../store/store";
import { ClipView } from "./ClipView";
import { onClipPointerDown, onLanePointerDown, onTransitionPointerDown, razorTime, timeAt } from "./interact";
import { gapContextMenu, transitionContextMenu } from "./menus";
import { useTimeline, tl, type DisplaySettings } from "./state";
import { getActiveSequence } from "../../store/store";

export interface LaneProps {
  track: Track;
  clips: Clip[];
  transitions: Transition[];
  height: number;
  selected: Set<ID>;
  media: Record<ID, MediaAsset>;
  sequenceIds: Set<ID>;
  syncOffsets: Map<ID, number>;
  duplicates: Set<ID>;
  throughEdits: number[];
  fps: number;
  display: DisplaySettings;
  tool: string;
  selectedTransitionId: ID | null;
  onClipContextMenu: (e: React.MouseEvent, clip: Clip) => void;
  onClipDoubleClick: (clip: Clip) => void;
}

const QUANT = 512;

export const TrackLane = memo(function TrackLane(p: LaneProps) {
  const pps = useEditor((s) => s.pxPerSec);
  const scrollTime = useEditor((s) => s.scrollTime);
  const viewWidth = useTimeline((s) => s.viewWidth);
  const edits = useTimeline((s) => s.selectedEdits);
  const gap = useTimeline((s) => (s.selectedGap?.trackId === p.track.id ? s.selectedGap : null));
  const q = QUANT / pps;
  const vt0 = Math.floor(scrollTime / q) * q - q;
  const vt1 = vt0 + viewWidth / pps + 3 * q;
  const t0 = scrollTime - 200 / pps, t1 = scrollTime + (viewWidth + 200) / pps;
  const visible = p.clips.filter((c) => clipEnd(c) >= t0 && c.start <= t1);
  const { track } = p;
  const editMarks = edits.map((e) => ({ e, c: p.clips.find((c) => c.id === e.clipId) })).filter((x) => x.c);
  let gapRange: [number, number] | null = null;
  if (gap) {
    const before = p.clips.filter((c) => clipEnd(c) <= gap.time + 1e-6).pop();
    const after = p.clips.find((c) => c.start >= gap.time - 1e-6);
    if (after) gapRange = [before ? clipEnd(before) : 0, after.start];
  }
  return (
    <div
      className={"tl-lane " + track.kind + (track.locked ? " locked" : "") + (track.targeted ? " targeted" : "") + (track.muted ? " muted" : "")}
      style={{ height: p.height }}
      data-track-id={track.id}
      onPointerDown={(e) => onLanePointerDown(e, track.id)}
      onPointerMove={(e) => {
        if (p.tool !== "razor") return;
        if ((e.target as HTMLElement).closest(".tl-clip")) return;
        const seq = getActiveSequence();
        if (seq && e.shiftKey) tl().set({ hoverCut: { time: razorTime(seq, e.clientX), trackIds: "all" } });
        else if (tl().hoverCut) tl().set({ hoverCut: null });
      }}
      onPointerLeave={() => tl().hoverCut && tl().set({ hoverCut: null })}
      onContextMenu={(e) => {
        if ((e.target as HTMLElement).closest(".tl-clip, .tl-transition")) return;
        gapContextMenu(e, track.id, timeAt(e.clientX));
      }}
    >
      <div className="tl-lane-inner" style={{ transform: `translateX(${-scrollTime * pps}px)` }}>
        {gapRange ? <div className="tl-gap-sel" style={{ left: gapRange[0] * pps, width: (gapRange[1] - gapRange[0]) * pps }} /> : null}
        {visible.map((c) => {
          const asset = c.assetId ? p.media[c.assetId] : undefined;
          return (
            <ClipView
              key={c.id}
              clip={c}
              kind={track.kind}
              height={p.height}
              pps={pps}
              selected={p.selected.has(c.id)}
              asset={asset}
              offline={!!c.assetId && (!asset || asset.status === "error")}
              nestedMissing={!!c.sequenceId && !p.sequenceIds.has(c.sequenceId)}
              syncOffset={p.syncOffsets.get(c.id)}
              duplicate={p.display.duplicateFrames && p.duplicates.has(c.id)}
              fps={p.fps}
              vt0={vt0}
              vt1={vt1}
              showThumbs={p.display.thumbnails}
              showWave={p.display.waveforms}
              showKeyframes={p.display.keyframes}
              showMarkers={p.display.clipMarkers}
              showNames={p.display.clipNames}
              showFx={p.display.fxBadges}
              tool={p.tool}
              onContextMenu={p.onClipContextMenu}
              onDoubleClick={p.onClipDoubleClick}
            />
          );
        })}
        {p.transitions.map((tr) => {
          const [a, b] = transitionSpan(tr);
          if (b < t0 || a > t1) return null;
          const w = Math.max(4, (b - a) * pps);
          const def = TRANSITION_MAP[tr.type];
          return (
            <div
              key={tr.id}
              className={"tl-transition" + (p.selectedTransitionId === tr.id ? " selected" : "")}
              style={{ left: a * pps, width: w, height: p.height }}
              title={`${def?.name ?? tr.type} — ${tr.duration.toFixed(2)}s`}
              onPointerDown={(e) => {
                const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                const x = e.clientX - r.left;
                // the edge that sits on the cut belongs to the clip (trim it), the far edge resizes the transition
                // trim tools grab the edit under the transition (left of the cut = outgoing clip's Out, right = incoming In)
                if (p.tool === "ripple" || p.tool === "roll" || p.tool === "rateStretch") {
                  const cutX = (tr.at - a) * pps;
                  const id = x < cutX ? tr.clipAId : tr.clipBId;
                  if (id) return onClipPointerDown(e, id, x < cutX ? "out" : "in");
                }
                if (tr.alignment === "end" && tr.clipAId && x > r.width - 6) return onClipPointerDown(e, tr.clipAId, "out");
                if (tr.alignment === "start" && tr.clipBId && x < 6) return onClipPointerDown(e, tr.clipBId, "in");
                onTransitionPointerDown(e, tr.id, x < 5 ? "left" : x > r.width - 5 ? "right" : "body");
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                useEditor.getState().openDialog("timeline.transitionDuration", { transitionId: tr.id });
              }}
              onContextMenu={(e) => transitionContextMenu(e, tr.id)}
            >
              {w > 40 ? <span>{def?.name ?? tr.type}</span> : null}
            </div>
          );
        })}
        {p.display.throughEdits
          ? p.throughEdits.filter((t) => t >= t0 && t <= t1).map((t) => <div key={t} className="tl-through" style={{ left: t * pps }} title="Through edit" />)
          : null}
        {editMarks.map(({ e, c }) => (
          <div key={e.clipId + e.edge} className={"tl-editpoint " + e.edge} style={{ left: (e.edge === "in" ? c!.start : clipEnd(c!)) * pps, height: p.height }} />
        ))}
      </div>
    </div>
  );
});
