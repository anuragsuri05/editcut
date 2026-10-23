// Pure (DOM-free) compilation of an effect stack's VideoPrimitives into GPU
// render passes. Consecutive per-pixel color primitives are folded into ONE
// "color" pass (an uber-shader generated per op sequence, parameters passed as
// uniforms); spatial primitives become their own passes. Unit-testable in node.

import type { Clip } from "@shared/types";
import { LOOKS, compileEffect, isVideoPrimitive, type VideoPrimitive } from "@shared/effects";

/** Ops handled inside the color uber-shader (order preserved). "save"/"mix" implement LUT intensity. */
export const COLOR_OPS = [
  "exposure", "contrast", "brightness", "gamma", "saturation", "vibrance", "temperature", "tint", "tones",
  "colorBalance", "hue", "grayscale", "sepia", "invert", "fade", "colorize", "posterize", "threshold",
  "vignette", "noise", "chromaKey", "lumaKey", "save", "mix",
] as const;
export type ColorOpName = (typeof COLOR_OPS)[number];

/** Max ops folded into one color pass (each uses 3 vec4 uniforms). */
export const MAX_COLOR_OPS = 24;

export interface ColorOp {
  op: ColorOpName;
  /** 12 floats = 3 vec4 uniforms. */
  u: number[];
}

export type Pass =
  | { kind: "color"; ops: ColorOp[] }
  | { kind: "blur"; radius: number; direction: "both" | "horizontal" | "vertical" }
  | { kind: "sharpen"; amount: number }
  | { kind: "glow"; radius: number; intensity: number; threshold: number }
  | { kind: "edge"; amount: number }
  | { kind: "emboss"; amount: number }
  /** UV remaps: 0 flip, 1 mirror, 2 skew, 3 pixelate. */
  | { kind: "warp"; mode: 0 | 1 | 2 | 3; a: [number, number, number, number] };

export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.trim().replace(/^#/, "");
  // #RGB / #RGBA / #RRGGBB / #RRGGBBAA (alpha ignored: color params are RGB)
  if (h.length === 3 || h.length === 4) h = h.slice(0, 3).split("").map((c) => c + c).join("");
  const n = parseInt(h.slice(0, 6), 16);
  if (Number.isNaN(n)) {
    const m = /rgba?\(([^)]+)\)/.exec(hex);
    if (m) {
      const [r, g, b] = m[1].split(",").map((s) => parseFloat(s));
      return [(r || 0) / 255, (g || 0) / 255, (b || 0) / 255];
    }
    return [1, 1, 1];
  }
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

const z12 = () => new Array<number>(12).fill(0);

/** Pack a color primitive into 12 uniform floats. Returns null for non-color primitives. */
export function packColorOp(p: VideoPrimitive): ColorOp | null {
  const u = z12();
  switch (p.op) {
    case "exposure": u[0] = p.stops; break;
    case "contrast": u[0] = p.amount; break;
    case "brightness": u[0] = p.amount; break;
    case "gamma": u[0] = p.value; break;
    case "saturation": u[0] = p.factor; break;
    case "vibrance": u[0] = p.amount; break;
    case "temperature": u[0] = p.amount; break;
    case "tint": u[0] = p.amount; break;
    case "tones": u[0] = p.highlights; u[1] = p.shadows; u[2] = p.whites; u[3] = p.blacks; break;
    case "colorBalance":
      u.splice(0, 3, ...p.shadows); u.splice(4, 3, ...p.midtones); u.splice(8, 3, ...p.highlights);
      break;
    case "hue": u[0] = p.degrees; break;
    case "grayscale": u[0] = p.amount; break;
    case "sepia": u[0] = p.amount; break;
    case "invert": u[0] = p.amount; break;
    case "fade": u[0] = p.amount; break;
    case "colorize": { const [r, g, b] = hexToRgb(p.color); u[0] = r; u[1] = g; u[2] = b; u[3] = p.amount; break; }
    case "posterize": u[0] = Math.max(2, p.levels); break;
    case "threshold": u[0] = p.level; break;
    case "vignette": u[0] = p.amount; u[1] = p.midpoint; u[2] = p.roundness; u[3] = p.feather; break;
    case "noise": u[0] = p.amount; break;
    case "chromaKey": { const [r, g, b] = hexToRgb(p.color); u[0] = r; u[1] = g; u[2] = b; u[4] = p.similarity; u[5] = p.smoothness; u[6] = p.spill; break; }
    case "lumaKey": u[0] = p.threshold; u[1] = p.cutoff; break;
    default:
      return null;
  }
  return { op: p.op, u };
}

