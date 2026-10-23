// Small reusable controls for the inspector panels (Premiere look).
import { useRef, useState, type ReactNode } from "react";
import type { BlendMode } from "@shared/types";

// ---------------------------------------------------------------- icons
export function StopwatchIcon(props: { on: boolean }) {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden>
      <circle cx="8" cy="9" r="5.6" fill={props.on ? "#2d8ceb" : "none"} stroke={props.on ? "#2d8ceb" : "currentColor"} strokeWidth="1.4" />
      <rect x="6.5" y="1" width="3" height="2" rx="0.6" fill="currentColor" />
      <path d="M8 9 L8 5.6" stroke={props.on ? "#fff" : "currentColor"} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function ResetIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden>
      <path d="M3.5 8a4.5 4.5 0 1 0 1.4-3.3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M2.5 2.5 L3.2 5.6 L6.3 4.9" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function EllipseMaskIcon() {
  return <svg width="14" height="14" viewBox="0 0 16 16"><ellipse cx="8" cy="8" rx="6" ry="4.5" fill="none" stroke="currentColor" strokeWidth="1.4" /></svg>;
}
export function RectMaskIcon() {
  return <svg width="14" height="14" viewBox="0 0 16 16"><rect x="2.5" y="3.5" width="11" height="9" fill="none" stroke="currentColor" strokeWidth="1.4" /></svg>;
}
export function PenMaskIcon() {
  return <svg width="14" height="14" viewBox="0 0 16 16"><path d="M3 13 L5 7 L11 2 L14 5 L9 11 Z M5 7 L9 11" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>;
}

/** Keyframe glyph shaped by interpolation like Premiere (diamond, hourglass, square, half-curves). */
export function KeyframeGlyph(props: { interp: string; selected?: boolean; size?: number }) {
  const s = props.size ?? 10;
  const fill = props.selected ? "#2d8ceb" : "#c8c8c8";
  const stroke = props.selected ? "#bfe0ff" : "#1a1a1a";
  let d: string;
  switch (props.interp) {
    case "hold": d = "M1 1 H9 V9 H1 Z"; break;
    case "bezier": case "easeInOut": d = "M1 1 L5 5 L1 9 Z M9 1 L5 5 L9 9 Z"; break; // hourglass
    case "easeIn": d = "M5 0.5 L9.5 5 L5 9.5 Q2 5 5 0.5 Z"; break;
    case "easeOut": d = "M5 0.5 L0.5 5 L5 9.5 Q8 5 5 0.5 Z"; break;
    default: d = "M5 0.5 L9.5 5 L5 9.5 L0.5 5 Z";
  }
  return (
    <svg width={s} height={s} viewBox="0 0 10 10" style={{ display: "block" }}>
      <path d={d} fill={fill} stroke={stroke} strokeWidth="0.8" />
    </svg>
  );
}

// ---------------------------------------------------------------- param-row controls
export function Stopwatch(props: { on: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button className={"ec-stopwatch" + (props.on ? " on" : "")} disabled={props.disabled} title="Toggle animation" onClick={props.onClick}>
      <StopwatchIcon on={props.on} />
    </button>
  );
}

export function KeyframeNav(props: { onPrev: () => void; onToggle: () => void; onNext: () => void; onKey: boolean; hasPrev: boolean; hasNext: boolean }) {
  return (
    <span className="ec-kfnav">
      <button disabled={!props.hasPrev} title="Go to Previous Keyframe" onClick={props.onPrev}>◀</button>
      <button className={props.onKey ? "on" : ""} title="Add/Remove Keyframe" onClick={props.onToggle}>
        <svg width="9" height="9" viewBox="0 0 10 10"><path d="M5 0.5 L9.5 5 L5 9.5 L0.5 5 Z" fill={props.onKey ? "#2d8ceb" : "none"} stroke="currentColor" strokeWidth="1.1" /></svg>
      </button>
      <button disabled={!props.hasNext} title="Go to Next Keyframe" onClick={props.onNext}>▶</button>
    </span>
  );
}

export function ResetButton(props: { onClick: () => void; title?: string; disabled?: boolean }) {
  return (
    <button className="ec-reset" disabled={props.disabled} title={props.title ?? "Reset Parameter"} onClick={props.onClick}>
      <ResetIcon />
    </button>
  );
}

// ---------------------------------------------------------------- blend modes
export const BLEND_GROUPS: { group: string; modes: { value: BlendMode; label: string }[] }[] = [
  { group: "Normal", modes: [{ value: "normal", label: "Normal" }] },
  { group: "Darken", modes: [{ value: "darken", label: "Darken" }, { value: "multiply", label: "Multiply" }, { value: "colorBurn", label: "Color Burn" }] },
  { group: "Lighten", modes: [{ value: "lighten", label: "Lighten" }, { value: "screen", label: "Screen" }, { value: "colorDodge", label: "Color Dodge" }, { value: "add", label: "Linear Dodge (Add)" }] },
  { group: "Contrast", modes: [{ value: "overlay", label: "Overlay" }, { value: "softLight", label: "Soft Light" }, { value: "hardLight", label: "Hard Light" }] },
  { group: "Inversion", modes: [{ value: "difference", label: "Difference" }, { value: "exclusion", label: "Exclusion" }] },
  { group: "Component", modes: [{ value: "hue", label: "Hue" }, { value: "saturation", label: "Saturation" }, { value: "color", label: "Color" }, { value: "luminosity", label: "Luminosity" }] },
];

export function BlendModeSelect(props: { value: BlendMode | ""; onChange: (v: BlendMode) => void }) {
  return (
    <select className="select ec-select" value={props.value} onChange={(e) => props.onChange(e.target.value as BlendMode)}>
      {props.value === "" ? <option value="">(mixed)</option> : null}
      {BLEND_GROUPS.map((g) => (
        <optgroup key={g.group} label={g.group}>
          {g.modes.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

// ---------------------------------------------------------------- knob
/** Rotary knob (pan). Drag vertically; double-click resets. */
export function Knob(props: { value: number; min: number; max: number; onChange: (v: number) => void; onCommit: (v: number) => void; defaultValue?: number; size?: number; title?: string }) {
  const { value, min, max } = props;
  const size = props.size ?? 30;
  const drag = useRef<{ y: number; v: number; last: number } | null>(null);
  const frac = (value - min) / (max - min);
  const ang = -135 + frac * 270;
  const r = size / 2 - 3;
  const pt = (a: number) => {
    const rad = ((a - 90) * Math.PI) / 180;
    return [size / 2 + r * Math.cos(rad), size / 2 + r * Math.sin(rad)];
  };
  const [x0, y0] = pt(-135), [x1, y1] = pt(ang), [xc, yc] = pt(0);
  const center = min < 0 && max > 0;
  const arcFrom = center ? [xc, yc] : [x0, y0];
  const startAng = center ? 0 : -135;
  const large = Math.abs(ang - startAng) > 180 ? 1 : 0;
  const sweep = ang > startAng ? 1 : 0;
  return (
    <svg
      className="knob" width={size} height={size} style={{ cursor: "ns-resize" }}
      onPointerDown={(e) => { (e.target as Element).setPointerCapture(e.pointerId); drag.current = { y: e.clientY, v: value, last: value }; }}
      onPointerMove={(e) => {
        const d = drag.current; if (!d) return;
        const mult = e.shiftKey ? 0.2 : 1;
        const v = Math.round(Math.min(max, Math.max(min, d.v + (d.y - e.clientY) * ((max - min) / 150) * mult)));
        d.last = v; props.onChange(v);
      }}
      onPointerUp={() => { const d = drag.current; drag.current = null; if (d && d.last !== d.v) props.onCommit(d.last); }}
      onDoubleClick={() => { const v = props.defaultValue ?? 0; props.onChange(v); props.onCommit(v); }}
    >
      <title>{props.title}</title>
      <circle cx={size / 2} cy={size / 2} r={r} fill="#1a1a1a" stroke="#3a3a3a" strokeWidth="1.5" />
      {Math.abs(ang - startAng) > 0.5 ? <path d={`M${arcFrom[0]} ${arcFrom[1]} A${r} ${r} 0 ${large} ${sweep} ${x1} ${y1}`} fill="none" stroke="#2d8ceb" strokeWidth="2.2" /> : null}
      <line x1={size / 2} y1={size / 2} x2={x1} y2={y1} stroke="#ddd" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

// ---------------------------------------------------------------- fader + meter
// Premiere-like fader law: non-linear so 0 dB sits ~3/4 up and -∞ at the bottom.
const FADER_MIN = -60;
export function dbToFader(db: number, maxDb = 6): number {
  if (!Number.isFinite(db) || db <= FADER_MIN) return 0;
  // piecewise: [-60..-20] -> 0..0.25, [-20..0] -> 0.25..0.78, [0..max] -> 0.78..1
  if (db < -20) return ((db - FADER_MIN) / 40) * 0.25;
  if (db < 0) return 0.25 + ((db + 20) / 20) * 0.53;
  return 0.78 + (db / maxDb) * 0.22;
}
export function faderToDb(f: number, maxDb = 6): number {
  if (f <= 0.002) return -Infinity;
  if (f < 0.25) return FADER_MIN + (f / 0.25) * 40;
  if (f < 0.78) return -20 + ((f - 0.25) / 0.53) * 20;
  return Math.min(maxDb, ((f - 0.78) / 0.22) * maxDb);
}

export function VFader(props: { db: number; onChange: (db: number) => void; onCommit: (db: number) => void; height?: number; maxDb?: number }) {
  const h = props.height ?? 160;
  const maxDb = props.maxDb ?? 6;
  const ref = useRef<HTMLDivElement>(null);
  const last = useRef<number | null>(null);
  const pos = dbToFader(props.db, maxDb);
  const fromEvent = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const f = 1 - (e.clientY - r.top) / r.height;
    const db = faderToDb(Math.min(1, Math.max(0, f)), maxDb);
    return Number.isFinite(db) ? Math.round(db * 10) / 10 : -Infinity;
  };
  const ticks = [maxDb, 0, -6, -12, -18, -24, -36, -48, -60].filter((v, i, a) => a.indexOf(v) === i);
  return (
    <div className="vfader" style={{ height: h }}>
      <div className="vfader-scale">
        {ticks.map((t) => (
          <span key={t} style={{ bottom: `${dbToFader(t, maxDb) * 100}%` }}>{t > 0 ? `+${t}` : t}</span>
        ))}
      </div>
      <div
        ref={ref}
        className="vfader-track"
        onPointerDown={(e) => {
          (e.target as Element).setPointerCapture(e.pointerId);
          const db = fromEvent(e); last.current = db; props.onChange(db);
        }}
        onPointerMove={(e) => { if (last.current === null) return; const db = fromEvent(e); last.current = db; props.onChange(db); }}
        onPointerUp={() => { if (last.current !== null) props.onCommit(last.current); last.current = null; }}
        onDoubleClick={() => { props.onChange(0); props.onCommit(0); }}
      >
        <div className="vfader-groove" />
        <div className="vfader-zero" style={{ bottom: `${dbToFader(0, maxDb) * 100}%` }} />
        <div className="vfader-cap" style={{ bottom: `calc(${pos * 100}% - 7px)` }} />
      </div>
    </div>
  );
}

/** Vertical peak meter, dBFS (-60..0) with green/yellow/red zones and clip light. */
export function Meter(props: { db: number; height?: number; width?: number }) {
  const h = props.height ?? 160;
  const v = Number.isFinite(props.db) ? Math.min(1, Math.max(0, (props.db + 60) / 60)) : 0;
  return (
    <div className="meter" style={{ height: h, width: props.width ?? 6 }}>
      <div className={"meter-clip" + (props.db >= 0 ? " on" : "")} />
      <div className="meter-bar">
        <div className="meter-fill" style={{ clipPath: `inset(${(1 - v) * 100}% 0 0 0)` }} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- color wheel
/**
 * Lumetri-style color wheel: draggable puck. Angle = hue (deg, 0 = red, counter-clockwise like
 * Premiere's wheels), distance = amount 0..100. Double-click resets. Optional luma slider alongside.
 */
export function ColorWheel(props: {
  hue: number; amount: number; size?: number; label?: string;
  onChange: (hue: number, amount: number) => void; onCommit: (hue: number, amount: number) => void;
  luma?: number; onLumaChange?: (v: number) => void; onLumaCommit?: (v: number) => void;
  hollowWhenNeutral?: boolean;
}) {
  const size = props.size ?? 110;
  const R = size / 2 - 4;
  const ref = useRef<SVGSVGElement>(null);
  const last = useRef<[number, number] | null>(null);
  const rad = (props.hue * Math.PI) / 180;
  const pr = (props.amount / 100) * R;
  const px = size / 2 + pr * Math.cos(rad), py = size / 2 - pr * Math.sin(rad);
  const fromEvent = (e: React.PointerEvent): [number, number] => {
    const r = ref.current!.getBoundingClientRect();
    const dx = e.clientX - r.left - size / 2, dy = -(e.clientY - r.top - size / 2);
    let h = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (h < 0) h += 360;
    const fine = e.shiftKey ? 0.25 : 1;
    const a = Math.min(100, (Math.hypot(dx, dy) / R) * 100 * fine);
    return [Math.round(h * 10) / 10, Math.round(a * 10) / 10];
  };
  const id = useRef("cw" + Math.random().toString(36).slice(2, 8)).current;
  const neutral = props.amount === 0 && !props.luma;
  return (
    <div className="cwheel">
      <div className="cwheel-row">
        <svg
          ref={ref} width={size} height={size} className="cwheel-svg"
          onPointerDown={(e) => { (e.target as Element).setPointerCapture(e.pointerId); const v = fromEvent(e); last.current = v; props.onChange(...v); }}
          onPointerMove={(e) => { if (!last.current) return; const v = fromEvent(e); last.current = v; props.onChange(...v); }}
          onPointerUp={() => { if (last.current) props.onCommit(...last.current); last.current = null; }}
          onDoubleClick={() => { props.onChange(0, 0); props.onCommit(0, 0); }}
        >
          <defs>
            <radialGradient id={id + "w"}>
              <stop offset="0%" stopColor="#808080" stopOpacity="1" />
              <stop offset="100%" stopColor="#808080" stopOpacity="0" />
            </radialGradient>
          </defs>
          <foreignObject x={4} y={4} width={R * 2} height={R * 2}>
            <div style={{ width: R * 2, height: R * 2, borderRadius: "50%", background: "conic-gradient(from 90deg, #f00, #f0f, #00f, #0ff, #0f0, #ff0, #f00)", opacity: neutral && props.hollowWhenNeutral !== false ? 0.55 : 0.9 }} />
          </foreignObject>
          <circle cx={size / 2} cy={size / 2} r={R} fill={`url(#${id}w)`} />
          <circle cx={size / 2} cy={size / 2} r={R} fill="none" stroke="#111" strokeWidth="1.5" />
          <line x1={size / 2 - 5} y1={size / 2} x2={size / 2 + 5} y2={size / 2} stroke="#222" />
          <line x1={size / 2} y1={size / 2 - 5} x2={size / 2} y2={size / 2 + 5} stroke="#222" />
          <circle cx={px} cy={py} r={5} fill="none" stroke="#fff" strokeWidth="1.8" />
          <circle cx={px} cy={py} r={6.5} fill="none" stroke="#000" strokeOpacity="0.5" strokeWidth="1" />
        </svg>
        {props.onLumaChange ? (
          <VSlider value={props.luma ?? 0} min={-100} max={100} height={size - 8} onChange={props.onLumaChange} onCommit={props.onLumaCommit ?? props.onLumaChange} />
        ) : null}
      </div>
      {props.label ? <div className="cwheel-label">{props.label}</div> : null}
    </div>
  );
}

/** Thin vertical slider (Lumetri wheel luminance). */
export function VSlider(props: { value: number; min: number; max: number; height: number; onChange: (v: number) => void; onCommit: (v: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const last = useRef<number | null>(null);
  const f = (props.value - props.min) / (props.max - props.min);
  const fromEvent = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const t = 1 - Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    return Math.round(props.min + t * (props.max - props.min));
  };
  return (
    <div
      ref={ref} className="vslider" style={{ height: props.height }}
      onPointerDown={(e) => { (e.target as Element).setPointerCapture(e.pointerId); const v = fromEvent(e); last.current = v; props.onChange(v); }}
      onPointerMove={(e) => { if (last.current === null) return; const v = fromEvent(e); last.current = v; props.onChange(v); }}
      onPointerUp={() => { if (last.current !== null) props.onCommit(last.current); last.current = null; }}
      onDoubleClick={() => { const z = Math.min(props.max, Math.max(props.min, 0)); props.onChange(z); props.onCommit(z); }}
      title={`Luminance ${props.value}`}
    >
      <div className="vslider-groove" />
      <div className="vslider-thumb" style={{ bottom: `calc(${f * 100}% - 4px)` }} />
    </div>
  );
}

// ---------------------------------------------------------------- misc
export function PropRow(props: { label: ReactNode; children: ReactNode; title?: string; className?: string }) {
  return (
    <div className={"prop-row " + (props.className ?? "")} title={props.title}>
      <label>{props.label}</label>
      <div className="prop-row-value">{props.children}</div>
    </div>
  );
}

export function Toggle(props: { on: boolean; onChange: (v: boolean) => void; title?: string }) {
  return <button className={"toggle" + (props.on ? " on" : "")} title={props.title} onClick={() => props.onChange(!props.on)}><span /></button>;
}

/** Disclosure group with an enable checkbox in the header (Lumetri sections). */
export function CheckSection(props: { title: string; enabled: boolean; onToggle?: (v: boolean) => void; children: ReactNode; defaultOpen?: boolean; right?: ReactNode }) {
  const [open, setOpen] = useState(props.defaultOpen ?? false);
  return (
    <div className={"csec" + (props.enabled ? "" : " disabled")}>
      <div className="csec-header" onClick={() => setOpen(!open)}>
        {props.onToggle ? (
          <input type="checkbox" checked={props.enabled} onClick={(e) => e.stopPropagation()} onChange={(e) => props.onToggle!(e.target.checked)} />
        ) : null}
        <span className="csec-title">{props.title}</span>
        <span className="csec-right" onClick={(e) => e.stopPropagation()}>{props.right}</span>
        <span className={"twirl" + (open ? " open" : "")}>▸</span>
      </div>
      {open ? <div className="csec-body">{props.children}</div> : null}
    </div>
  );
}

export function SubHead(props: { children: ReactNode }) {
  return <div className="subhead">{props.children}</div>;
}
