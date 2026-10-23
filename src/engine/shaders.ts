// GLSL ES 3.00 sources for the WebGL2 compositor. Pure strings + builders so
// shader composition is unit-testable without a GPU.
//
// Conventions: all textures are in GL orientation (uv.y = 1 is the TOP of the
// image; images/videos are uploaded with UNPACK_FLIP_Y). Colors are straight
// (non-premultiplied) alpha.

import { COLOR_OPS, MAX_COLOR_OPS, type ColorOpName } from "./passes";
import type { BlendMode, TransitionType } from "@shared/types";

export const VERT = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const HEAD = `#version 300 es
precision highp float;
precision highp int;
in vec2 v_uv;
out vec4 o;
`;

const COMMON = `
const vec3 LW = vec3(0.2126, 0.7152, 0.0722);
float lum(vec3 c) { return dot(c, LW); }
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 chroma709(vec3 c) {
  return vec2(-0.1146 * c.r - 0.3854 * c.g + 0.5 * c.b, 0.5 * c.r - 0.4542 * c.g - 0.0458 * c.b);
}
`;

export const COPY_FRAG = `${HEAD}
uniform sampler2D u_tex;
void main() { o = texture(u_tex, v_uv); }`;

/** Final output to the screen: composite over black or a transparency checkerboard. */
export const OUTPUT_FRAG = `${HEAD}
uniform sampler2D u_tex;
uniform int u_grid;
uniform float u_cell;
void main() {
  vec4 c = texture(u_tex, v_uv);
  vec3 bg = vec3(0.0);
  if (u_grid == 1) {
    vec2 cell = floor(gl_FragCoord.xy / u_cell);
    bg = mod(cell.x + cell.y, 2.0) < 1.0 ? vec3(0.32) : vec3(0.22);
  }
  o = vec4(mix(bg, clamp(c.rgb, 0.0, 1.0), clamp(c.a, 0.0, 1.0)), 1.0);
}`;

// ---------------------------------------------------------------- color uber-shader

