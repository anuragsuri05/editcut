// Shared monitor UI: Premiere-style icons, timecode field, mini time ruler,
// button bar with Button Editor.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { formatTimecode, parseTimecode } from "@shared/time";
import type { MarkerColor } from "@shared/types";
import { keysFor, prettyKey } from "../../commands/registry";
import "./monitors.css";

// ---------------------------------------------------------------- hooks

export function useElementSize<T extends HTMLElement>(): [React.RefObject<T | null>, { w: number; h: number }] {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize((s) => (Math.abs(s.w - r.width) < 0.5 && Math.abs(s.h - r.height) < 0.5 ? s : { w: r.width, h: r.height }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size];
}

// ---------------------------------------------------------------- icons (16px, currentColor)

const S = (p: { children: ReactNode; fill?: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill={p.fill ? "currentColor" : "none"} stroke={p.fill ? "none" : "currentColor"} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    {p.children}
  </svg>
);

export const Icon = {
  addMarker: <S><path d="M4.5 2.5h7v10l-3.5-2.6-3.5 2.6z" /></S>,
  markIn: <S><path d="M9.5 3H6.5v10h3" /></S>,
  markOut: <S><path d="M6.5 3h3v10h-3" /></S>,
  clearIn: <S><path d="M7.5 3H4.5v10h3M9.5 6l4 4M13.5 6l-4 4" /></S>,
  clearOut: <S><path d="M2.5 3h3v10h-3M8.5 6l4 4M12.5 6l-4 4" /></S>,
  clearInOut: <S><path d="M5 3H3v10h2M11 3h2v10h-2M6.5 6l3 4M9.5 6l-3 4" /></S>,
  markClip: <S><path d="M5 3H3v10h2M11 3h2v10h-2" /><rect x="6" y="6" width="4" height="4" fill="currentColor" /></S>,
  goToIn: <S><path d="M10 3H8v10h2" /><path d="M6.5 8H2M4 6 2 8l2 2" /></S>,
  goToOut: <S><path d="M6 3h2v10H6" /><path d="M9.5 8H14M12 6l2 2-2 2" /></S>,
  stepBack: <S fill><path d="M12 3.5v9L5.5 8z" /><rect x="3.5" y="3.5" width="1.6" height="9" /></S>,
  stepForward: <S fill><path d="M4 3.5v9L10.5 8z" /><rect x="10.9" y="3.5" width="1.6" height="9" /></S>,
  play: <S fill><path d="M4.5 2.8v10.4L13 8z" /></S>,
  stop: <S fill><rect x="4" y="4" width="8" height="8" rx="0.5" /></S>,
  shuttleLeft: <S fill><path d="M8 3.5v9L2.5 8zM14 3.5v9L8.5 8z" /></S>,
  shuttleRight: <S fill><path d="M2 3.5v9L7.5 8zM8 3.5v9L13.5 8z" /></S>,
  prevEdit: <S><path d="M12.5 3.5v9M9.5 4 4 8l5.5 4M4 3.5v9" /></S>,
  nextEdit: <S><path d="M3.5 3.5v9M6.5 4 12 8l-5.5 4M12 3.5v9" /></S>,
  prevMarker: <S><path d="M9 4.5h5v6.5L11.5 9 9 11z" /><path d="M6 8H1.5M3.5 6 1.5 8l2 2" /></S>,
  nextMarker: <S><path d="M2 4.5h5v6.5L4.5 9 2 11z" /><path d="M10 8h4.5M12.5 6l2 2-2 2" /></S>,
  playInOut: <S><path d="M3 3H1.5v10H3M13 3h1.5v10H13" /><path d="M5.5 4.5v7L11 8z" fill="currentColor" /></S>,
  playAround: <S><path d="M2 8a6 6 0 0 1 10.5-4" /><path d="M12.8 1.8v2.6h-2.6" /><path d="M6 6v4l3.5-2z" fill="currentColor" /></S>,
  loop: <S><path d="M3 7V6a2 2 0 0 1 2-2h7.5M10.5 2l2 2-2 2M13 9v1a2 2 0 0 1-2 2H3.5M5.5 14l-2-2 2-2" /></S>,
  lift: <S><path d="M2 12.5h4M10 12.5h4" /><path d="M8 11V3.5M5.5 6 8 3.5 10.5 6" /></S>,
  extract: <S><path d="M2 12.5h12" /><path d="M8 10V3M5.5 5.5 8 3l2.5 2.5" /><path d="M5 10l3-0 3 0" /></S>,
  exportFrame: <S><path d="M2.5 5.5h2.2l1-1.8h4.6l1 1.8h2.2v7h-11z" /><circle cx="8" cy="9" r="2.2" /></S>,
  insert: <S><path d="M2 12h4.5M9.5 12H14" /><path d="M8 2.5v6M5.5 6 8 8.5 10.5 6" /><rect x="6.5" y="10.5" width="3" height="3" fill="currentColor" /></S>,
  overwrite: <S><path d="M2 12h12" /><path d="M8 2.5v6M5.5 6 8 8.5 10.5 6" /><rect x="5" y="10.5" width="6" height="3" fill="currentColor" /></S>,
  comparison: <S><rect x="1.5" y="3.5" width="5.5" height="9" /><rect x="9" y="3.5" width="5.5" height="9" /></S>,
  proxies: <S><rect x="2" y="3" width="12" height="9" rx="1" /><path d="M5 12v1.5h6V12M5.5 6h2.5a1.3 1.3 0 0 1 0 2.6H5.5V10.5V6" /></S>,
  safeMargins: <S><rect x="1.5" y="2.5" width="13" height="11" /><rect x="3.5" y="4.5" width="9" height="7" strokeDasharray="1.5 1.5" /></S>,
  multiCamera: <S><rect x="1.5" y="2.5" width="6" height="5" /><rect x="8.5" y="2.5" width="6" height="5" /><rect x="1.5" y="8.5" width="6" height="5" /><rect x="8.5" y="8.5" width="6" height="5" /></S>,
  fxMute: <S><path d="M2.5 12.5 6 3.5h4M4 8h4.5M9.5 7l4 5.5M13.5 7l-4 5.5" /></S>,
  wrench: <S><path d="M10.5 2.2a3.3 3.3 0 0 0-3.9 4.3L2.4 10.7a1.4 1.4 0 0 0 2 2l4.2-4.2a3.3 3.3 0 0 0 4.3-3.9L10.8 6.7 9.3 6.7 9.3 5.2z" /></S>,
  plus: <S><path d="M8 3v10M3 8h10" /></S>,
  dragVideo: <S><rect x="2" y="3" width="12" height="10" rx="1" /><path d="M5 3v10M11 3v10M2 6h3M2 10h3M11 6h3M11 10h3" /></S>,
  dragAudio: <S><path d="M2 8h1.5M4.5 5v6M7 3v10M9.5 5.5v5M12 6.5v3M14 8h.5" /></S>,
  grid: <S><path d="M2 2h4v4H2zM10 2h4v4h-4zM6 6h4v4H6zM2 10h4v4H2zM10 10h4v4h-4z" fill="currentColor" stroke="none" /></S>,
};

// ---------------------------------------------------------------- timecode

/** Blue (or white) Premiere hot-text timecode: drag to scrub, click to type (+N/-N relative frames). */
export function TimecodeField(props: { time: number; fps: number; onChange?: (t: number) => void; onScrubStart?: () => void; onScrubEnd?: () => void; dim?: boolean; title?: string; max?: number }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const drag = useRef<{ x: number; t: number; moved: boolean } | null>(null);
  const tc = formatTimecode(props.time, props.fps);
  if (editing)
    return (
      <input
        className="tc-input"
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => setEditing(false)}
        onFocus={(e) => e.currentTarget.select()}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Escape") return setEditing(false);
          if (e.key !== "Enter") return;
          const s = text.trim();
          let t: number | null = null;
          const rel = /^([+-])\s*(.+)$/.exec(s);
          if (rel) {
            const body = rel[2];
            const delta = /^\d+$/.test(body) ? parseInt(body, 10) / props.fps : parseTimecode(body.replace(/\./g, ":"), props.fps);
            if (delta !== null) t = props.time + (rel[1] === "-" ? -delta : delta);
          } else t = parseTimecode(s, props.fps);
          if (t !== null && !Number.isNaN(t)) props.onChange?.(Math.max(0, Math.min(props.max ?? Infinity, t)));
          setEditing(false);
        }}
      />
    );
  return (
    <span
      className={"tc" + (props.dim ? " dim" : "") + (props.onChange ? " hot" : "")}
      title={props.title}
      onPointerDown={(e) => {
        if (!props.onChange) return;
        e.stopPropagation();
        try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* synthetic */ }
        drag.current = { x: e.clientX, t: props.time, moved: false };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        const dx = e.clientX - d.x;
        if (!d.moved && Math.abs(dx) > 2) {
          d.moved = true;
          props.onScrubStart?.();
        }
        if (d.moved) props.onChange?.(Math.max(0, Math.min(props.max ?? Infinity, d.t + Math.round(dx / 2) / props.fps)));
      }}
      onPointerUp={() => {
        const d = drag.current;
        drag.current = null;
        if (!d) return;
        if (d.moved) props.onScrubEnd?.();
        else {
          setText(tc);
          setEditing(true);
        }
      }}
    >
      {tc}
    </span>
  );
}

