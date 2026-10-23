// Overlay drawn above the ruler + tracks: playhead (DOM-driven, no React
// re-render per frame), In/Out shading, snap line, razor hover line, drop
// indicators; plus fixed-position marquee and drag tooltip.
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { editor, useEditor } from "../../store/store";
import { usePlayback } from "../../store/playback";
import { useTimeline, tl } from "./state";

/** Playhead: blue head on the ruler + line through all tracks. Subscribes to the live playhead only here. */
export function Playhead() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let lastT = -1;
    const update = () => {
      const el = ref.current;
      if (!el) return;
      const t = usePlayback.getState().time;
      const st = useEditor.getState();
      const w = tl().viewWidth;
      let x = (t - st.scrollTime) * st.pxPerSec;
      const pb = usePlayback.getState();
      if (t !== lastT && !pb.scrubbing && !tl().preview) {
        // Premiere "page scroll" auto-scrolling during playback / when the playhead leaves the view
        const span = w / st.pxPerSec;
        if (x > w || x < 0) {
          const next = pb.playing === "program" && x > w ? t - span * 0.02 : x < 0 ? Math.max(0, t - span * 0.1) : t - span * 0.5;
          lastT = t;
          editor().setUI({ scrollTime: Math.max(0, next) });
          return;
        }
      }
      lastT = t;
      x = Math.round(x);
      el.style.transform = `translateX(${x}px)`;
      el.style.visibility = x < -12 || x > w + 12 ? "hidden" : "visible";
    };
    const u1 = usePlayback.subscribe(update);
    const u2 = useEditor.subscribe(update);
    const u3 = useTimeline.subscribe(update);
    update();
    return () => {
      u1();
      u2();
      u3();
    };
  }, []);
  return (
    <div ref={ref} className="tl-playhead">
      <div className="tl-playhead-head" />
      <div className="tl-playhead-line" />
    </div>
  );
}

export function Overlay(props: { inPoint?: number; outPoint?: number; rulerH: number; rootRef: React.RefObject<HTMLDivElement | null> }) {
  const pps = useEditor((s) => s.pxPerSec);
  const scrollTime = useEditor((s) => s.scrollTime);
  const snapLine = useTimeline((s) => s.snapLine);
  const hoverCut = useTimeline((s) => s.hoverCut);
  const drop = useTimeline((s) => s.drop);
  const inOutDrag = useTimeline((s) => s.inOutDrag);
  const width = useTimeline((s) => s.viewWidth);
  const ovRef = useRef<HTMLDivElement>(null);
  const X = (t: number) => (t - scrollTime) * pps;
  const inP = inOutDrag ? inOutDrag.inPoint : props.inPoint;
  const outP = inOutDrag ? inOutDrag.outPoint : props.outPoint;

  // geometry of lanes relative to the overlay (for per-track razor lines / drop targets)
  const laneRect = (trackId: string) => {
    const el = props.rootRef.current?.querySelector(`.tl-lane[data-track-id="${trackId}"]`) as HTMLElement | null;
    const ov = ovRef.current?.getBoundingClientRect();
    if (!el || !ov) return null;
    const r = el.getBoundingClientRect();
    return { top: r.top - ov.top, height: r.height };
  };
  const clipRect = (clipId: string) => {
    const el = props.rootRef.current?.querySelector(`.tl-clip[data-clip-id="${clipId}"]`) as HTMLElement | null;
    const ov = ovRef.current?.getBoundingClientRect();
    if (!el || !ov) return null;
    const r = el.getBoundingClientRect();
    return { left: r.left - ov.left, top: r.top - ov.top, width: r.width, height: r.height };
  };

  return (
    <div ref={ovRef} className="tl-overlay">
      {inP !== undefined || outP !== undefined ? (
        <div className="tl-inout-shade" style={{ top: props.rulerH, left: X(inP ?? 0), width: Math.max(0, ((outP ?? scrollTime + width / pps + 1000) - (inP ?? 0)) * pps) }} />
      ) : null}
      {snapLine !== null ? <div className="tl-snapline" style={{ left: X(snapLine) }} /> : null}
      {hoverCut
        ? hoverCut.trackIds === "all"
          ? <div className="tl-razorline" style={{ left: X(hoverCut.time), top: props.rulerH, bottom: 0 }} />
          : hoverCut.trackIds.map((id) => {
              const r = laneRect(id);
              return r ? <div key={id} className="tl-razorline" style={{ left: X(hoverCut.time), top: r.top, height: r.height }} /> : null;
            })
        : null}
      {drop && (drop.kind === "insert" || drop.kind === "overwrite") ? (
        <>
          <div className={"tl-dropline " + drop.kind} style={{ left: X(drop.time), top: props.rulerH, bottom: 0 }} />
          {drop.trackId ? (() => {
            const r = laneRect(drop.trackId);
            return r ? <div className="tl-droprow" style={{ top: r.top, height: r.height, left: X(drop.time) }}>{drop.kind === "insert" ? "Insert ▸" : "Overwrite"}</div> : null;
          })() : null}
        </>
      ) : null}
      {drop?.kind === "transition" && drop.trackId ? (() => {
        const r = laneRect(drop.trackId);
        const w = Math.max(16, pps * 1);
        return r ? <div className="tl-droptrans" style={{ top: r.top, height: r.height, left: X(drop.time) - w / 2, width: w }} /> : null;
      })() : null}
      {drop?.kind === "effect" && drop.clipId ? (() => {
        const r = clipRect(drop.clipId);
        return r ? <div className="tl-dropclip" style={r} /> : null;
      })() : null}
      <Playhead />
    </div>
  );
}

export function FloatingLayer() {
  const marquee = useTimeline((s) => s.marquee);
  const tooltip = useTimeline((s) => s.tooltip);
  return createPortal(
    <>
      {marquee ? (
        <div className="tl-marquee" style={{
          left: Math.min(marquee.x0, marquee.x1), top: Math.min(marquee.y0, marquee.y1),
          width: Math.abs(marquee.x1 - marquee.x0), height: Math.abs(marquee.y1 - marquee.y0),
        }} />
      ) : null}
      {tooltip ? <div className="tl-tooltip" style={{ left: tooltip.x + 14, top: tooltip.y + 16 }}>{tooltip.text}</div> : null}
    </>,
    document.body,
  );
}