const COLOR_FUNCS: Record<Exclude<ColorOpName, "save" | "mix">, string> = {
  exposure: `vec4 f_exposure(vec4 c, vec4 a, vec4 b, vec4 d) { c.rgb *= exp2(a.x / 2.2); return c; }`,
  contrast: `vec4 f_contrast(vec4 c, vec4 a, vec4 b, vec4 d) { c.rgb = (c.rgb - 0.5) * (1.0 + a.x) + 0.5; return c; }`,
  brightness: `vec4 f_brightness(vec4 c, vec4 a, vec4 b, vec4 d) { c.rgb += a.x; return c; }`,
  gamma: `vec4 f_gamma(vec4 c, vec4 a, vec4 b, vec4 d) { c.rgb = pow(max(c.rgb, 0.0), vec3(1.0 / max(a.x, 0.01))); return c; }`,
  saturation: `vec4 f_saturation(vec4 c, vec4 a, vec4 b, vec4 d) { c.rgb = mix(vec3(lum(c.rgb)), c.rgb, a.x); return c; }`,
  vibrance: `vec4 f_vibrance(vec4 c, vec4 a, vec4 b, vec4 d) {
  float mx = max(c.r, max(c.g, c.b)); float mn = min(c.r, min(c.g, c.b));
  float f = 1.0 + a.x * (1.0 - clamp(mx - mn, 0.0, 1.0));
  c.rgb = mix(vec3(lum(c.rgb)), c.rgb, f); return c; }`,
  temperature: `vec4 f_temperature(vec4 c, vec4 a, vec4 b, vec4 d) { c.rgb *= vec3(1.0 + 0.2 * a.x, 1.0 + 0.04 * a.x, 1.0 - 0.2 * a.x); return c; }`,
  tint: `vec4 f_tint(vec4 c, vec4 a, vec4 b, vec4 d) { c.rgb *= vec3(1.0 + 0.1 * a.x, 1.0 - 0.15 * a.x, 1.0 + 0.1 * a.x); return c; }`,
  tones: `vec4 f_tones(vec4 c, vec4 a, vec4 b, vec4 d) {
  float l = clamp(lum(c.rgb), 0.0, 1.0);
  float ws = 1.0 - smoothstep(0.0, 0.55, l);
  float wh = smoothstep(0.45, 1.0, l);
  c.rgb += (a.y * ws + a.x * wh) * 0.3;
  c.rgb += a.z * 0.25 * l * l + a.w * 0.25 * (1.0 - l) * (1.0 - l);
  return c; }`,
  colorBalance: `vec4 f_colorBalance(vec4 c, vec4 a, vec4 b, vec4 d) {
  float l = clamp(lum(c.rgb), 0.0, 1.0);
  float ws = 1.0 - smoothstep(0.0, 0.5, l);
  float wh = smoothstep(0.5, 1.0, l);
  float wm = max(1.0 - ws - wh, 0.0);
  c.rgb += a.rgb * ws + b.rgb * wm + d.rgb * wh;
  return c; }`,
  hue: `vec4 f_hue(vec4 c, vec4 a, vec4 b, vec4 d) {
  float h = radians(a.x); vec3 k = vec3(0.57735026); float cs = cos(h);
  c.rgb = c.rgb * cs + cross(k, c.rgb) * sin(h) + k * dot(k, c.rgb) * (1.0 - cs);
  return c; }`,
  grayscale: `vec4 f_grayscale(vec4 c, vec4 a, vec4 b, vec4 d) { c.rgb = mix(c.rgb, vec3(lum(c.rgb)), a.x); return c; }`,
  sepia: `vec4 f_sepia(vec4 c, vec4 a, vec4 b, vec4 d) {
  vec3 s = vec3(dot(c.rgb, vec3(0.393, 0.769, 0.189)), dot(c.rgb, vec3(0.349, 0.686, 0.168)), dot(c.rgb, vec3(0.272, 0.534, 0.131)));
  c.rgb = mix(c.rgb, s, a.x); return c; }`,
  invert: `vec4 f_invert(vec4 c, vec4 a, vec4 b, vec4 d) { c.rgb = mix(c.rgb, 1.0 - c.rgb, a.x); return c; }`,
  fade: `vec4 f_fade(vec4 c, vec4 a, vec4 b, vec4 d) { c.rgb = 0.22 * a.x + c.rgb * (1.0 - 0.32 * a.x); return c; }`,
  colorize: `vec4 f_colorize(vec4 c, vec4 a, vec4 b, vec4 d) { c.rgb = mix(c.rgb, a.rgb * lum(c.rgb), a.w); return c; }`,
  posterize: `vec4 f_posterize(vec4 c, vec4 a, vec4 b, vec4 d) { float n = max(a.x - 1.0, 1.0); c.rgb = floor(clamp(c.rgb, 0.0, 1.0) * n + 0.5) / n; return c; }`,
  threshold: `vec4 f_threshold(vec4 c, vec4 a, vec4 b, vec4 d) { c.rgb = vec3(step(a.x, lum(c.rgb))); return c; }`,
  vignette: `vec4 f_vignette(vec4 c, vec4 a, vec4 b, vec4 d) {
  vec2 q = abs(v_uv - 0.5) * 2.0;
  float asp = u_size.x / max(u_size.y, 1.0);
  q.x *= mix(1.0, asp, max(a.z, 0.0));
  float pw = 2.0 + max(-a.z, 0.0) * 6.0;
  float r = pow(pow(q.x, pw) + pow(q.y, pw), 1.0 / pw);
  float inner = a.y * 1.2;
  float v = smoothstep(inner, inner + a.w * 0.8 + 0.05, r);
  if (a.x < 0.0) c.rgb *= 1.0 + a.x * v; else c.rgb = mix(c.rgb, vec3(1.0), a.x * v);
  return c; }`,
  noise: `vec4 f_noise(vec4 c, vec4 a, vec4 b, vec4 d) {
  float n = hash12(floor(v_uv * u_size) + fract(u_time * 7.13) * vec2(97.0, 13.0)) - 0.5;
  c.rgb += n * a.x * 0.6; return c; }`,
  chromaKey: `vec4 f_chromaKey(vec4 c, vec4 a, vec4 b, vec4 d) {
  float dd = distance(chroma709(c.rgb), chroma709(a.rgb));
  float t0 = b.x * 0.4;
  float t1 = t0 + b.y * 0.3 + 0.001;
  float al = smoothstep(t0, t1, dd);
  float sp = b.z * (1.0 - smoothstep(t0, t1 + 0.25, dd));
  c.rgb = mix(c.rgb, vec3(lum(c.rgb)), sp);
  c.a *= al; return c; }`,
  lumaKey: `vec4 f_lumaKey(vec4 c, vec4 a, vec4 b, vec4 d) { c.a *= smoothstep(a.x, a.x + max(a.y, 0.02), lum(c.rgb)); return c; }`,
};