// ---------------------------------------------------------------- mini time ruler

export const MARKER_HEX: Record<MarkerColor, string> = {
  green: "#3fae4a", red: "#e5484d", purple: "#a593e0", orange: "#e8962c", yellow: "#e2d43c", white: "#e6e6e6", blue: "#2d8ceb", cyan: "#1dbfa0",
};

function tickStep(pxPerSec: number, fps: number): { major: number; minor: number } {
  const cands = [1 / fps, 2 / fps, 5 / fps, 10 / fps, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800, 3600];
  const major = cands.find((c) => c * pxPerSec >= 70) ?? 3600;
  const minor = cands.slice().reverse().find((c) => c < major && c * pxPerSec >= 8) ?? major;
  return { major, minor };
}

export function MiniRuler(props: {
  duration: number;
  time: number;
  fps: number;
  inPoint?: number;
  outPoint?: number;
  markers?: { time: number; duration?: number; color: MarkerColor }[];
  numbers?: boolean;
  onSeek: (t: number) => void;
  onScrub?: (active: boolean) => void;
  refTime?: number;
  onRefSeek?: (t: number) => void;
}) {
  const [ref, size] = useElementSize<HTMLDivElement>();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [view, setView] = useState<[number, number] | null>(null); // zoomed time range
  const dur = Math.max(props.duration, 1 / props.fps);
  const [v0, v1] = view ? [Math.max(0, view[0]), Math.min(dur, view[1])] : [0, dur];
  const span = Math.max(v1 - v0, 1 / props.fps);
  const H = props.numbers ? 30 : 22;
  const W = size.w;
  const x = (t: number) => ((t - v0) / span) * W;
  const tAt = (px: number) => Math.max(0, Math.min(dur, v0 + (px / Math.max(1, W)) * span));

  useEffect(() => {
    if (view && (view[1] - view[0] >= dur - 1e-6)) setView(null);
  }, [dur, view]);

  useEffect(() => {
    const c = canvas.current;
    if (!c || !W) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(W * dpr);
    c.height = Math.round(H * dpr);
    const ctx = c.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    // in/out shading
    if (props.inPoint !== undefined || props.outPoint !== undefined) {
      const a = x(props.inPoint ?? 0), b = x(props.outPoint ?? dur);
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fillRect(a, 0, Math.max(1, b - a), H);
      ctx.fillStyle = "#c9c9c9";
      if (props.inPoint !== undefined) ctx.fillRect(a, H - 9, 1.5, 9);
      if (props.outPoint !== undefined) ctx.fillRect(b - 1.5, H - 9, 1.5, 9);
    }
    // ticks
    const { major, minor } = tickStep(W / span, props.fps);
    ctx.fillStyle = "#666";
    ctx.font = "9px " + getComputedStyle(document.body).getPropertyValue("--mono");
    for (let t = Math.ceil(v0 / minor) * minor; t <= v1 + 1e-9; t += minor) {
      const isMajor = Math.abs(t / major - Math.round(t / major)) < 1e-6;
      const px = Math.round(x(t)) + 0.5;
      ctx.fillRect(px, isMajor ? 0 : 0, 1, isMajor ? 7 : 4);
      if (isMajor && props.numbers) {
        ctx.fillStyle = "#8a8a8a";
        ctx.fillText(formatTimecode(t, props.fps), px + 3, 16);
        ctx.fillStyle = "#666";
      }
    }
    // markers
    for (const m of props.markers ?? []) {
      const px = x(m.time);
      ctx.fillStyle = MARKER_HEX[m.color] ?? "#3fae4a";
      if (m.duration && m.duration > 0) ctx.fillRect(px, 2, Math.max(2, x(m.time + m.duration) - px), 3);
      ctx.beginPath();
      ctx.moveTo(px - 4, 2);
      ctx.lineTo(px + 4, 2);
      ctx.lineTo(px + 4, 7);
      ctx.lineTo(px, 10);
      ctx.lineTo(px - 4, 7);
      ctx.closePath();
      ctx.fill();
    }
    // reference playhead (comparison view)
    if (props.refTime !== undefined) {
      const px = Math.round(x(props.refTime)) + 0.5;
      ctx.fillStyle = "#e8962c";
      ctx.fillRect(px - 0.5, 0, 1, H);
      ctx.beginPath();
      ctx.moveTo(px - 5, H);
      ctx.lineTo(px + 5, H);
      ctx.lineTo(px, H - 6);
      ctx.fill();
    }
    // playhead
    const px = Math.round(x(props.time)) + 0.5;
    ctx.fillStyle = "#2d8ceb";
    ctx.fillRect(px - 0.5, 0, 1, H);
    ctx.beginPath();
    ctx.moveTo(px - 5, 0);
    ctx.lineTo(px + 5, 0);
    ctx.lineTo(px + 5, 4);
    ctx.lineTo(px, 9);
    ctx.lineTo(px - 5, 4);
    ctx.closePath();
    ctx.fill();
  });

  const drag = useRef<"play" | "ref" | null>(null);
  const navDrag = useRef<{ mode: "l" | "r" | "m"; x: number; v: [number, number] } | null>(null);
  return (
    <div className="mini-ruler-wrap">
      <div
        ref={ref}
        className="mini-ruler"
        style={{ height: H }}
        onPointerDown={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = e.clientX - r.left;
          try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* synthetic */ }
          if (props.refTime !== undefined && props.onRefSeek && Math.abs(px - x(props.refTime)) < 6 && e.clientY - r.top > H / 2) {
            drag.current = "ref";
            props.onRefSeek(tAt(px));
            return;
          }
          drag.current = "play";
          props.onScrub?.(true);
          props.onSeek(Math.round(tAt(px) * props.fps) / props.fps);
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const r = e.currentTarget.getBoundingClientRect();
          const t = Math.round(tAt(e.clientX - r.left) * props.fps) / props.fps;
          if (drag.current === "ref") props.onRefSeek?.(t);
          else props.onSeek(t);
        }}
        onPointerUp={() => {
          if (drag.current === "play") props.onScrub?.(false);
          drag.current = null;
        }}
        onWheel={(e) => {
          if (!e.altKey && !e.ctrlKey && !e.metaKey) return;
          const r = e.currentTarget.getBoundingClientRect();
          const c = tAt(e.clientX - r.left);
          const f = e.deltaY > 0 ? 1.25 : 0.8;
          const ns = Math.min(dur, Math.max(10 / props.fps, span * f));
          const a = Math.max(0, c - ((c - v0) / span) * ns);
          setView([a, Math.min(dur, a + ns)]);
        }}
      >
        <canvas ref={canvas} style={{ width: "100%", height: H, display: "block" }} />
      </div>
      {/* zoom navigator bar */}
      <div
        className="mini-nav"
        onPointerMove={(e) => {
          const d = navDrag.current;
          if (!d || !W) return;
          const dt = ((e.clientX - d.x) / W) * dur;
          let [a, b] = d.v;
          if (d.mode === "l") a = Math.min(b - 10 / props.fps, Math.max(0, a + dt));
          else if (d.mode === "r") b = Math.max(a + 10 / props.fps, Math.min(dur, b + dt));
          else {
            const w = b - a;
            a = Math.max(0, Math.min(dur - w, a + dt));
            b = a + w;
          }
          setView([a, b]);
        }}
        onPointerUp={() => (navDrag.current = null)}
        onDoubleClick={() => setView(null)}
      >
        <div
          className="mini-nav-thumb"
          style={{ left: `${(v0 / dur) * 100}%`, width: `${(span / dur) * 100}%` }}
          onPointerDown={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const mode = e.clientX - r.left < 6 ? "l" : r.right - e.clientX < 6 ? "r" : "m";
            try { (e.currentTarget.parentElement as HTMLElement).setPointerCapture(e.pointerId); } catch { /* synthetic */ }
            navDrag.current = { mode, x: e.clientX, v: [v0, v1] };
          }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- button bar + Button Editor

