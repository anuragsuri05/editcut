// Time ruler: adaptive ticks/timecode labels, scrubbing, In/Out range with
// handles, sequence markers (drag/edit), and the render bar.
import { useEffect, useMemo, useRef } from "react";
import type { Sequence } from "@shared/types";
import { formatTimecode, snapToFrame } from "@shared/time";
import { editor, useEditor } from "../../store/store";
import { playback, usePlayback } from "../../store/playback";
import { beginDrag, snapOffset, snapPoints, timeAt } from "./interact";
import { markerContextMenu, rulerContextMenu } from "./menus";
import { renderSegments } from "./ops-extra";
import { tl, useTimeline } from "./state";
import { rulerSteps } from "./view";
import { MARKER_COLORS } from "./dialogs";

const RULER_H = 36;

export function Ruler({ seq }: { seq: Sequence }) {
  const pps = useEditor((s) => s.pxPerSec);
  const scrollTime = useEditor((s) => s.scrollTime);
  const width = useTimeline((s) => s.viewWidth);
  const rendered = useTimeline((s) => s.rendered);
  const markerDrag = useTimeline((s) => s.markerDrag);
  const inOutDrag = useTimeline((s) => s.inOutDrag);
  const selectedMarkerId = useTimeline((s) => s.selectedMarkerId);
  const canvas = useRef<HTMLCanvasElement>(null);
  const fps = seq.settings.fps;

  useEffect(() => {
    const cv = canvas.current;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = Math.max(1, width * dpr);
    cv.height = 24 * dpr;
    const g = cv.getContext("2d")!;
    g.scale(dpr, dpr);
    g.clearRect(0, 0, width, 24);
    const { major, minor } = rulerSteps(pps, fps);
    const tEnd = scrollTime + width / pps;
    g.strokeStyle = "#5a5a5a";
    g.lineWidth = 1;
    g.beginPath();
    const m0 = Math.floor(scrollTime / minor);
    for (let i = m0; i * minor <= tEnd; i++) {
      const x = Math.round((i * minor - scrollTime) * pps) + 0.5;
      g.moveTo(x, 24);
      g.lineTo(x, 19);
    }
    g.stroke();
    g.strokeStyle = "#8a8a8a";
    g.fillStyle = "#a8a8a8";
    g.font = "10px " + getComputedStyle(document.body).getPropertyValue("--mono");
    g.beginPath();
    const j0 = Math.floor(scrollTime / major);
    for (let j = j0; j * major <= tEnd + major; j++) {
      const t = j * major;
      const x = Math.round((t - scrollTime) * pps) + 0.5;
      g.moveTo(x, 24);
      g.lineTo(x, 12);
      g.fillText(formatTimecode(t, fps), x + 3, 10);
    }
    g.stroke();
  }, [pps, scrollTime, width, fps]);

  const segs = useMemo(() => renderSegments(seq, rendered), [seq, rendered]);
  const X = (t: number) => (t - scrollTime) * pps;
  const inP = inOutDrag ? inOutDrag.inPoint : seq.inPoint;
  const outP = inOutDrag ? inOutDrag.outPoint : seq.outPoint;

  const scrub = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const pts = snapPoints(seq, new Set());
    const to = (clientX: number, shift: boolean) => {
      let t = snapToFrame(timeAt(clientX), fps);
      if (shift || editor().snapping) {
        const [adj] = snapOffset([t], pts.slice(1), 6);
        t += adj;
      }
      playback().setTime(t);
    };
    usePlayback.getState().set({ scrubbing: true });
    if (playback().playing) playback().stop();
    to(e.clientX, e.shiftKey);
    editor().setUI({ focusedMonitor: "program" });
    beginDrag(e, {
      threshold: 0,
      move: (ev) => to(ev.clientX, ev.shiftKey),
      up: () => usePlayback.getState().set({ scrubbing: false }),
      cancel: () => usePlayback.getState().set({ scrubbing: false }),
    });
  };

  const dragInOut = (e: React.PointerEvent, which: "in" | "out" | "both") => {
    e.stopPropagation();
    if (e.button !== 0) return;
    const a0 = seq.inPoint, b0 = seq.outPoint;
    const t0 = timeAt(e.clientX);
    const pts = snapPoints(seq, new Set());
    beginDrag(e, {
      cursor: which === "both" ? "grab" : "ew-resize",
      threshold: 1,
      move: (ev) => {
        let d = snapToFrame(timeAt(ev.clientX) - t0, fps);
        const ref = which === "out" ? b0 ?? 0 : a0 ?? 0;
        const [adj] = snapOffset([ref + d], pts, 6);
        d += adj;
        const io = { inPoint: a0, outPoint: b0 };
        if (which !== "out" && a0 !== undefined) io.inPoint = Math.max(0, a0 + d);
        if (which !== "in" && b0 !== undefined) io.outPoint = Math.max(0, b0 + d);
        if (io.inPoint !== undefined && io.outPoint !== undefined && io.outPoint < io.inPoint) return;
        tl().set({ inOutDrag: io });
      },
      up: (_ev, moved) => {
        const io = tl().inOutDrag;
        tl().set({ inOutDrag: null });
        if (!moved || !io) return;
        editor().applySeq(which === "in" ? "Mark In" : which === "out" ? "Mark Out" : "Move In/Out", (s) => {
          s.inPoint = io.inPoint;
          s.outPoint = io.outPoint;
        });
      },
      cancel: () => tl().set({ inOutDrag: null }),
    });
  };

  const dragMarker = (e: React.PointerEvent, id: string, time: number) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    if (e.altKey) {
      editor().applySeq("Clear Marker", (s) => void (s.markers = s.markers.filter((m) => m.id !== id)));
      return;
    }
    tl().set({ selectedMarkerId: id });
    const t0 = timeAt(e.clientX);
    const pts = snapPoints(seq, new Set()).filter((p) => Math.abs(p - time) > 1e-6);
    beginDrag(e, {
      cursor: "ew-resize",
      move: (ev) => {
        let nt = snapToFrame(Math.max(0, time + timeAt(ev.clientX) - t0), fps);
        const [adj] = snapOffset([nt], pts, 6);
        nt += adj;
        tl().set({ markerDrag: { id, time: nt } });
      },
      up: (_ev, moved) => {
        const md = tl().markerDrag;
        tl().set({ markerDrag: null });
        if (!moved) {
          playback().setTime(time);
          return;
        }
        if (md) editor().applySeq("Move Marker", (s) => {
          const m = s.markers.find((x) => x.id === id);
          if (m) m.time = md.time;
          s.markers.sort((a, b) => a.time - b.time);
        });
      },
      cancel: () => tl().set({ markerDrag: null }),
    });
  };

  return (
    <div className="tl-ruler" style={{ height: RULER_H }} onPointerDown={scrub} onContextMenu={(e) => rulerContextMenu(e)}>
      <canvas ref={canvas} className="tl-ruler-canvas" style={{ width, height: 24 }} />
      {inP !== undefined || outP !== undefined ? (
        <div
          className="tl-inout"
          style={{ left: X(inP ?? 0), width: Math.max(1, ((outP ?? scrollTime + width / pps + 1000) - (inP ?? 0)) * pps) }}
          onPointerDown={(e) => (inP !== undefined && outP !== undefined ? dragInOut(e, "both") : undefined)}
          title={`In ${inP !== undefined ? formatTimecode(inP, fps) : "—"}  Out ${outP !== undefined ? formatTimecode(outP, fps) : "—"}`}
        >
          {inP !== undefined ? <div className="tl-in-handle" onPointerDown={(e) => dragInOut(e, "in")} /> : null}
          {outP !== undefined ? <div className="tl-out-handle" onPointerDown={(e) => dragInOut(e, "out")} /> : null}
        </div>
      ) : null}
      {seq.markers.map((m) => {
        const t = markerDrag?.id === m.id ? markerDrag.time : m.time;
        const x = X(t);
        if (x < -40 || x > width + 40) return null;
        return (
          <div
            key={m.id}
            className={"tl-marker" + (selectedMarkerId === m.id ? " selected" : "")}
            style={{ left: x, ["--mk" as string]: MARKER_COLORS[m.color], width: m.duration > 0 ? Math.max(10, m.duration * pps) : undefined }}
            title={`${m.name || "Marker"}${m.comment ? `\n${m.comment}` : ""}\n${formatTimecode(m.time, fps)}`}
            onPointerDown={(e) => dragMarker(e, m.id, m.time)}
            onDoubleClick={(e) => {
              e.stopPropagation();
              editor().openDialog("timeline.marker", { markerId: m.id });
            }}
            onContextMenu={(e) => markerContextMenu(e, m.id)}
          />
        );
      })}
      <div className="tl-renderbar">
        {segs.map((s) => {
          const a = X(s.start), b = X(s.end);
          if (b < 0 || a > width) return null;
          return <div key={s.key + s.start} className={"tl-render " + s.color} style={{ left: a, width: Math.max(1, b - a) }} />;
        })}
      </div>
    </div>
  );
}