/** Generate the fragment shader for a color pass executing `ops` in order. */
export function colorShaderSource(ops: ColorOpName[]): string {
  if (ops.length > MAX_COLOR_OPS) throw new Error("too many color ops in one pass");
  const used = [...new Set(ops)].filter((o) => o !== "save" && o !== "mix") as (keyof typeof COLOR_FUNCS)[];
  for (const o of ops) if (!COLOR_OPS.includes(o)) throw new Error("unknown color op " + o);
  const body = ops
    .map((op, i) => {
      if (op === "save") return `  s = c;`;
      if (op === "mix") return `  c = vec4(mix(s.rgb, c.rgb, u_p[${i * 3}].x), c.a);`;
      return `  c = f_${op}(c, u_p[${i * 3}], u_p[${i * 3 + 1}], u_p[${i * 3 + 2}]);`;
    })
    .join("\n");
  return `${HEAD}
uniform sampler2D u_tex;
uniform vec4 u_p[${Math.max(1, ops.length * 3)}];
uniform vec2 u_size;
uniform float u_time;
${COMMON}
${used.map((u) => COLOR_FUNCS[u]).join("\n")}
void main() {
  vec4 c = texture(u_tex, v_uv);
  vec4 s = c;
${body}
  o = vec4(clamp(c.rgb, 0.0, 1.0), clamp(c.a, 0.0, 1.0));
}`;
}

// ---------------------------------------------------------------- spatial passes

/** Separable gaussian blur (premultiplied accumulation). u_dir = texel step along the axis. */
export const BLUR_FRAG = `${HEAD}
uniform sampler2D u_tex;
uniform vec2 u_dir;
uniform float u_sigma;
void main() {
  float sigma = max(u_sigma, 0.001);
  float stepPx = max(1.0, sigma * 3.0 / 16.0);
  vec4 acc = vec4(0.0);
  float wsum = 0.0;
  for (int i = -16; i <= 16; i++) {
    float x = float(i) * stepPx;
    float w = exp(-0.5 * x * x / (sigma * sigma));
    vec4 s = texture(u_tex, v_uv + u_dir * x);
    acc += vec4(s.rgb * s.a, s.a) * w;
    wsum += w;
  }
  acc /= wsum;
  o = acc.a > 0.0001 ? vec4(acc.rgb / acc.a, acc.a) : vec4(0.0);
}`;

export const SHARPEN_FRAG = `${HEAD}
uniform sampler2D u_tex;
uniform vec2 u_size;
uniform float u_amount;
void main() {
  vec2 t = 1.0 / u_size;
  vec4 c = texture(u_tex, v_uv);
  vec3 b = (texture(u_tex, v_uv + vec2(t.x, 0.0)).rgb + texture(u_tex, v_uv - vec2(t.x, 0.0)).rgb
          + texture(u_tex, v_uv + vec2(0.0, t.y)).rgb + texture(u_tex, v_uv - vec2(0.0, t.y)).rgb) * 0.25;
  o = vec4(clamp(c.rgb + (c.rgb - b) * u_amount, 0.0, 1.0), c.a);
}`;