export interface BtnDef {
  id: string;
  label: string;
  icon: ReactNode;
  run: () => void;
  /** Command id for the tooltip shortcut. */
  cmd?: string;
  shortcut?: string;
  active?: boolean;
}

function tip(b: BtnDef): string {
  const k = b.shortcut ?? (b.cmd ? keysFor(b.cmd).map(prettyKey)[0] : undefined);
  return k ? `${b.label} (${k})` : b.label;
}

const DRAG_MIME = "application/x-editcut-button";

export function ButtonBar(props: { buttons: Record<string, BtnDef>; ids: string[]; onChange: (ids: string[]) => void; defaults: string[]; extraRight?: ReactNode }) {
  const [editor, setEditor] = useState(false);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const plusRef = useRef<HTMLButtonElement>(null);
  const ids = props.ids.filter((id) => props.buttons[id]);
  const indexAt = (clientX: number) => {
    const items = [...(barRef.current?.querySelectorAll<HTMLElement>("[data-btn]") ?? [])];
    let i = items.findIndex((el) => {
      const r = el.getBoundingClientRect();
      return clientX < r.left + r.width / 2;
    });
    if (i < 0) i = items.length;
    return i;
  };
  return (
    <div className="monitor-buttons">
      <div
        ref={barRef}
        className={"monitor-buttons-inner" + (editor ? " editing" : "")}
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          setDropAt(indexAt(e.clientX));
        }}
        onDragLeave={() => setDropAt(null)}
        onDrop={(e) => {
          const raw = e.dataTransfer.getData(DRAG_MIME);
          setDropAt(null);
          if (!raw) return;
          e.preventDefault();
          const { id } = JSON.parse(raw) as { id: string; from: string };
          const at = indexAt(e.clientX);
          const without = ids.filter((x) => x !== id);
          const oldIdx = ids.indexOf(id);
          const insertAt = oldIdx >= 0 && oldIdx < at ? at - 1 : at;
          without.splice(insertAt, 0, id);
          props.onChange(without);
        }}
      >
        {ids.map((id, i) => {
          const b = props.buttons[id];
          return (
            <span key={id} className="mb-slot" data-btn={id}>
              {dropAt === i ? <span className="mb-drop" /> : null}
              <button
                className={"mb" + (b.active ? " active" : "") + (id === "play" ? " mb-play" : "")}
                title={tip(b)}
                draggable={editor}
                onDragStart={(e) => {
                  e.dataTransfer.setData(DRAG_MIME, JSON.stringify({ id, from: "bar" }));
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragEnd={(e) => {
                  // dragged out of the bar → remove
                  if (e.dataTransfer.dropEffect === "none") {
                    const r = barRef.current?.getBoundingClientRect();
                    if (r && (e.clientY < r.top - 10 || e.clientY > r.bottom + 10 || e.clientX < r.left || e.clientX > r.right)) props.onChange(ids.filter((x) => x !== id));
                  }
                }}
                onClick={() => !editor && b.run()}
              >
                {b.icon}
              </button>
            </span>
          );
        })}
        {dropAt === ids.length ? <span className="mb-drop" /> : null}
      </div>
      {props.extraRight}
      <button ref={plusRef} className={"mb mb-plus" + (editor ? " active" : "")} title="Button Editor" onClick={() => setEditor(!editor)}>
        {Icon.plus}
      </button>
      {editor ? (
        <ButtonEditor anchor={plusRef.current} buttons={props.buttons} onClose={() => setEditor(false)} onReset={() => props.onChange(props.defaults)} inBar={ids} onAdd={(id) => !ids.includes(id) && props.onChange([...ids, id])} />
      ) : null}
    </div>
  );
}

