// Helpers turning EditCut parameters (with keyframes) into ffmpeg expressions.
import type { Keyframe, Param } from "../../shared/types";
import { evalParam } from "../../shared/params";

/** Compact number formatting for filter args (no exponent notation). */
export function num(v: number, digits = 6): string {
  if (!Number.isFinite(v)) return "0";
  const s = v.toFixed(digits);
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") || "0" : s;
}

/** Common broadcast rates as exact rationals. */
export function fpsRational(fps: number): string {
  const table: [number, string][] = [
    [23.976, "24000/1001"], [29.97, "30000/1001"], [59.94, "60000/1001"], [47.952, "48000/1001"], [119.88, "120000/1001"],
  ];
  for (const [f, r] of table) if (Math.abs(fps - f) < 0.01) return r;
  if (Math.abs(fps - Math.round(fps)) < 1e-6) return String(Math.round(fps));
  return num(fps, 4);
}

export function fpsValue(fps: number): number {
  const r = fpsRational(fps);
  if (r.includes("/")) {
    const [a, b] = r.split("/").map(Number);
    return a / b;
  }
  return Number(r);
}

/** Snap a time to the frame grid. */
export function snap(t: number, fps: number): number {
  const f = fpsValue(fps);
  return Math.round(t * f) / f;
}

export function isAnimated(p: Param | undefined): boolean {
  return !!p?.keyframes && p.keyframes.length > 1 && p.keyframes.some((k) => k.v !== p.keyframes![0].v);
}

function easeExpr(interp: Keyframe["interp"], x: string): string {
  switch (interp) {
    case "hold":
      return "0";
    case "linear":
      return x;
    case "easeIn":
      return `(${x})*(${x})`;
    case "easeOut":
      return `(1-(1-(${x}))*(1-(${x})))`;
    case "bezier":
    case "easeInOut":
      return `if(lt(${x},0.5),2*(${x})*(${x}),1-pow(-2*(${x})+2,2)/2)`;
  }
}

/**
 * ffmpeg expression for a param as a function of clip-local time `T` (an
 * expression string). Matches shared/params.ts evalParam exactly. Static
 * params return a plain number.
 */
export function paramExpr(p: Param | undefined, T: string, fallback = 0, scale = 1, offset = 0): string {
  const map = (v: number) => num(v * scale + offset);
  if (!p) return map(fallback);
  const kfs = p.keyframes;
  if (!kfs || kfs.length === 0) return map(p.value);
  if (kfs.length === 1 || !isAnimated(p)) return map(kfs[0].v);
  const sorted = [...kfs].sort((a, b) => a.t - b.t);
  // Build from the end backwards: if(lt(T,t1), seg0, if(lt(T,t2), seg1, ... last))
  let expr = map(sorted[sorted.length - 1].v);
  for (let i = sorted.length - 2; i >= 0; i--) {
    const a = sorted[i], b = sorted[i + 1];
    const span = b.t - a.t;
    let seg: string;
    if (span <= 1e-9) seg = map(b.v);
    else {
      const x = `((${T})-${num(a.t)})/${num(span)}`;
      const va = a.v * scale + offset, vb = b.v * scale + offset;
      seg = `(${num(va)}+(${num(vb - va)})*(${easeExpr(a.interp, x)}))`;
    }
    expr = `if(lt(${T},${num(b.t)}),${seg},${expr})`;
  }
  // before the first keyframe: hold first value
  expr = `if(lt(${T},${num(sorted[0].t)}),${map(sorted[0].v)},${expr})`;
  return expr;
}

/** Range of values a param takes over [t0,t1] (sampled). */
export function paramRange(p: Param | undefined, t0: number, t1: number, fallback = 0): [number, number] {
  if (!p || !isAnimated(p)) {
    const v = evalParam(p, t0, fallback);
    return [v, v];
  }
  let lo = Infinity, hi = -Infinity;
  const steps = 64;
  for (let i = 0; i <= steps; i++) {
    const v = evalParam(p, t0 + ((t1 - t0) * i) / steps, fallback);
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  for (const k of p.keyframes ?? []) if (k.t >= t0 && k.t <= t1) { lo = Math.min(lo, k.v); hi = Math.max(hi, k.v); }
  return [lo, hi];
}

/** Escape a value for use inside a single-quoted filtergraph option. */
export function q(s: string): string {
  return `'${s.replace(/'/g, "")}'`;
}

/** "#rrggbb" / "rgba(...)" / named → ffmpeg color "0xRRGGBB[@a]". */
export function ffColor(c: string | undefined, fallback = "black"): string {
  if (!c) return fallback;
  const s = c.trim();
  let m = /^#([0-9a-f]{3})$/i.exec(s);
  if (m) return "0x" + [...m[1]].map((x) => x + x).join("");
  m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(s);
  if (m) return "0x" + m[1] + (m[2] ? "@" + num(parseInt(m[2], 16) / 255, 3) : "");
  m = /^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:[ ,/]+([\d.]+%?))?\s*\)$/i.exec(s);
  if (m) {
    const h = (v: string) => Math.max(0, Math.min(255, Math.round(Number(v)))).toString(16).padStart(2, "0");
    let a = m[4] !== undefined ? (m[4].endsWith("%") ? Number(m[4].slice(0, -1)) / 100 : Number(m[4])) : 1;
    a = Math.max(0, Math.min(1, a));
    return "0x" + h(m[1]) + h(m[2]) + h(m[3]) + (a < 1 ? "@" + num(a, 3) : "");
  }
  if (/^[a-z]+$/i.test(s)) return s;
  return fallback;
}

/** Parse a CSS hex color to 0..1 RGB. */
export function rgb01(c: string | undefined): [number, number, number] {
  const s = ffColor(c, "0xffffff");
  const m = /^0x([0-9a-f]{6})/i.exec(s);
  if (!m) return [1, 1, 1];
  const v = parseInt(m[1], 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}