export const BRIGHTPASS_FRAG = `${HEAD}
uniform sampler2D u_tex;
uniform float u_threshold;
${COMMON}
void main() {
  vec4 c = texture(u_tex, v_uv);
  float k = smoothstep(u_threshold, min(u_threshold + 0.25, 1.0001), lum(c.rgb));
  o = vec4(c.rgb * k, c.a * k);
}`;

/** out = base + glow * intensity (screen-ish add). */
export const ADD_FRAG = `${HEAD}
uniform sampler2D u_tex;
uniform sampler2D u_tex2;
uniform float u_amount;
void main() {
  vec4 a = texture(u_tex, v_uv);
  vec4 g = texture(u_tex2, v_uv);
  vec3 add = g.rgb * g.a * u_amount;
  float alpha = clamp(a.a + g.a * u_amount * (1.0 - a.a), 0.0, 1.0);
  vec3 rgb = (a.rgb * a.a + add) / max(alpha, 0.0001);
  o = vec4(clamp(rgb, 0.0, 1.0), alpha);
}`;

export const EDGE_FRAG = `${HEAD}
uniform sampler2D u_tex;
uniform vec2 u_size;
uniform float u_amount;
${COMMON}
float L(vec2 o2) { return lum(texture(u_tex, v_uv + o2 / u_size).rgb); }
void main() {
  vec4 c = texture(u_tex, v_uv);
  float gx = -L(vec2(-1, -1)) - 2.0 * L(vec2(-1, 0)) - L(vec2(-1, 1)) + L(vec2(1, -1)) + 2.0 * L(vec2(1, 0)) + L(vec2(1, 1));
  float gy = -L(vec2(-1, -1)) - 2.0 * L(vec2(0, -1)) - L(vec2(1, -1)) + L(vec2(-1, 1)) + 2.0 * L(vec2(0, 1)) + L(vec2(1, 1));
  float e = clamp(length(vec2(gx, gy)), 0.0, 1.0);
  o = vec4(mix(c.rgb, vec3(1.0 - e), u_amount), c.a);
}`;

export const EMBOSS_FRAG = `${HEAD}
uniform sampler2D u_tex;
uniform vec2 u_size;
uniform float u_amount;
${COMMON}
void main() {
  vec2 t = 1.0 / u_size;
  vec4 c = texture(u_tex, v_uv);
  float e = 0.5 + 2.0 * (lum(texture(u_tex, v_uv - t).rgb) - lum(texture(u_tex, v_uv + t).rgb));
  o = vec4(mix(c.rgb, vec3(clamp(e, 0.0, 1.0)), u_amount), c.a);
}`;

/** UV remaps. mode 0 flip(a.x h, a.y v), 1 mirror(a.x: 0 horizontal, 1 vertical), 2 skew(a.x, a.y rad), 3 pixelate(a.x px). */
export const WARP_FRAG = `${HEAD}
uniform sampler2D u_tex;
uniform vec2 u_size;
uniform int u_mode;
uniform vec4 u_a;
void main() {
  vec2 uv = v_uv;
  if (u_mode == 0) {
    if (u_a.x > 0.5) uv.x = 1.0 - uv.x;
    if (u_a.y > 0.5) uv.y = 1.0 - uv.y;
  } else if (u_mode == 1) {
    if (u_a.x < 0.5) { if (uv.x > 0.5) uv.x = 1.0 - uv.x; }
    else { if (uv.y < 0.5) uv.y = 1.0 - uv.y; }
  } else if (u_mode == 2) {
    vec2 p = (uv - 0.5) * u_size;
    p.y = -p.y;
    p.x -= tan(u_a.x) * p.y;
    p.y -= tan(u_a.y) * p.x;
    p.y = -p.y;
    uv = p / u_size + 0.5;
  } else if (u_mode == 3) {
    vec2 cell = vec2(u_a.x) / u_size;
    uv = (floor(uv / cell) + 0.5) * cell;
  }
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) o = vec4(0.0);
  else o = texture(u_tex, uv);
}`;