function ButtonEditor(props: { anchor: HTMLElement | null; buttons: Record<string, BtnDef>; inBar: string[]; onClose: () => void; onReset: () => void; onAdd: (id: string) => void }) {
  const r = props.anchor?.getBoundingClientRect();
  const left = Math.max(8, Math.min(window.innerWidth - 380, (r?.right ?? 400) - 370));
  const bottom = r ? window.innerHeight - r.top + 8 : 100;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && props.onClose();
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [props]);
  return createPortal(
    <div className="button-editor" style={{ left, bottom }}>
      <div className="be-title">Button Editor</div>
      <div className="be-hint">Drag buttons to the button bar (or click to add). Drag a button off the bar to remove it.</div>
      <div className="be-grid">
        {Object.values(props.buttons).map((b) => (
          <button
            key={b.id}
            className={"mb be-btn" + (props.inBar.includes(b.id) ? " in-bar" : "")}
            title={tip(b)}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData(DRAG_MIME, JSON.stringify({ id: b.id, from: "editor" }));
              e.dataTransfer.effectAllowed = "copyMove";
            }}
            onClick={() => props.onAdd(b.id)}
          >
            {b.icon}
          </button>
        ))}
      </div>
      <div className="be-footer">
        <button className="btn small" onClick={props.onReset}>Reset Layout</button>
        <span className="spacer" />
        <button className="btn small primary" onClick={props.onClose}>OK</button>
      </div>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------- misc

export const ZOOM_OPTIONS = ["fit", 10, 25, 50, 75, 100, 150, 200, 400] as const;

export function SafeMarginsOverlay() {
  return (
    <svg className="safe-margins" viewBox="0 0 100 100" preserveAspectRatio="none">
      <rect x="5" y="5" width="90" height="90" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      <rect x="10" y="10" width="80" height="80" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      <path d="M48 50h4M50 48v4" stroke="rgba(255,255,255,0.55)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function RulersOverlay() {
  return (
    <>
      <div className="mon-ruler mon-ruler-h" />
      <div className="mon-ruler mon-ruler-v" />
    </>
  );
}
