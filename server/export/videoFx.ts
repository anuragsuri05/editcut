// Maps every VideoPrimitive (shared/effects.ts) to ffmpeg filters.
// Streams carrying alpha are handled by processing color and alpha separately
// (alphaextract → … → alphamerge) so no filter can silently drop transparency.
import type { VideoPrimitive } from "../../shared/effects";
import { LOOKS } from "../../shared/effects";
import type { Graph } from "./filtergraph";
import { num, rgb01, ffColor } from "./expr";

export interface VState {
  w: number;
  h: number;
  alpha: boolean;
}

type Op =
  | { kind: "color"; filters: string[] } // pixel-wise color change (alpha untouched)
  | { kind: "colorGraph"; build: (g: Graph, input: string) => string } // color-only, needs a sub-graph
  | { kind: "geo"; filters: string[]; forceAlpha?: boolean } // spatial: applied to color AND alpha
  | { kind: "geoGraph"; build: (g: Graph, input: string, isAlphaPlane: boolean) => string }
  | { kind: "key"; filters: string[] }; // produces alpha

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** Scale a primitive's strength toward identity (used for look intensity). */
export function scalePrimitive(p: VideoPrimitive, k: number): VideoPrimitive {
  const lerp = (id: number, v: number) => id + (v - id) * k;
  switch (p.op) {
    case "exposure": return { ...p, stops: p.stops * k };
    case "contrast": case "brightness": case "vibrance": case "temperature": case "tint": case "grayscale": case "sepia": case "invert": case "fade":
      return { ...p, amount: p.amount * k } as VideoPrimitive;
    case "gamma": return { ...p, value: lerp(1, p.value) };
    case "saturation": return { ...p, factor: lerp(1, p.factor) };
    case "tones": return { ...p, highlights: p.highlights * k, shadows: p.shadows * k, whites: p.whites * k, blacks: p.blacks * k };
    case "colorBalance": {
      const m = (a: [number, number, number]) => a.map((x) => x * k) as [number, number, number];
      return { ...p, shadows: m(p.shadows), midtones: m(p.midtones), highlights: m(p.highlights) };
    }
    case "hue": return { ...p, degrees: p.degrees * k };
    case "colorize": return { ...p, amount: p.amount * k };
    case "vignette": return { ...p, amount: p.amount * k };
    default: return p;
  }
}

/** Expand `lut` looks into their primitives. */
export function expandLooks(prims: VideoPrimitive[]): VideoPrimitive[] {
  const out: VideoPrimitive[] = [];
  for (const p of prims) {
    if (p.op === "lut") {
      const look = LOOKS[p.name];
      if (!look || p.intensity <= 0) continue;
      for (const lp of look) out.push(scalePrimitive(lp, p.intensity));
    } else out.push(p);
  }
  return out;
}

function mixWithOriginal(amount: number, effect: (g: Graph, inp: string) => string) {
  return (g: Graph, input: string): string => {
    const a = clamp(amount, 0, 1);
    if (a >= 0.999) return effect(g, g.chain(input, ["format=yuv444p"]));
    const [o, e] = g.split(g.chain(input, ["format=yuv444p"]), 2);
    const fx = g.chain(effect(g, e), ["format=yuv444p"]);
    return g.chain([o, fx], [`blend=all_mode=normal:all_opacity=${num(a)}`]);
  };
}

function toneCurve(t: { highlights: number; shadows: number; whites: number; blacks: number }): string {
  const pts: [number, number][] = [
    [0, Math.max(0, t.blacks) * 0.06],
    [0.06, 0.06 + t.blacks * 0.05],
    [0.25, 0.25 + t.shadows * 0.1],
    [0.5, 0.5 + (t.shadows + t.highlights) * 0.02],
    [0.75, 0.75 + t.highlights * 0.1],
    [0.94, 0.94 + t.whites * 0.05],
    [1, 1 + Math.min(0, t.whites) * 0.06],
  ];
  let prev = -1;
  const s = pts.map(([x, y]) => {
    y = clamp(y, 0, 1);
    if (y < prev) y = prev;
    prev = y;
    return `${num(x, 3)}/${num(y, 4)}`;
  });
  return `curves=master='${s.join(" ")}'`;
}