// ---------------------------------------------------------------- masks

export const MAX_MASK_POINTS = 64;

/** Renders one mask's coverage into the R channel (accumulated with MAX blending). */
export const MASK_FRAG = `${HEAD}
uniform vec2 u_size;
uniform int u_shape;
uniform int u_n;
uniform vec2 u_pts[${MAX_MASK_POINTS}];
uniform vec2 u_bmin;
uniform vec2 u_bmax;
uniform float u_feather;
uniform float u_expansion;
uniform float u_opacity;
uniform int u_invert;
void main() {
  vec2 p = vec2(v_uv.x, 1.0 - v_uv.y) * u_size;
  float sd;
  vec2 cen = (u_bmin + u_bmax) * 0.5;
  vec2 r = max((u_bmax - u_bmin) * 0.5, vec2(1.0));
  if (u_shape == 0) {
    float k = length((p - cen) / r);
    sd = (k - 1.0) * min(r.x, r.y);
  } else if (u_shape == 1) {
    vec2 dq = abs(p - cen) - r;
    sd = length(max(dq, 0.0)) + min(max(dq.x, dq.y), 0.0);
  } else {
    float dd = dot(p - u_pts[0], p - u_pts[0]);
    float s = 1.0;
    for (int i = 0; i < ${MAX_MASK_POINTS}; i++) {
      if (i >= u_n) break;
      int j = i == 0 ? u_n - 1 : i - 1;
      vec2 vi = u_pts[i];
      vec2 vj = u_pts[j];
      vec2 e = vj - vi;
      vec2 w = p - vi;
      vec2 bq = w - e * clamp(dot(w, e) / max(dot(e, e), 0.0001), 0.0, 1.0);
      dd = min(dd, dot(bq, bq));
      bvec3 cond = bvec3(p.y >= vi.y, p.y < vj.y, e.x * w.y > e.y * w.x);
      if (all(cond) || all(not(cond))) s = -s;
    }
    sd = s * sqrt(dd);
  }
  sd -= u_expansion;
  float f = max(u_feather, 0.75);
  float v = 1.0 - smoothstep(-f * 0.5, f * 0.5, sd);
  if (u_invert == 1) v = 1.0 - v;
  o = vec4(v * u_opacity);
}`;

export const APPLY_MASK_FRAG = `${HEAD}
uniform sampler2D u_tex;
uniform sampler2D u_mask;
void main() {
  vec4 c = texture(u_tex, v_uv);
  o = vec4(c.rgb, c.a * texture(u_mask, v_uv).r);
}`;

// ---------------------------------------------------------------- layer composite + blend modes

export const BLEND_MODES: BlendMode[] = [
  "normal", "darken", "multiply", "colorBurn", "lighten", "screen", "colorDodge", "add", "overlay",
  "softLight", "hardLight", "difference", "exclusion", "hue", "saturation", "color", "luminosity",
];

export function blendModeIndex(m: BlendMode | undefined): number {
  const i = BLEND_MODES.indexOf(m ?? "normal");
  return i < 0 ? 0 : i;
}