/** True if the primitive is a no-op and can be skipped. */
export function isNoop(p: VideoPrimitive): boolean {
  switch (p.op) {
    case "exposure": return p.stops === 0;
    case "contrast": case "brightness": case "vibrance": case "temperature": case "tint": case "noise": return p.amount === 0;
    case "gamma": return p.value === 1;
    case "saturation": return p.factor === 1;
    case "hue": return p.degrees % 360 === 0;
    case "grayscale": case "sepia": case "invert": case "fade": case "colorize": return p.amount <= 0;
    case "tones": return !p.highlights && !p.shadows && !p.whites && !p.blacks;
    case "colorBalance": return [...p.shadows, ...p.midtones, ...p.highlights].every((v) => v === 0);
    case "vignette": return p.amount === 0;
    case "blur": return p.radius < 0.25;
    case "sharpen": return p.amount <= 0;
    case "glow": return p.intensity <= 0 || p.radius < 0.25;
    case "edgeDetect": case "emboss": return p.amount <= 0;
    case "pixelate": return p.size <= 1;
    case "flip": return !p.horizontal && !p.vertical;
    case "transform": return !p.skewX && !p.skewY;
    case "lut": return p.intensity <= 0 || !LOOKS[p.name];
    default: return false;
  }
}

/**
 * Build passes from primitives. `pxScale` converts effect pixel units (source px)
 * to the texture the effect runs on (e.g. 0.5 at half playback resolution).
 */
export function buildPasses(prims: VideoPrimitive[], pxScale = 1): Pass[] {
  const passes: Pass[] = [];
  const st: { color: ColorOp[] | null } = { color: null };
  const pushColor = (op: ColorOp) => {
    if (!st.color || st.color.length >= MAX_COLOR_OPS) {
      st.color = [];
      passes.push({ kind: "color", ops: st.color });
    }
    st.color.push(op);
  };
  const endColor = () => (st.color = null);

  for (const p of prims) {
    if (isNoop(p)) continue;
    if (p.op === "lut") {
      const look = LOOKS[p.name] ?? [];
      // keep save..mix in the same pass
      const ops = look.filter((x) => !isNoop(x)).map(packColorOp).filter((x): x is ColorOp => !!x);
      if (st.color && st.color.length + ops.length + 2 > MAX_COLOR_OPS) endColor();
      const save: ColorOp = { op: "save", u: z12() };
      const mix: ColorOp = { op: "mix", u: z12() };
      mix.u[0] = p.intensity;
      pushColor(save);
      for (const o of ops) pushColor(o);
      pushColor(mix);
      continue;
    }
    const c = packColorOp(p);
    if (c) {
      pushColor(c);
      continue;
    }
    endColor();
    switch (p.op) {
      case "blur": passes.push({ kind: "blur", radius: p.radius * pxScale, direction: p.direction }); break;
      case "sharpen": passes.push({ kind: "sharpen", amount: p.amount }); break;
      case "glow": passes.push({ kind: "glow", radius: p.radius * pxScale, intensity: p.intensity, threshold: p.threshold }); break;
      case "edgeDetect": passes.push({ kind: "edge", amount: p.amount }); break;
      case "emboss": passes.push({ kind: "emboss", amount: p.amount }); break;
      case "flip": passes.push({ kind: "warp", mode: 0, a: [p.horizontal ? 1 : 0, p.vertical ? 1 : 0, 0, 0] }); break;
      case "mirror": passes.push({ kind: "warp", mode: 1, a: [p.axis === "vertical" ? 1 : 0, 0, 0, 0] }); break;
      case "transform": passes.push({ kind: "warp", mode: 2, a: [(p.skewX * Math.PI) / 180, (p.skewY * Math.PI) / 180, 0, 0] }); break;
      case "pixelate": passes.push({ kind: "warp", mode: 3, a: [Math.max(1, p.size * pxScale), 0, 0, 0] }); break;
    }
  }
  return passes;
}

/** Compile all enabled video effects of a clip at timeline time t into primitives. */
export function clipVideoPrimitives(clip: Clip, t: number): VideoPrimitive[] {
  const local = t - clip.start;
  const out: VideoPrimitive[] = [];
  for (const e of clip.effects) {
    if (!e.enabled) continue;
    for (const p of compileEffect(e, local)) if (isVideoPrimitive(p)) out.push(p);
  }
  return out;
}

/** Signature of a color pass (selects the cached shader program). */
export function colorSignature(ops: ColorOp[]): string {
  return ops.map((o) => o.op).join(",");
}