function primToOp(p: VideoPrimitive, st: VState): Op | null {
  switch (p.op) {
    case "exposure":
      return p.stops ? { kind: "color", filters: [`exposure=exposure=${num(clamp(p.stops, -3, 3))}:black=0`] } : null;
    case "contrast":
      return p.amount ? { kind: "color", filters: [`eq=contrast=${num(clamp(1 + p.amount, 0, 2))}`] } : null;
    case "brightness":
      return p.amount ? { kind: "color", filters: [`eq=brightness=${num(clamp(p.amount, -1, 1))}`] } : null;
    case "gamma":
      return Math.abs(p.value - 1) > 1e-4 ? { kind: "color", filters: [`eq=gamma=${num(clamp(p.value, 0.1, 10))}`] } : null;
    case "saturation":
      return Math.abs(p.factor - 1) > 1e-4 ? { kind: "color", filters: [`eq=saturation=${num(clamp(p.factor, 0, 3))}`] } : null;
    case "vibrance":
      return p.amount ? { kind: "color", filters: [`vibrance=intensity=${num(clamp(p.amount, -2, 2))}`] } : null;
    case "temperature": {
      const a = clamp(p.amount, -1, 1);
      return a ? { kind: "color", filters: [`colorchannelmixer=rr=${num(1 + 0.22 * a)}:gg=${num(1 + 0.03 * a)}:bb=${num(1 - 0.22 * a)}`] } : null;
    }
    case "tint": {
      const a = clamp(p.amount, -1, 1);
      return a ? { kind: "color", filters: [`colorchannelmixer=rr=${num(1 + 0.06 * a)}:gg=${num(1 - 0.16 * a)}:bb=${num(1 + 0.06 * a)}`] } : null;
    }
    case "tones":
      return p.highlights || p.shadows || p.whites || p.blacks ? { kind: "color", filters: [toneCurve(p)] } : null;
    case "colorBalance": {
      const c = (v: number) => num(clamp(v, -1, 1));
      const [s, m, h] = [p.shadows, p.midtones, p.highlights];
      return { kind: "color", filters: [`colorbalance=rs=${c(s[0])}:gs=${c(s[1])}:bs=${c(s[2])}:rm=${c(m[0])}:gm=${c(m[1])}:bm=${c(m[2])}:rh=${c(h[0])}:gh=${c(h[1])}:bh=${c(h[2])}`] };
    }
    case "hue":
      return p.degrees ? { kind: "color", filters: [`hue=h=${num(p.degrees)}`] } : null;
    case "grayscale":
      return p.amount > 0 ? { kind: "color", filters: [`hue=s=${num(clamp(1 - p.amount, 0, 1))}`] } : null;
    case "sepia": {
      const a = clamp(p.amount, 0, 1);
      if (!a) return null;
      const S = [[0.393, 0.769, 0.189], [0.349, 0.686, 0.168], [0.272, 0.534, 0.131]];
      const m = (r: number, c: number) => num((r === c ? 1 - a : 0) + a * S[r][c]);
      return { kind: "color", filters: [`colorchannelmixer=rr=${m(0, 0)}:rg=${m(0, 1)}:rb=${m(0, 2)}:gr=${m(1, 0)}:gg=${m(1, 1)}:gb=${m(1, 2)}:br=${m(2, 0)}:bg=${m(2, 1)}:bb=${m(2, 2)}`] };
    }
    case "invert": {
      const a = clamp(p.amount, 0, 1);
      if (!a) return null;
      if (a > 0.999) return { kind: "color", filters: ["format=yuv444p", "negate"] };
      const e = `'val+${num(a)}*(maxval-2*val)'`;
      return { kind: "color", filters: [`lutrgb=r=${e}:g=${e}:b=${e}`] };
    }
    case "fade": {
      const k = clamp(p.amount, 0, 1) * 0.35;
      return k ? { kind: "color", filters: [`colorlevels=romin=${num(k)}:gomin=${num(k)}:bomin=${num(k)}`] } : null;
    }
    case "colorize": {
      const a = clamp(p.amount, 0, 1);
      if (!a) return null;
      const [cr, cg, cb] = rgb01(p.color);
      const L = [0.299, 0.587, 0.114];
      const row = (c: number, i: number) => L.map((l, j) => num((i === j ? 1 - a : 0) + a * c * l));
      const [r, g2, b] = [row(cr, 0), row(cg, 1), row(cb, 2)];
      return { kind: "color", filters: [`colorchannelmixer=rr=${r[0]}:rg=${r[1]}:rb=${r[2]}:gr=${g2[0]}:gg=${g2[1]}:gb=${g2[2]}:br=${b[0]}:bg=${b[1]}:bb=${b[2]}`] };
    }
    case "posterize": {
      const L = Math.max(2, Math.round(p.levels));
      const e = `'floor(val/maxval*${L - 1}+0.5)/${L - 1}*maxval'`;
      return { kind: "color", filters: [`lutrgb=r=${e}:g=${e}:b=${e}`] };
    }
    case "threshold": {
      const t = clamp(p.level, 0, 1);
      return { kind: "color", filters: ["format=yuv444p", `lutyuv=y='if(gte(val,${num(16 + t * 219)}),235,16)':u=128:v=128`] };
    }
    case "blur": {
      const s = Math.max(0, p.radius) * 0.5;
      if (s < 0.05) return null;
      const sig = num(Math.min(s, 1024));
      if (p.direction === "horizontal") return { kind: "geo", filters: [`gblur=sigma=${sig}:sigmaV=0`] };
      if (p.direction === "vertical") return { kind: "geo", filters: [`gblur=sigma=0:sigmaV=${sig}`] };
      return { kind: "geo", filters: [`gblur=sigma=${sig}`] };
    }
    case "sharpen": {
      const a = clamp(p.amount, 0, 5);
      return a > 0.01 ? { kind: "color", filters: [`unsharp=5:5:${num(a)}:5:5:0`] } : null;
    }
    case "noise": {
      const a = clamp(p.amount, 0, 1);
      return a > 0.005 ? { kind: "color", filters: ["format=yuv444p", `noise=c0s=${Math.round(a * 60)}:c0f=t+u:c1s=${Math.round(a * 20)}:c1f=t+u:c2s=${Math.round(a * 20)}:c2f=t+u`] } : null;
    }
    case "pixelate": {
      const s = Math.max(1, Math.round(p.size));
      return s > 1 ? { kind: "geo", filters: [`pixelize=width=${s}:height=${s}`] } : null;
    }
    case "vignette": {
      const a = clamp(p.amount, -1, 1);
      if (Math.abs(a) < 0.005) return null;
      // Soft elliptical falloff computed once (single-frame geq, looped) and blended:
      // multiply to darken, screen to lighten (Premiere Lumetri/Vignette behaviour).
      const { w, h } = st;
      const rho = clamp(p.roundness, -1, 1);
      const mid = clamp(p.midpoint, 0, 1);
      const fea = Math.max(0.05, clamp(p.feather, 0, 1));
      const r0 = 0.35 + mid * 0.9 - fea * 0.35, r1 = 0.35 + mid * 0.9 + fea * 0.55;
      // rho 0: ellipse following the frame; 1: circle; -1: more rectangular-ish (stretched)
      const ky = rho >= 0 ? 1 - rho + rho * (h / w) : 1 - rho * 0.3;
      const dist = `hypot((X-${w / 2})/${w / 2},(Y-${h / 2})/${h / 2}*${num(ky, 4)})`;
      const s = `clip((${dist}-${num(r0, 4)})/${num(r1 - r0, 4)},0,1)`;
      const smooth = `(${s})*(${s})*(3-2*(${s}))`;
      const val = a < 0 ? `255*(1-${num(Math.abs(a), 4)}*${smooth})` : `255*${num(a, 4)}*${smooth}`;
      return {
        kind: "colorGraph",
        build: (g, input) => {
          const mask = g.chain(null, [`color=c=black:s=${w}x${h}:d=1`, "format=gray", "trim=end_frame=1", `geq=lum='${val}'`, "format=gbrp", "loop=loop=-1:size=1:start=0", "setpts=N/FRAME_RATE/TB"]);
          const src = g.chain(input, ["format=gbrp"]);
          return g.chain([src, mask], [`blend=all_mode=${a < 0 ? "multiply" : "screen"}:shortest=1`]);
        },
      };
    }
    case "chromaKey": {
      const [r, g, b] = rgb01(p.color);
      const despill = g >= b ? "green" : "blue";
      const filters = [
        "format=yuv444p",
        `chromakey=color=${ffColor(p.color, "0x00ff00").split("@")[0]}:similarity=${num(clamp(0.03 + p.similarity * 0.4, 0.01, 1))}:blend=${num(clamp(0.005 + p.smoothness * 0.3, 0, 1))}`,
      ];
      void r;
      if (p.spill > 0.01) filters.push("format=rgba", `despill=type=${despill}:mix=${num(clamp(p.spill, 0, 1))}:expand=0`);
      filters.push("format=yuva444p");
      return { kind: "key", filters };
    }
    case "lumaKey":
      return { kind: "key", filters: ["format=yuva444p", `lumakey=threshold=0:tolerance=${num(clamp(p.threshold, 0, 1))}:softness=${num(clamp(p.cutoff, 0, 1))}`] };
    case "flip": {
      const f = [p.horizontal && "hflip", p.vertical && "vflip"].filter(Boolean) as string[];
      return f.length ? { kind: "geo", filters: f } : null;
    }
    case "mirror":
      return {
        kind: "geoGraph",
        build: (g, input) => {
          const [a, b] = g.split(input, 2);
          const half = p.axis === "vertical"
            ? g.chain(b, ["crop=iw:ih/2:0:0", "vflip"])
            : g.chain(b, ["crop=iw/2:ih:0:0", "hflip"]);
          return g.chain([a, half], [p.axis === "vertical" ? "overlay=x=0:y=main_h-overlay_h" : "overlay=x=main_w-overlay_w:y=0"]);
        },
      };
    case "edgeDetect":
      return p.amount > 0.005 ? { kind: "colorGraph", build: mixWithOriginal(p.amount, (g, i) => g.chain(i, ["edgedetect=mode=colormix:high=0.2:low=0.06"])) } : null;
    case "emboss":
      return p.amount > 0.005
        ? { kind: "colorGraph", build: mixWithOriginal(p.amount, (g, i) => g.chain(i, [`convolution=0m='-2 -1 0 -1 1 1 0 1 2':0bias=0:1m='0 0 0 0 1 0 0 0 0':2m='0 0 0 0 1 0 0 0 0'`, "hue=s=0.15"])) }
        : null;
    case "glow": {
      if (p.intensity <= 0.005) return null;
      return {
        kind: "colorGraph",
        build: (g, input) => {
          const [a, b] = g.split(g.chain(input, ["format=gbrp"]), 2);
          const thr = num(clamp(p.threshold, 0, 1));
          const gain = num(Math.max(1, p.intensity));
          const e = `'if(gt(val,maxval*${thr}),min(maxval,val*${gain}),0)'`;
          const glow = g.chain(b, [`lutrgb=r=${e}:g=${e}:b=${e}`, `gblur=sigma=${num(Math.max(0.5, p.radius * 0.5))}`, "format=gbrp"]);
          return g.chain([a, glow], [`blend=all_mode=screen:all_opacity=${num(clamp(p.intensity, 0, 1))}`]);
        },
      };
    }
    case "transform": {
      const sx = Math.tan((clamp(p.skewX, -80, 80) * Math.PI) / 180);
      const sy = Math.tan((clamp(p.skewY, -80, 80) * Math.PI) / 180);
      if (Math.abs(sx) < 1e-4 && Math.abs(sy) < 1e-4) return null;
      return { kind: "geo", forceAlpha: true, filters: [`shear=shx=${num(clamp(sx, -2, 2))}:shy=${num(clamp(sy, -2, 2))}:fillcolor=black:interp=bilinear`] };
    }
    case "lut":
      return null; // expanded beforehand
  }
}

