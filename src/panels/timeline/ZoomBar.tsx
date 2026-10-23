// Premiere-style horizontal scroll bar whose ends are zoom handles.
import { useRef } from "react";
import { sequenceDuration } from "@shared/ops";
import type { Sequence } from "@shared/types";
import { editor, useEditor } from "../../store/store";
import { beginDrag } from "./interact";
import { useTimeline } from "./state";
import { maxPps, MIN_PPS } from "./view";

export function ZoomBar({ seq }: { seq: Sequence }) {
  const pps = useEditor((s) => s.pxPerSec);
  const scrollTime = useEditor((s) => s.scrollTime);
  const viewWidth = useTimeline((s) => s.viewWidth);
  const ref = useRef<HTMLDivElement>(null);
  const span = viewWidth / pps;
  const total = Math.max(sequenceDuration(seq) * 1.15 + 5, scrollTime + span);
  const W = ref.current?.clientWidth ?? viewWidth;
  const left = (scrollTime / total) * W;
  const width = Math.max(24, (span / total) * W);

  const drag = (e: React.PointerEvent, part: "thumb" | "l" | "r") => {
    e.stopPropagation();
    if (e.button !== 0) return;
    const s0 = scrollTime, span0 = span, x0 = e.clientX, tot = total, w = ref.current?.clientWidth ?? viewWidth;
    beginDrag(e, {
      threshold: 0,
      cursor: part === "thumb" ? "grabbing" : "ew-resize",
      move: (ev) => {
        const dt = ((ev.clientX - x0) / w) * tot;
        if (part === "thumb") return editor().setUI({ scrollTime: Math.max(0, s0 + dt) });
        const a = part === "l" ? Math.max(0, Math.min(s0 + dt, s0 + span0 - 0.05)) : s0;
        const b = part === "r" ? Math.max(s0 + 0.05, s0 + span0 + dt) : s0 + span0;
        const np = Math.min(maxPps(), Math.max(MIN_PPS, viewWidth / (b - a)));
        editor().setUI({ pxPerSec: np, scrollTime: part === "l" ? Math.max(0, b - viewWidth / np) : a });
      },
      up: () => undefined,
      cancel: () => undefined,
    });
  };

  return (
    <div
      ref={ref}
      className="tl-zoombar"
      onPointerDown={(e) => {
        const r = ref.current!.getBoundingClientRect();
        const t = ((e.clientX - r.left) / r.width) * total;
        editor().setUI({ scrollTime: Math.max(0, t - span / 2) });
      }}
    >
      <div className="tl-zoombar-thumb" style={{ left, width }} onPointerDown={(e) => drag(e, "thumb")}>
        <div className="tl-zoombar-handle l" onPointerDown={(e) => drag(e, "l")} />
        <div className="tl-zoombar-handle r" onPointerDown={(e) => drag(e, "r")} />
      </div>
    </div>
  );
}