const BLEND_LIB = `
float bOverlay(float b, float s) { return b < 0.5 ? 2.0 * b * s : 1.0 - 2.0 * (1.0 - b) * (1.0 - s); }
float bDodge(float b, float s) { return b <= 0.0 ? 0.0 : (s >= 1.0 ? 1.0 : min(1.0, b / (1.0 - s))); }
float bBurn(float b, float s) { return b >= 1.0 ? 1.0 : (s <= 0.0 ? 0.0 : 1.0 - min(1.0, (1.0 - b) / s)); }
float bSoft(float b, float s) {
  if (s <= 0.5) return b - (1.0 - 2.0 * s) * b * (1.0 - b);
  float dd = b <= 0.25 ? ((16.0 * b - 12.0) * b + 4.0) * b : sqrt(b);
  return b + (2.0 * s - 1.0) * (dd - b);
}
float bl(vec3 c) { return dot(c, vec3(0.3, 0.59, 0.11)); }
vec3 clipColor(vec3 c) {
  float l = bl(c); float n = min(c.r, min(c.g, c.b)); float x = max(c.r, max(c.g, c.b));
  if (n < 0.0) c = l + (c - l) * l / max(l - n, 0.00001);
  if (x > 1.0) c = l + (c - l) * (1.0 - l) / max(x - l, 0.00001);
  return c;
}
vec3 setLum(vec3 c, float l) { return clipColor(c + (l - bl(c))); }
float sat(vec3 c) { return max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b)); }
vec3 setSat(vec3 c, float s) {
  float mx = max(c.r, max(c.g, c.b)); float mn = min(c.r, min(c.g, c.b));
  return mx > mn ? (c - mn) * s / (mx - mn) : vec3(0.0);
}
vec3 blendFn(int m, vec3 b, vec3 s) {
  if (m == 1) return min(b, s);
  if (m == 2) return b * s;
  if (m == 3) return vec3(bBurn(b.r, s.r), bBurn(b.g, s.g), bBurn(b.b, s.b));
  if (m == 4) return max(b, s);
  if (m == 5) return b + s - b * s;
  if (m == 6) return vec3(bDodge(b.r, s.r), bDodge(b.g, s.g), bDodge(b.b, s.b));
  if (m == 7) return min(b + s, 1.0);
  if (m == 8) return vec3(bOverlay(b.r, s.r), bOverlay(b.g, s.g), bOverlay(b.b, s.b));
  if (m == 9) return vec3(bSoft(b.r, s.r), bSoft(b.g, s.g), bSoft(b.b, s.b));
  if (m == 10) return vec3(bOverlay(s.r, b.r), bOverlay(s.g, b.g), bOverlay(s.b, b.b));
  if (m == 11) return abs(b - s);
  if (m == 12) return b + s - 2.0 * b * s;
  if (m == 13) return setLum(setSat(s, sat(b)), bl(b));
  if (m == 14) return setLum(setSat(b, sat(s)), bl(b));
  if (m == 15) return setLum(s, bl(b));
  if (m == 16) return setLum(b, bl(s));
  return s;
}
`;

/**
 * Composite a layer onto the destination with a full affine transform, crop,
 * opacity and blend mode. u_m maps destination pixel coords (gl_FragCoord) to
 * layer uv. Destination is read from u_dst (ping-pong).
 */
export const LAYER_FRAG = `${HEAD}
uniform sampler2D u_dst;
uniform sampler2D u_src;
uniform mat3 u_m;
uniform vec4 u_crop;
uniform float u_opacity;
uniform int u_mode;
${BLEND_LIB}
void main() {
  vec4 dst = texture(u_dst, v_uv);
  vec2 uv = (u_m * vec3(gl_FragCoord.xy, 1.0)).xy;
  vec2 fw = max(fwidth(uv), vec2(0.000001));
  vec2 lo = smoothstep(u_crop.xy - fw * 0.5, u_crop.xy + fw * 0.5, uv);
  vec2 hi = 1.0 - smoothstep(u_crop.zw - fw * 0.5, u_crop.zw + fw * 0.5, uv);
  float cov = lo.x * lo.y * hi.x * hi.y;
  vec4 src = texture(u_src, clamp(uv, 0.0, 1.0));
  float sa = clamp(src.a * cov * u_opacity, 0.0, 1.0);
  if (sa <= 0.0) { o = dst; return; }
  vec3 cb = clamp(dst.rgb, 0.0, 1.0);
  float ab = clamp(dst.a, 0.0, 1.0);
  vec3 cs = clamp(src.rgb, 0.0, 1.0);
  vec3 csx = mix(cs, clamp(blendFn(u_mode, cb, cs), 0.0, 1.0), ab);
  float ao = sa + ab * (1.0 - sa);
  vec3 co = (sa * csx + (1.0 - sa) * ab * cb) / max(ao, 0.00001);
  o = vec4(co, ao);
}`;