/** Apply primitives to a stream. Returns the new label; mutates st.alpha. */
export function applyVideoPrims(g: Graph, input: string, prims: VideoPrimitive[], st: VState): string {
  const ops = expandLooks(prims).map((p) => primToOp(p, st)).filter((o): o is Op => !!o);
  let cur = input;
  let i = 0;
  while (i < ops.length) {
    const op = ops[i];
    if (op.kind === "color") {
      // merge consecutive simple color ops into one pass
      const filters: string[] = [];
      while (i < ops.length && ops[i].kind === "color") filters.push(...(ops[i++] as { filters: string[] }).filters);
      cur = colorOnly(g, cur, st, (gg, inp) => gg.chain(inp, filters));
      continue;
    }
    i++;
    if (op.kind === "colorGraph") cur = colorOnly(g, cur, st, op.build);
    else if (op.kind === "key") {
      cur = g.chain(cur, op.filters);
      st.alpha = true;
    } else if (op.kind === "geo") {
      if (op.forceAlpha && !st.alpha) {
        cur = g.chain(cur, ["format=yuva444p"]);
        st.alpha = true;
      }
      cur = geo(g, cur, st, (gg, inp) => gg.chain(inp, op.filters));
    } else if (op.kind === "geoGraph") cur = geo(g, cur, st, (gg, inp, a) => op.build(gg, inp, a));
  }
  return cur;
}

function colorOnly(g: Graph, input: string, st: VState, fx: (g: Graph, inp: string) => string): string {
  if (!st.alpha) return fx(g, input);
  const [c, a] = g.split(g.chain(input, ["format=yuva444p"]), 2);
  const al = g.chain(a, ["alphaextract"]);
  const col = fx(g, c);
  return g.chain([g.chain(col, ["format=yuv444p"]), al], ["alphamerge", "format=yuva444p"]);
}

function geo(g: Graph, input: string, st: VState, fx: (g: Graph, inp: string, isAlpha: boolean) => string): string {
  if (!st.alpha) return fx(g, input, false);
  const [c, a] = g.split(g.chain(input, ["format=yuva444p"]), 2);
  const al = fx(g, g.chain(a, ["alphaextract", "format=gray"]), true);
  const col = fx(g, g.chain(c, ["format=yuv444p"]), false);
  return g.chain([g.chain(col, ["format=yuv444p"]), g.chain(al, ["format=gray"])], ["alphamerge", "format=yuva444p"]);
}
