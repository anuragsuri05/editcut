// Direct manipulation in the Program Monitor: bounding box with scale handles,
// rotation outside the corners, anchor-point crosshair, click-to-select the
// topmost clip, double-click a text graphic to edit it inline.
import { useMemo, useRef, useState } from "react";
import type { Clip, MotionProps, Project, Sequence } from "@shared/types";
import { setParamAt } from "@shared/params";
import { expandLinked } from "@shared/ops";
import { usePlayback } from "../../store/playback";
import { useEditor } from "../../store/store";
import { fontString, measureText } from "../../render/graphics";
import {
  affApply, affInv, clipQuad, clipSourceSize, evalMotion, motionMatrix, pointInPoly, trackDrawItem, visualTracks, type MotionValues,
} from "../../engine/timing";

type MotionKey = "positionX" | "positionY" | "scale" | "scaleWidth" | "rotation" | "anchorX" | "anchorY";
type Vals = Partial<Record<MotionKey, number>>;

let measureCtx: CanvasRenderingContext2D | null = null;
const mctx = () => (measureCtx ??= document.createElement("canvas").getContext("2d")!);

/** Content box (source px) of a clip: text/shape extents for graphics, else the whole frame. */
export function contentBox(clip: Clip, srcW: number, srcH: number): { x: number; y: number; w: number; h: number } {
  const g = clip.generator;
  if (g?.kind === "text") {
    const m = measureText(mctx(), g.style);
    const pad = (g.style.background?.padding ?? 0) + (g.style.strokeWidth ?? 0) + 4;
    const w = m.width + pad * 2, h = m.height + pad * 2;
    return { x: srcW / 2 - w / 2, y: srcH / 2 - h / 2, w, h };
  }
  if (g?.kind === "shape") {
    const sw = g.strokeWidth ?? 0;
    return { x: srcW / 2 - g.width / 2 - sw / 2, y: srcH / 2 - g.height / 2 - sw / 2, w: g.width + sw, h: g.height + sw };
  }
  return { x: 0, y: 0, w: srcW, h: srcH };
}

interface Geo {
  clip: Clip;
  v: MotionValues;
  srcW: number;
  srcH: number;
  box: { x: number; y: number; w: number; h: number };
  quad: [number, number][];
}

function clipGeo(project: Project, seq: Sequence, clip: Clip, t: number): Geo | null {
  if (!clip.motion) return null;
  const { w: srcW, h: srcH } = clipSourceSize(project, seq, clip);
  const v = evalMotion(clip.motion, t - clip.start, srcW, srcH, seq.settings.width, seq.settings.height);
  const box = contentBox(clip, srcW, srcH);
  return { clip, v, srcW, srcH, box, quad: clipQuad(v, srcW, srcH, box) };
}

/** Topmost visible clip under a sequence-space point. */
export function hitTest(project: Project, seq: Sequence, t: number, x: number, y: number): Clip | null {
  const tracks = visualTracks(seq).filter((tr) => !tr.muted && !tr.locked).reverse();
  for (const tr of tracks) {
    const item = trackDrawItem(seq, tr, t);
    if (!item) continue;
    const clip = item.kind === "clip" ? item.clip : item.progress < 0.5 ? item.a ?? item.b : item.b ?? item.a;
    if (!clip) continue;
    const g = clipGeo(project, seq, clip, t);
    if (g && pointInPoly(g.quad, x, y)) return clip;
  }
  return null;
}

type Mode = { kind: "move" } | { kind: "scale"; hx: number; hy: number } | { kind: "rotate" } | { kind: "anchor" };

interface Drag {
  mode: Mode;
  clipId: string;
  local: number;
  orig: MotionProps;
  v0: MotionValues;
  p0: [number, number];
  moved: boolean;
  vals: Vals;
}

const HANDLES: [number, number][] = [[0, 0], [0.5, 0], [1, 0], [1, 0.5], [1, 1], [0.5, 1], [0, 1], [0, 0.5]];
const CURSORS = ["nwse-resize", "ns-resize", "nesw-resize", "ew-resize", "nwse-resize", "ns-resize", "nesw-resize", "ew-resize"];