// ---------------------------------------------------------------- transitions

export const TRANSITION_INDEX: Partial<Record<TransitionType, number>> = {
  crossDissolve: 0, dipToBlack: 1, dipToWhite: 2, filmDissolve: 3, additiveDissolve: 4,
  wipeLeft: 5, wipeRight: 6, wipeUp: 7, wipeDown: 8,
  slideLeft: 9, slideRight: 10, slideUp: 11, slideDown: 12,
  pushLeft: 13, pushRight: 14, pushUp: 15, pushDown: 16,
  irisRound: 17, irisBox: 18, zoomIn: 19, zoomOut: 20, barnDoors: 21, crossZoom: 22, whip: 23,
};

/**
 * Two-input transition. q = top-left-origin normalized position. All
 * directions name the MOVEMENT direction (wipeLeft: edge travels leftwards,
 * B is revealed from the right) matching the ffmpeg xfade names used by export.
 */
export const TRANSITION_FRAG = `${HEAD}
uniform sampler2D u_a;
uniform sampler2D u_b;
uniform float u_p;
uniform int u_type;
uniform vec2 u_size;
vec4 TA(vec2 q) { if (q.x < 0.0 || q.y < 0.0 || q.x > 1.0 || q.y > 1.0) return vec4(0.0); return texture(u_a, vec2(q.x, 1.0 - q.y)); }
vec4 TB(vec2 q) { if (q.x < 0.0 || q.y < 0.0 || q.x > 1.0 || q.y > 1.0) return vec4(0.0); return texture(u_b, vec2(q.x, 1.0 - q.y)); }
vec4 mixS(vec4 a, vec4 b, float t) {
  // straight-alpha aware mix
  vec4 pa = vec4(a.rgb * a.a, a.a); vec4 pb = vec4(b.rgb * b.a, b.a);
  vec4 m = mix(pa, pb, t);
  return m.a > 0.0001 ? vec4(m.rgb / m.a, m.a) : vec4(0.0);
}
vec4 over(vec4 top, vec4 bot) {
  float ao = top.a + bot.a * (1.0 - top.a);
  vec3 c = (top.rgb * top.a + bot.rgb * bot.a * (1.0 - top.a)) / max(ao, 0.0001);
  return vec4(c, ao);
}
float edge(float x) { float aa = 1.5 / max(u_size.x, u_size.y); return smoothstep(-aa, aa, x); }
void main() {
  vec2 q = vec2(v_uv.x, 1.0 - v_uv.y);
  float p = clamp(u_p, 0.0, 1.0);
  vec4 A = TA(q); vec4 B = TB(q);
  int t = u_type;
  vec4 r;
  if (t == 0) r = mixS(A, B, p);
  else if (t == 1 || t == 2) {
    vec4 k = t == 1 ? vec4(0.0, 0.0, 0.0, 1.0) : vec4(1.0);
    r = p < 0.5 ? mixS(A, k, p * 2.0) : mixS(k, B, p * 2.0 - 1.0);
  } else if (t == 3) {
    vec4 la = vec4(pow(A.rgb, vec3(2.2)), A.a); vec4 lb = vec4(pow(B.rgb, vec3(2.2)), B.a);
    vec4 m = mixS(la, lb, p);
    r = vec4(pow(m.rgb, vec3(1.0 / 2.2)), m.a);
  } else if (t == 4) {
    vec4 pa = vec4(A.rgb * A.a, A.a) * min(1.0, 2.0 - 2.0 * p);
    vec4 pb = vec4(B.rgb * B.a, B.a) * min(1.0, 2.0 * p);
    vec4 m = min(pa + pb, vec4(1.0));
    r = m.a > 0.0001 ? vec4(min(m.rgb / m.a, vec3(1.0)), m.a) : vec4(0.0);
  } else if (t == 5) r = mixS(A, B, edge(q.x - (1.0 - p)));
  else if (t == 6) r = mixS(A, B, edge(p - q.x));
  else if (t == 7) r = mixS(A, B, edge(q.y - (1.0 - p)));
  else if (t == 8) r = mixS(A, B, edge(p - q.y));
  else if (t >= 9 && t <= 16) {
    bool push = t >= 13;
    int dir = push ? t - 13 : t - 9;
    vec2 off = dir == 0 ? vec2(1.0 - p, 0.0) : dir == 1 ? vec2(p - 1.0, 0.0) : dir == 2 ? vec2(0.0, 1.0 - p) : vec2(0.0, p - 1.0);
    vec2 aoff = dir == 0 ? vec2(-p, 0.0) : dir == 1 ? vec2(p, 0.0) : dir == 2 ? vec2(0.0, -p) : vec2(0.0, p);
    vec4 b2 = TB(q - off);
    vec4 a2 = push ? TA(q - aoff) : A;
    r = over(b2, a2);
  } else if (t == 17) {
    float asp = u_size.x / max(u_size.y, 1.0);
    vec2 d = (q - 0.5) * vec2(asp, 1.0);
    float maxR = 0.5 * sqrt(asp * asp + 1.0);
    r = mixS(A, B, edge(p * maxR - length(d)));
  } else if (t == 18) {
    vec2 d = abs(q - 0.5);
    r = mixS(A, B, edge(p * 0.5 - max(d.x, d.y)));
  } else if (t == 19) {
    vec4 az = TA((q - 0.5) / (1.0 + p * 1.5) + 0.5);
    r = mixS(az, B, smoothstep(0.3, 1.0, p));
  } else if (t == 20) {
    float s = max(1.0 - p, 0.0001);
    vec4 az = TA((q - 0.5) / s + 0.5);
    r = over(az * vec4(1.0, 1.0, 1.0, 1.0 - smoothstep(0.7, 1.0, p)), B);
  } else if (t == 21) r = mixS(A, B, edge(p * 0.5 - abs(q.x - 0.5)));
  else if (t == 22) {
    float strength = sin(p * 3.14159265) * 0.35;
    float m = smoothstep(0.35, 0.65, p);
    vec4 acc = vec4(0.0);
    for (int i = 0; i < 16; i++) {
      float k = 1.0 - strength * float(i) / 15.0;
      vec2 qq = (q - 0.5) * k + 0.5;
      vec4 s = mixS(TA(qq), TB(qq), m);
      acc += vec4(s.rgb * s.a, s.a);
    }
    acc /= 16.0;
    r = acc.a > 0.0001 ? vec4(acc.rgb / acc.a, acc.a) : vec4(0.0);
  } else {
    float strength = sin(p * 3.14159265) * 0.12;
    float e = p * p * (3.0 - 2.0 * p);
    vec4 acc = vec4(0.0);
    for (int i = 0; i < 16; i++) {
      float dx = strength * (float(i) / 15.0 - 0.5);
      vec2 qa = vec2(q.x + e + dx, q.y);
      vec4 s = qa.x <= 1.0 ? TA(qa) : TB(vec2(qa.x - 1.0, q.y));
      acc += vec4(s.rgb * s.a, s.a);
    }
    acc /= 16.0;
    r = acc.a > 0.0001 ? vec4(acc.rgb / acc.a, acc.a) : vec4(0.0);
  }
  o = r;
}`;

/** All static programs (for precompilation and tests). */
export const STATIC_FRAGS = {
  copy: COPY_FRAG, output: OUTPUT_FRAG, blur: BLUR_FRAG, sharpen: SHARPEN_FRAG, brightpass: BRIGHTPASS_FRAG,
  add: ADD_FRAG, edge: EDGE_FRAG, emboss: EMBOSS_FRAG, warp: WARP_FRAG, mask: MASK_FRAG, applyMask: APPLY_MASK_FRAG,
  layer: LAYER_FRAG, transition: TRANSITION_FRAG,
} as const;