export function TransformOverlay(props: { seq: Sequence; width: number; height: number }) {
  const { seq } = props;
  const project = useEditor((s) => s.project);
  const selection = useEditor((s) => s.selection.clipIds);
  const tool = useEditor((s) => s.tool);
  const time = usePlayback((s) => s.time);
  const playing = usePlayback((s) => s.playing === "program");
  const scale = props.width / seq.settings.width;
  const drag = useRef<Drag | null>(null);
  const [cursor, setCursor] = useState("default");
  const [edit, setEdit] = useState<{ clipId: string; text: string } | null>(null);
  const root = useRef<HTMLDivElement>(null);

  const geo = useMemo(() => {
    if (playing) return null;
    for (const id of selection) {
      const c = seq.clips.find((x) => x.id === id);
      if (!c || !c.motion || c.caption) continue;
      const tr = seq.tracks.find((t) => t.id === c.trackId);
      if (!tr || tr.kind !== "video") continue;
      if (time < c.start - 1e-6 || time >= c.start + c.duration - 1e-6) continue;
      return clipGeo(project, seq, c, time);
    }
    return null;
  }, [project, seq, selection, time, playing]);

  const toSeq = (e: { clientX: number; clientY: number }): [number, number] => {
    const r = root.current!.getBoundingClientRect();
    return [(e.clientX - r.left) / scale, (e.clientY - r.top) / scale];
  };

  const handlePoint = (g: Geo, hx: number, hy: number): [number, number] => {
    const m = motionMatrix(g.v);
    const x0 = Math.max(g.box.x, g.v.cl * g.srcW), x1 = Math.min(g.box.x + g.box.w, g.srcW - g.v.cr * g.srcW);
    const y0 = Math.max(g.box.y, g.v.ct * g.srcH), y1 = Math.min(g.box.y + g.box.h, g.srcH - g.v.cb * g.srcH);
    return affApply(m, x0 + (x1 - x0) * hx, y0 + (y1 - y0) * hy);
  };

  const modeAt = (g: Geo, p: [number, number]): Mode | null => {
    const tol = 7 / scale;
    if (Math.hypot(p[0] - g.v.x, p[1] - g.v.y) < 5 / scale) return { kind: "anchor" };
    for (const [hx, hy] of HANDLES) {
      const hp = handlePoint(g, hx, hy);
      if (Math.hypot(p[0] - hp[0], p[1] - hp[1]) < tol) return { kind: "scale", hx, hy };
    }
    if (pointInPoly(g.quad, p[0], p[1])) return { kind: "move" };
    for (const [hx, hy] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
      const hp = handlePoint(g, hx, hy);
      if (Math.hypot(p[0] - hp[0], p[1] - hp[1]) < 24 / scale) return { kind: "rotate" };
    }
    return null;
  };

  const cursorFor = (m: Mode | null, g: Geo | null) => {
    if (!m) return "default";
    if (m.kind === "move") return "move";
    if (m.kind === "anchor") return "crosshair";
    if (m.kind === "rotate") return "alias";
    const idx = HANDLES.findIndex(([x, y]) => x === m.hx && y === m.hy);
    // rotate the cursor set with the clip
    const steps = Math.round((((g?.v.rot ?? 0) % 180) + 180) / 45) % 4;
    return CURSORS[(idx + steps * 2) % 8];
  };

  const computeVals = (d: Drag, p: [number, number], shift: boolean): Vals => {
    const v0 = d.v0;
    const m = d.mode;
    if (m.kind === "move") return { positionX: v0.x + p[0] - d.p0[0], positionY: v0.y + p[1] - d.p0[1] };
    if (m.kind === "rotate") {
      const a0 = Math.atan2(d.p0[1] - v0.y, d.p0[0] - v0.x);
      const a1 = Math.atan2(p[1] - v0.y, p[0] - v0.x);
      let rot = v0.rot + ((a1 - a0) * 180) / Math.PI;
      if (shift) rot = Math.round(rot / 15) * 15;
      return { rotation: Math.round(rot * 100) / 100 };
    }
    if (m.kind === "anchor") {
      const inv = affInv(motionMatrix(v0));
      const [ax, ay] = affApply(inv, p[0], p[1]);
      return { anchorX: ax, anchorY: ay, positionX: p[0], positionY: p[1] };
    }
    // scale about the anchor, in the clip's local (unrotated) frame
    const g = geo!;
    const x0 = Math.max(g.box.x, v0.cl * g.srcW), x1 = Math.min(g.box.x + g.box.w, g.srcW - v0.cr * g.srcW);
    const y0 = Math.max(g.box.y, v0.ct * g.srcH), y1 = Math.min(g.box.y + g.box.h, g.srcH - v0.cb * g.srcH);
    const hs: [number, number] = [x0 + (x1 - x0) * m.hx - v0.ax, y0 + (y1 - y0) * m.hy - v0.ay];
    const r = (-v0.rot * Math.PI) / 180;
    const dx = p[0] - v0.x, dy = p[1] - v0.y;
    const L: [number, number] = [dx * Math.cos(r) - dy * Math.sin(r), dx * Math.sin(r) + dy * Math.cos(r)];
    const uniform = d.orig.uniformScale;
    const useX = m.hx !== 0.5 && Math.abs(hs[0]) > 1e-3;
    const useY = m.hy !== 0.5 && Math.abs(hs[1]) > 1e-3;
    const round = (n: number) => Math.max(0, Math.round(n * 10) / 10);
    if (uniform) {
      const h0: [number, number] = [hs[0] * v0.sx, hs[1] * v0.sy];
      let f = 1;
      if (useX && useY) f = (L[0] * h0[0] + L[1] * h0[1]) / Math.max(1e-6, h0[0] * h0[0] + h0[1] * h0[1]);
      else if (useX) f = L[0] / h0[0];
      else if (useY) f = L[1] / h0[1];
      return { scale: round(v0.sy * 100 * f) };
    }
    const out: Vals = {};
    if (useX) out.scaleWidth = round((L[0] / hs[0]) * 100);
    if (useY) out.scale = round((L[1] / hs[1]) * 100);
    if (shift && useX && useY) {
      const f = ((out.scale ?? v0.sy * 100) / (v0.sy * 100 || 1));
      out.scaleWidth = round(v0.sx * 100 * f);
    }
    return out;
  };

  const writeVals = (motion: MotionProps, local: number, vals: Vals) => {
    for (const [k, v] of Object.entries(vals) as [MotionKey, number][]) setParamAt(motion[k], local, v);
  };

  const livePatch = (d: Drag) => {
    useEditor.getState().patch((proj) => {
      const s = proj.sequences[seq.id];
      const c = s?.clips.find((x) => x.id === d.clipId);
      if (!c?.motion) return;
      c.motion = JSON.parse(JSON.stringify(d.orig));
      writeVals(c.motion!, d.local, d.vals);
    });
  };

  const commit = (d: Drag) => {
    const ed = useEditor.getState();
    ed.patch((proj) => {
      const c = proj.sequences[seq.id]?.clips.find((x) => x.id === d.clipId);
      if (c) c.motion = JSON.parse(JSON.stringify(d.orig));
    });
    const label = d.mode.kind === "move" ? "Position" : d.mode.kind === "rotate" ? "Rotation" : d.mode.kind === "anchor" ? "Anchor Point" : "Scale";
    ed.apply(label, (proj) => {
      const c = proj.sequences[seq.id]?.clips.find((x) => x.id === d.clipId);
      if (c?.motion) writeVals(c.motion, d.local, d.vals);
    });
  };

  const begin = (e: React.PointerEvent, g: Geo, mode: Mode) => {
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* synthetic */ }
    drag.current = {
      mode, clipId: g.clip.id, local: time - g.clip.start, orig: JSON.parse(JSON.stringify(g.clip.motion)), v0: g.v, p0: toSeq(e), moved: false, vals: {},
    };
  };

  const editing = edit ? seq.clips.find((c) => c.id === edit.clipId) : undefined;
  const editGeo = editing ? clipGeo(project, seq, editing, time) : null;

  const S = (pt: [number, number]) => `${pt[0] * scale},${pt[1] * scale}`;
  const active = tool === "select";

  return (
    <div
      ref={root}
      className="transform-overlay"
      style={{ width: props.width, height: props.height, cursor }}
      onPointerDown={(e) => {
        if (e.button !== 0 || !active || playing) return;
        const p = toSeq(e);
        const ed = useEditor.getState();
        if (geo) {
          const m = modeAt(geo, p);
          if (m) return begin(e, geo, m);
        }
        const hit = hitTest(ed.project, seq, time, p[0], p[1]);
        if (!hit) {
          if (ed.selection.clipIds.length) ed.select({ clipIds: [] });
          return;
        }
        const ids = ed.linkedSelection ? expandLinked(seq, [hit.id]) : [hit.id];
        ed.select({ clipIds: ids });
        const g = clipGeo(ed.project, seq, hit, time);
        if (g) begin(e, g, { kind: "move" });
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        const p = toSeq(e);
        if (!d) {
          if (geo) setCursor(cursorFor(modeAt(geo, p), geo));
          else if (cursor !== "default") setCursor("default");
          return;
        }
        if (!d.moved && Math.hypot(p[0] - d.p0[0], p[1] - d.p0[1]) * scale < 2) return;
        d.moved = true;
        d.vals = computeVals(d, p, e.shiftKey);
        livePatch(d);
      }}
      onPointerUp={() => {
        const d = drag.current;
        drag.current = null;
        if (d?.moved) commit(d);
      }}
      onDoubleClick={(e) => {
        const p = toSeq(e);
        const hit = hitTest(useEditor.getState().project, seq, time, p[0], p[1]);
        if (hit?.generator?.kind === "text") {
          useEditor.getState().select({ clipIds: [hit.id] });
          setEdit({ clipId: hit.id, text: hit.generator.style.text });
        }
      }}
    >
      {geo && !edit ? (
        <svg className="transform-svg" width={props.width} height={props.height}>
          <polygon points={geo.quad.map(S).join(" ")} fill="none" stroke="#fff" strokeWidth="1" />
          <polygon points={geo.quad.map(S).join(" ")} fill="none" stroke="#2d8ceb" strokeWidth="1" strokeDasharray="4 3" />
          {HANDLES.map(([hx, hy], i) => {
            const hp = handlePoint(geo, hx, hy);
            return <rect key={i} x={hp[0] * scale - 3.5} y={hp[1] * scale - 3.5} width="7" height="7" fill="#fff" stroke="#2d8ceb" strokeWidth="1" />;
          })}
          <g transform={`translate(${geo.v.x * scale},${geo.v.y * scale})`}>
            <circle r="5" fill="none" stroke="#fff" strokeWidth="1.2" />
            <path d="M-9 0H9M0 -9V9" stroke="#fff" strokeWidth="1.2" />
          </g>
        </svg>
      ) : null}
      {edit && editing?.generator?.kind === "text" && editGeo ? (
        <TextEditBox
          geo={editGeo}
          scale={scale}
          text={edit.text}
          onChange={(text) => setEdit({ ...edit, text })}
          onDone={(commitIt) => {
            const txt = edit.text;
            setEdit(null);
            if (!commitIt || txt === (editing.generator as { style: { text: string } }).style.text) return;
            useEditor.getState().applySeq("Edit Text", (s) => {
              const c = s.clips.find((x) => x.id === edit.clipId);
              if (c?.generator?.kind === "text") c.generator.style.text = txt;
            });
          }}
        />
      ) : null}
    </div>
  );
}

function TextEditBox(props: { geo: Geo; scale: number; text: string; onChange: (t: string) => void; onDone: (commit: boolean) => void }) {
  const { geo, scale } = props;
  const g = geo.clip.generator;
  if (g?.kind !== "text") return null;
  const xs = geo.quad.map((p) => p[0] * scale), ys = geo.quad.map((p) => p[1] * scale);
  const left = Math.min(...xs), top = Math.min(...ys);
  const w = Math.max(...xs) - left, h = Math.max(...ys) - top;
  const fs = g.style.fontSize * scale * Math.abs(geo.v.sy);
  return (
    <textarea
      className="text-edit-box"
      autoFocus
      value={props.text}
      style={{
        left, top, width: Math.max(80, w + 20), height: Math.max(fs * g.style.lineHeight + 8, h),
        font: fontString({ ...g.style, fontSize: fs }), color: g.style.color, textAlign: g.style.align, lineHeight: g.style.lineHeight,
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onChange={(e) => props.onChange(e.target.value)}
      onBlur={() => props.onDone(true)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") props.onDone(false);
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) props.onDone(true);
      }}
    />
  );
}
