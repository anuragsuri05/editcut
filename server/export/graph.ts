// Pure render planner: turns a Project/Sequence + ExportSettings into a list of
// ffmpeg invocations (nested-sequence pre-renders, loudness analysis, encode passes).
//
// Composition model (mirrors Premiere):
//   base canvas (sequence background color, or transparent for nested renders)
//   → for each video track bottom→top:
//       runs of clips joined by two-sided transitions are rendered as full-frame
//       RGBA layers and chained with `xfade`; isolated clips are overlaid directly
//       as positioned sprites. Adjustment layers re-process the composite below
//       them for their time range. Non-normal blend modes use blend+maskedmerge.
//   → burned-in captions on top.
// Per clip: source (accurate -ss/-t seek with transition handles) → reverse →
//   speed (setpts) → fps conform → effects (EFFECTS primitives) → masks → crop
//   → opacity (static or keyframed via sendcmd) → Motion (scale/rotation/position/
//   anchor; static via scale/rotate/overlay expressions, animated via per-frame
//   perspective warp).
// Audio: per clip atrim/speed/reverse/effects/volume keyframes/pan, acrossfade
//   runs, adelay placement, track volume/pan, mute/solo, amix, master volume,
//   optional two-pass loudnorm.
import path from "node:path";
import type { Clip, ExportSettings, MediaAsset, MotionProps, Project, Sequence, Track, Transition } from "../../shared/types";
import { compileEffect, isVideoPrimitive, TRANSITION_MAP, type AudioPrimitive, type VideoPrimitive } from "../../shared/effects";
import { evalParam } from "../../shared/params";
import { sequenceDuration, tracksOfKind, transitionSpan } from "../../shared/ops";
import { Graph } from "./filtergraph";
import { fpsRational, fpsValue, isAnimated, num, paramExpr, paramRange, ffColor } from "./expr";
import { applyVideoPrims, type VState } from "./videoFx";
import { atempoChain, audioPrimFilters } from "./audioFx";
import { captionsText, exportRangeOf } from "../../shared/exportPresets";
import { encoderArgs, finalVideoFilters, finalAudioFilters, type EncoderCaps } from "./encode";

// ------------------------------------------------------------------ public types

export interface LoudnormMeasure {
  input_i: string;
  input_tp: string;
  input_lra: string;
  input_thresh: string;
  target_offset: string;
}

export interface StepContext {
  loudnorm?: LoudnormMeasure;
}

export interface RenderStep {
  label: string;
  /** Seconds of output this step processes (for progress). */
  duration: number;
  /** Relative cost for overall progress. */
  weight: number;
  build: (ctx: StepContext) => { args: string[]; files: { path: string; content: string }[] };
  parse?: "loudnorm";
}

export interface RenderPlan {
  steps: RenderStep[];
  duration: number;
  outputPath: string;
  sidecars: { path: string; content: string }[];
  warnings: string[];
  range: [number, number];
}

export interface BuildOptions {
  tmpDir: string;
  outputPath: string;
  /** clipId → absolute PNG path of the client-rendered generator/caption graphic. */
  graphics: Record<string, string>;
  /** Returns an existing absolute path for an asset, or null if offline. */
  resolveAssetPath: (a: MediaAsset) => string | null;
  caps?: EncoderCaps;
  /** Threads hint etc. */
  ffmpegExtra?: string[];
}

// ------------------------------------------------------------------ internals

interface Source {
  kind: "file" | "image" | "color" | "bars";
  path?: string;
  color?: string;
  w: number;
  h: number;
  duration: number; // Infinity for stills
  hasVideo: boolean;
  hasAudio: boolean;
  audioChannels: number;
  alpha: boolean;
}

interface Ctx {
  project: Project;
  opts: BuildOptions;
  steps: RenderStep[];
  nested: Map<string, Source>;
  depth: number;
  warnings: string[];
}

interface TrackClipPlan {
  clip: Clip;
  startF: number;
  endF: number;
  preF: number;
  postF: number;
  head?: { tr: Transition; s0F: number; s1F: number };
  tail?: { tr: Transition; s0F: number; s1F: number };
  /** Two-sided transition to the next clip in the run. */
  next?: { tr: Transition; s0F: number; s1F: number };
}

type Run = TrackClipPlan[];

const EPSF = 0.5;

function frames(t: number, fv: number): number {
  return Math.round(t * fv + 1e-7);
}

/** Group a track's clips into runs joined by two-sided transitions and compute handles. */
function planTrack(seq: Sequence, track: Track, clips: Clip[], fv: number): Run[] {
  const list = clips
    .filter((c) => c.trackId === track.id)
    .sort((a, b) => a.start - b.start)
    .map<TrackClipPlan>((c) => ({ clip: c, startF: frames(c.start, fv), endF: frames(c.start + c.duration, fv), preF: 0, postF: 0 }))
    .filter((p) => p.endF > p.startF);
  const byId = new Map(list.map((p) => [p.clip.id, p]));
  for (const tr of seq.transitions) {
    if (tr.trackId !== track.id || tr.duration <= 0) continue;
    const A = tr.clipAId ? byId.get(tr.clipAId) : undefined;
    const B = tr.clipBId ? byId.get(tr.clipBId) : undefined;
    let [s0, s1] = transitionSpan(tr);
    let s0F = frames(s0, fv), s1F = frames(s1, fv);
    if (A && B && Math.abs(A.endF - B.startF) <= EPSF && !A.next) {
      s0F = Math.max(s0F, A.startF + 1);
      s1F = Math.min(s1F, B.endF - 1);
      if (s1F - s0F < 1) continue;
      A.next = { tr, s0F, s1F };
      A.postF = Math.max(0, s1F - A.endF);
      B.preF = Math.max(0, B.startF - s0F);
    } else if (A && (!B || tr.alignment === "end" || !tr.clipBId) && !A.tail) {
      s0F = Math.max(s0F, A.startF);
      s1F = Math.min(s1F, A.endF);
      if (s1F - s0F < 1) {
        // one-sided transition centered on the edge: keep the in-clip half
        s0F = Math.max(A.startF, A.endF - frames(tr.duration, fv));
        s1F = A.endF;
      }
      if (s1F - s0F >= 1) A.tail = { tr, s0F, s1F };
    } else if (B && !B.head) {
      s0F = Math.max(s0F, B.startF);
      s1F = Math.min(s1F, B.endF);
      if (s1F - s0F < 1) {
        s0F = B.startF;
        s1F = Math.min(B.endF, B.startF + frames(tr.duration, fv));
      }
      if (s1F - s0F >= 1) B.head = { tr, s0F, s1F };
    }
  }
  const runs: Run[] = [];
  let cur: Run = [];
  for (const p of list) {
    cur.push(p);
    if (!p.next) {
      runs.push(cur);
      cur = [];
    }
  }
  if (cur.length) runs.push(cur);
  return runs;
}

// ------------------------------------------------------------------ sources

function sourceFor(ctx: Ctx, clip: Clip, seq: Sequence): Source | null {
  const W = seq.settings.width, H = seq.settings.height;
  const gfx = ctx.opts.graphics[clip.id];
  if (clip.caption) {
    return gfx ? { kind: "image", path: gfx, w: W, h: H, duration: Infinity, hasVideo: true, hasAudio: false, audioChannels: 0, alpha: true } : null;
  }
  if (clip.generator) {
    const gen = clip.generator;
    if (gen.kind === "adjustmentLayer") return null;
    if (gfx) return { kind: "image", path: gfx, w: W, h: H, duration: Infinity, hasVideo: true, hasAudio: false, audioChannels: 0, alpha: true };
    if (gen.kind === "colorMatte") return { kind: "color", color: gen.color, w: W, h: H, duration: Infinity, hasVideo: true, hasAudio: false, audioChannels: 0, alpha: false };
    if (gen.kind === "blackVideo") return { kind: "color", color: "#000000", w: W, h: H, duration: Infinity, hasVideo: true, hasAudio: false, audioChannels: 0, alpha: false };
    if (gen.kind === "bars") return { kind: "bars", w: W, h: H, duration: Infinity, hasVideo: true, hasAudio: false, audioChannels: 0, alpha: false };
    ctx.warnings.push(`Graphic "${clip.name}" was not rendered by the client; skipped.`);
    return null;
  }
  if (clip.sequenceId) {
    return nestedSource(ctx, clip.sequenceId);
  }
  if (clip.assetId) {
    const a = ctx.project.media[clip.assetId];
    if (!a) {
      ctx.warnings.push(`Clip "${clip.name}": media missing from project.`);
      return null;
    }
    const p = ctx.opts.resolveAssetPath(a);
    if (!p) {
      ctx.warnings.push(`Clip "${clip.name}": media offline (${a.path}).`);
      return null;
    }
    const isImage = a.kind === "image";
    return {
      kind: isImage ? "image" : "file",
      path: p,
      w: a.width || W,
      h: a.height || H,
      duration: isImage ? Infinity : a.duration || Infinity,
      hasVideo: a.hasVideo,
      hasAudio: a.hasAudio,
      audioChannels: a.audioChannels ?? 2,
      alpha: isImage && /\.(png|webp|tiff?|gif)$/i.test(p),
    };
  }
  return null;
}

function nestedSource(ctx: Ctx, seqId: string): Source | null {
  const hit = ctx.nested.get(seqId);
  if (hit) return hit;
  const nseq = ctx.project.sequences[seqId];
  if (!nseq) {
    ctx.warnings.push(`Nested sequence ${seqId} not found.`);
    return null;
  }
  if (ctx.depth > 8) {
    ctx.warnings.push(`Nested sequence "${nseq.name}" too deep (cycle?); skipped.`);
    return null;
  }
  const dur = sequenceDuration(nseq);
  if (dur <= 0) return null;
  const out = path.join(ctx.opts.tmpDir, `nested_${seqId}_${ctx.nested.size}.mov`);
  const sub: Ctx = { ...ctx, depth: ctx.depth + 1 };
  const fv = fpsValue(nseq.settings.fps);
  const R: [number, number] = [0, frames(dur, fv) / fv];
  const comp = composeSequence(sub, nseq, R, { alphaBackground: true, video: true, audio: true, burnCaptions: false });
  const g = comp.graph;
  const script = path.join(ctx.opts.tmpDir, `nested_${seqId}.fc`);
  const vOut = g.chain(comp.video!, ["format=yuva444p10le"], "vout");
  const aOut = g.chain(comp.audio!, [`aresample=${nseq.settings.sampleRate}`, "aformat=sample_fmts=s16:channel_layouts=stereo"], "aout");
  const args = [
    "-y", "-hide_banner", "-nostdin", ...g.inputArgs(), "-/filter_complex", script,
    "-map", `[${vOut}]`, "-map", `[${aOut}]`,
    "-c:v", "prores_ks", "-profile:v", "4", "-pix_fmt", "yuva444p10le", "-qscale:v", "4", "-vendor", "apl0",
    "-c:a", "pcm_s16le", "-r", fpsRational(nseq.settings.fps), out,
  ];
  ctx.steps.push({
    label: `Render nested "${nseq.name}"`,
    duration: R[1],
    weight: 1.5,
    build: () => ({ args, files: [{ path: script, content: g.script() }] }),
  });
  const src: Source = {
    kind: "file", path: out, w: nseq.settings.width, h: nseq.settings.height, duration: R[1],
    hasVideo: true, hasAudio: true, audioChannels: 2, alpha: true,
  };
  ctx.nested.set(seqId, src);
  return src;
}

// ------------------------------------------------------------------ composition

interface ComposeOptions {
  alphaBackground: boolean;
  video: boolean;
  audio: boolean;
  burnCaptions: boolean;
}

interface Composition {
  graph: Graph;
  video?: string;
  audio?: string;
  duration: number;
}

export function composeSequence(ctx: Ctx, seq: Sequence, range: [number, number], co: ComposeOptions): Composition {
  const g = new Graph();
  const fr = fpsRational(seq.settings.fps);
  const fv = fpsValue(seq.settings.fps);
  const W = seq.settings.width, H = seq.settings.height;
  const R0F = frames(range[0], fv), R1F = Math.max(frames(range[1], fv), R0F + 1);
  const NF = R1F - R0F;
  const D = NF / fv;
  const SR = seq.settings.sampleRate || 48000;
  const comp: Composition = { graph: g, duration: D };

  // ---------------- video
  if (co.video) {
    const bg = co.alphaBackground ? "black@0" : ffColor(seq.settings.backgroundColor, "black");
    let cur = g.chain(null, [`color=c=${bg}:s=${W}x${H}:r=${fr}:d=${num(D + 1 / fv, 6)}`, "setsar=1", co.alphaBackground ? "format=yuva444p" : "format=yuv444p"]);
    for (const track of tracksOfKind(seq, "video")) {
      if (track.muted) continue;
      const clips = seq.clips.filter((c) => c.trackId === track.id && c.enabled !== false);
      const regular = clips.filter((c) => c.generator?.kind !== "adjustmentLayer");
      for (const run of planTrack(seq, track, regular, fv)) cur = renderVideoRun(ctx, g, seq, run, cur, R0F, R1F);
      for (const adj of clips.filter((c) => c.generator?.kind === "adjustmentLayer")) cur = applyAdjustmentLayer(g, seq, adj, cur, R0F, R1F);
    }
    if (co.burnCaptions) {
      for (const track of tracksOfKind(seq, "caption")) {
        if (track.muted) continue;
        for (const c of seq.clips.filter((x) => x.trackId === track.id && x.caption && x.enabled !== false)) {
          const p = ctx.opts.graphics[c.id];
          const s = frames(c.start, fv), e = frames(c.start + c.duration, fv);
          const a = Math.max(s, R0F), b = Math.min(e, R1F);
          if (b <= a) continue;
          if (!p) {
            ctx.warnings.push(`Caption "${c.caption?.text.slice(0, 30)}" not rendered by the client; not burned in.`);
            continue;
          }
          const idx = g.input(["-loop", "1", "-framerate", fr, "-t", num((b - a) / fv + 1 / fv), "-i", p]);
          const lay = g.chain(`${idx}:v`, ["fps=" + fr, "format=yuva444p", "setsar=1", `trim=end_frame=${b - a}`, `setpts=PTS-STARTPTS+${num((a - R0F) / fv, 9)}/TB`]);
          cur = g.chain([cur, lay], ["overlay=x=0:y=0:eof_action=pass:format=yuv444"]);
        }
      }
    }
    comp.video = g.chain(cur, [`trim=end_frame=${NF}`, "setpts=PTS-STARTPTS"]);
  }

  // ---------------- audio
  if (co.audio) {
    const audioTracks = tracksOfKind(seq, "audio");
    const anySolo = audioTracks.some((t) => t.solo);
    const mixIns: string[] = [];
    for (const track of audioTracks) {
      if (track.muted || (anySolo && !track.solo)) continue;
      const clips = seq.clips.filter((c) => c.trackId === track.id && c.enabled !== false && !c.audio?.muted);
      for (const run of planTrack(seq, track, clips, fv)) {
        const lab = renderAudioRun(ctx, g, seq, run, R0F, R1F, SR, track);
        if (lab) mixIns.push(lab);
      }
    }
    // Nested sequences placed on video tracks carry their audio (unless an audio-track clip references the same sequence).
    const audioNested = new Set(seq.clips.filter((c) => c.sequenceId && audioTracks.some((t) => t.id === c.trackId)).map((c) => c.sequenceId));
    if (!anySolo) {
      for (const track of tracksOfKind(seq, "video")) {
        const clips = seq.clips.filter((c) => c.trackId === track.id && c.sequenceId && c.enabled !== false && !audioNested.has(c.sequenceId));
        if (!clips.length) continue;
        const pseudo: Track = { ...track, volumeDb: 0, pan: 0 };
        for (const run of planTrack({ ...seq, transitions: [] }, track, clips, fv)) {
          const lab = renderAudioRun(ctx, g, seq, run, R0F, R1F, SR, pseudo);
          if (lab) mixIns.push(lab);
        }
      }
    }
    let mix: string;
    const total = Math.round(D * SR);
    if (!mixIns.length) mix = g.chain(null, [`anullsrc=r=${SR}:cl=stereo`, `atrim=end_sample=${total}`]);
    else if (mixIns.length === 1) mix = mixIns[0];
    else mix = g.chain(mixIns, [`amix=inputs=${mixIns.length}:normalize=0:duration=longest:dropout_transition=0`]);
    const master = seq.masterVolumeDb ? [`volume=${num(seq.masterVolumeDb)}dB`] : [];
    comp.audio = g.chain(mix, [...master, `aformat=sample_fmts=fltp:sample_rates=${SR}:channel_layouts=stereo`, `apad=whole_len=${total}`, `atrim=end_sample=${total}`, "asetpts=N/SR/TB"]);
  }
  return comp;
}

// ------------------------------------------------------------------ video clip

interface ClipLayer {
  label: string;
  /** "sprite": positioned with overlay x/y (expressions in local time T); "canvas": full frame. */
  mode: "sprite" | "canvas";
  x?: (T: string) => string;
  y?: (T: string) => string;
}

function videoSourceChain(ctx: Ctx, g: Graph, seq: Sequence, clip: Clip, src: Source, layerStartF: number, lenF: number): { label: string; alpha: boolean } {
  const fr = fpsRational(seq.settings.fps);
  const fv = fpsValue(seq.settings.fps);
  const len = lenF / fv;
  const pixFmt = src.alpha ? "yuva444p" : "yuv444p";
  if (src.kind === "color") {
    const c = ffColor(src.color, "black");
    const a = c.includes("@");
    return { label: g.chain(null, [`color=c=${c}:s=${src.w}x${src.h}:r=${fr}:d=${num(len + 1 / fv)}`, "setsar=1", a ? "format=yuva444p" : "format=yuv444p", `trim=end_frame=${lenF}`]), alpha: a };
  }
  if (src.kind === "bars") {
    return { label: g.chain(null, [`smptehdbars=s=${src.w}x${src.h}:r=${fr}:d=${num(len + 1 / fv)}`, "setsar=1", "format=yuv444p", `trim=end_frame=${lenF}`]), alpha: false };
  }
  if (src.kind === "image") {
    const idx = g.input(["-loop", "1", "-framerate", fr, "-t", num(len + 2 / fv), "-i", src.path!]);
    return { label: g.chain(`${idx}:v`, [`fps=${fr}`, "setsar=1", `format=${pixFmt}`, `trim=end_frame=${lenF}`, "setpts=PTS-STARTPTS"]), alpha: src.alpha };
  }
  // media file
  const speed = clip.speed > 0 ? clip.speed : 1;
  const lo = (layerStartF - frames(clip.start, fv)) / fv; // clip-local time of the first layer frame
  const dur = clip.duration;
  let wa: number, wb: number;
  if (!clip.reversed) {
    wa = clip.sourceIn + lo * speed;
    wb = clip.sourceIn + (lo + len) * speed;
  } else {
    wa = clip.sourceIn + (dur - lo - len) * speed;
    wb = clip.sourceIn + (dur - lo) * speed;
  }
  const srcDur = Number.isFinite(src.duration) ? src.duration : Infinity;
  const a = Math.max(0, wa);
  const b = Math.min(srcDur, wb + speed / fv);
  // seconds of output at the start that have no source media (clone first frame)
  let startPadSec = 0;
  if (!clip.reversed && wa < 0) startPadSec = -wa / speed;
  if (clip.reversed && wb > srcDur) startPadSec = (wb - srcDur) / speed;
  if (b - a < 1 / fv) {
    // no usable media in window: freeze nearest frame
    const t = Math.max(0, Math.min(srcDur - 1 / fv, a));
    const idx = g.input(["-ss", num(t), "-i", src.path!]);
    return { label: g.chain(`${idx}:v`, ["trim=end_frame=1", "setpts=PTS-STARTPTS", `fps=${fr}`, "setsar=1", `format=${pixFmt}`, "tpad=stop=-1:stop_mode=clone", `trim=end_frame=${lenF}`]), alpha: src.alpha };
  }
  let lab: string;
  const reverseChunk = 6; // seconds of source per reversed chunk (bounds memory of `reverse`)
  if (clip.reversed && b - a > reverseChunk * 1.5) {
    const parts: string[] = [];
    for (let e = b; e > a + 1e-6; e -= reverseChunk) {
      const s = Math.max(a, e - reverseChunk);
      const idx = g.input(["-ss", num(s), "-t", num(e - s), "-i", src.path!]);
      parts.push(g.chain(`${idx}:v`, ["setpts=PTS-STARTPTS", "reverse", "setpts=PTS-STARTPTS", `format=${pixFmt}`, "setsar=1", `fps=${fr}`]));
    }
    lab = g.chain(parts, [`concat=n=${parts.length}:v=1:a=0`]);
  } else {
    const idx = g.input(["-ss", num(a), "-t", num(b - a), "-i", src.path!]);
    lab = g.chain(`${idx}:v`, ["setpts=PTS-STARTPTS", clip.reversed && "reverse", clip.reversed && "setpts=PTS-STARTPTS", `format=${pixFmt}`, "setsar=1"]);
  }
  const startPadF = Math.round(startPadSec * fv);
  lab = g.chain(lab, [
    Math.abs(speed - 1) > 1e-6 && `setpts=(PTS-STARTPTS)/${num(speed, 9)}`,
    `fps=${fr}`,
    startPadF > 0 && `tpad=start=${startPadF}:start_mode=clone`,
    "tpad=stop=-1:stop_mode=clone",
    `trim=end_frame=${lenF}`,
    "setpts=N/FRAME_RATE/TB",
  ]);
  return { label: lab, alpha: src.alpha };
}

function hasAnimatedEffects(clip: Clip): boolean {
  return clip.effects.some((e) => e.enabled && Object.values(e.params).some((p) => isAnimated(p)));
}

function videoPrimsAt(clip: Clip, t: number): VideoPrimitive[] {
  const out: VideoPrimitive[] = [];
  for (const e of clip.effects) for (const p of compileEffect(e, t)) if (isVideoPrimitive(p)) out.push(p);
  return out;
}

/** Apply clip effects; keyframed effect params are rendered in short constant segments. */
function applyClipEffects(g: Graph, clip: Clip, input: string, st: VState, lenF: number, lo: number, fv: number): string {
  if (!clip.effects.some((e) => e.enabled)) return input;
  if (!hasAnimatedEffects(clip) || lenF < 3) return applyVideoPrims(g, input, videoPrimsAt(clip, lo + lenF / fv / 2), st);
  const K = Math.min(lenF, Math.max(2, Math.min(90, Math.ceil(lenF / Math.max(1, Math.round(fv / 15))))));
  const bounds = Array.from({ length: K + 1 }, (_, i) => Math.round((i * lenF) / K));
  const parts = g.split(input, K);
  const outs: string[] = [];
  let alphaOut = st.alpha;
  for (let i = 0; i < K; i++) {
    const s = bounds[i], e = bounds[i + 1];
    if (e <= s) continue;
    const seg = g.chain(parts[i], [`trim=start_frame=${s}:end_frame=${e}`, "setpts=PTS-STARTPTS"]);
    const sst: VState = { ...st };
    const mid = lo + (s + e) / 2 / fv;
    outs.push(applyVideoPrims(g, seg, videoPrimsAt(clip, mid), sst));
    alphaOut = alphaOut || sst.alpha;
  }
  // unused split outputs must still be consumed
  for (let i = 0; i < K; i++) if (bounds[i + 1] <= bounds[i]) g.sink(parts[i]);
  const fixed = outs.map((o) => g.chain(o, [alphaOut ? "format=yuva444p" : "format=yuv444p"]));
  st.alpha = alphaOut;
  return g.chain(fixed, [`concat=n=${fixed.length}:v=1:a=0`, "setpts=N/FRAME_RATE/TB"]);
}

/** Static mask (union of clip masks) as a gray stream of the clip's size. */
function applyMasks(g: Graph, clip: Clip, input: string, st: VState, lenF: number, fr: string): string {
  const masks = clip.masks.filter((m) => m.points.length >= 2 || (m.shape !== "polygon" && m.points.length >= 1));
  if (!masks.length) return input;
  const { w, h } = st;
  const mstreams: string[] = [];
  for (const m of masks) {
    const xs = m.points.map((p) => p.x * w), ys = m.points.map((p) => p.y * h);
    let expr: string;
    if (m.shape === "polygon" && m.points.length >= 3) {
      const terms: string[] = [];
      for (let i = 0; i < xs.length; i++) {
        const j = (i + 1) % xs.length;
        const [xi, yi, xj, yj] = [xs[i], ys[i], xs[j], ys[j]];
        if (Math.abs(yj - yi) < 1e-9) continue;
        terms.push(`abs(gt(${num(yi, 2)},Y)-gt(${num(yj, 2)},Y))*lt(X,${num((xj - xi) / (yj - yi), 6)}*(Y-${num(yi, 2)})+${num(xi, 2)})`);
      }
      expr = terms.length ? `mod(${terms.join("+")},2)` : "0";
    } else {
      const e = m.expansion || 0;
      const x0 = Math.min(...xs) - e, x1 = Math.max(...xs) + e, y0 = Math.min(...ys) - e, y1 = Math.max(...ys) + e;
      if (m.shape === "ellipse") {
        const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = Math.max(0.5, (x1 - x0) / 2), ry = Math.max(0.5, (y1 - y0) / 2);
        expr = `lte(pow((X-${num(cx, 2)})/${num(rx, 2)},2)+pow((Y-${num(cy, 2)})/${num(ry, 2)},2),1)`;
      } else expr = `between(X,${num(x0, 2)},${num(x1, 2)})*between(Y,${num(y0, 2)},${num(y1, 2)})`;
    }
    const op = Math.max(0, Math.min(1, m.opacity / 100));
    const val = m.inverted ? `(1-${expr})` : expr;
    mstreams.push(
      g.chain(null, [
        `color=c=black:s=${w}x${h}:r=${fr}:d=1`,
        "format=gray",
        "trim=end_frame=1",
        `geq=lum='${num(255 * op, 3)}*${val}'`,
        m.feather > 0.5 && `gblur=sigma=${num(m.feather / 2)}`,
        "loop=loop=-1:size=1:start=0",
        "setpts=N/FRAME_RATE/TB",
      ]),
    );
  }
  let mask = mstreams[0];
  for (let i = 1; i < mstreams.length; i++) mask = g.chain([mask, mstreams[i]], ["blend=all_mode=lighten:shortest=1"]);
  mask = g.chain(mask, [`trim=end_frame=${lenF}`]);
  const [c, a] = g.split(g.chain(input, ["format=yuva444p"]), 2);
  const al = g.chain(a, ["alphaextract", "format=gray"]);
  const combined = g.chain([al, mask], ["blend=all_mode=multiply:shortest=1"]);
  st.alpha = true;
  return g.chain([g.chain(c, ["format=yuv444p"]), combined], ["alphamerge", "format=yuva444p"]);
}

function applyCrop(g: Graph, clip: Clip, input: string, st: VState, midT: number): string {
  const m = clip.motion;
  if (!m) return input;
  const l = evalParam(m.cropLeft, midT), r = evalParam(m.cropRight, midT), t = evalParam(m.cropTop, midT), b = evalParam(m.cropBottom, midT);
  if (l <= 0 && r <= 0 && t <= 0 && b <= 0) return input;
  const { w, h } = st;
  const px = (v: number, s: number) => Math.round((Math.max(0, Math.min(100, v)) / 100) * s);
  const boxes: string[] = [];
  const box = (x: number, y: number, bw: number, bh: number) => {
    if (bw >= 1 && bh >= 1) boxes.push(`drawbox=x=${x}:y=${y}:w=${bw}:h=${bh}:color=black@0:t=fill:replace=1`);
  };
  box(0, 0, px(l, w), h);
  box(w - px(r, w), 0, px(r, w), h);
  box(0, 0, w, px(t, h));
  box(0, h - px(b, h), w, px(b, h));
  if (!boxes.length) return input;
  st.alpha = true;
  return g.chain(input, ["format=yuva444p", ...boxes]);
}

let opSeq = 0;
function applyOpacity(g: Graph, clip: Clip, input: string, st: VState, lenF: number, lo: number, fv: number): string {
  const op = clip.opacity?.opacity;
  if (!op) return input;
  if (!isAnimated(op)) {
    const v = Math.max(0, Math.min(1, evalParam(op, lo) / 100));
    if (v >= 0.999) return input;
    st.alpha = true;
    return g.chain(input, ["format=yuva444p", `lut=a='val*${num(v, 4)}'`]);
  }
  const name = `colorchannelmixer@op${opSeq++}`;
  const cmds: string[] = [];
  let last = -1;
  for (let f = 0; f < lenF; f++) {
    const v = Math.max(0, Math.min(1, evalParam(op, lo + f / fv) / 100));
    if (Math.abs(v - last) > 0.002 || f === 0) {
      cmds.push(`${num(f / fv, 5)} ${name} aa ${num(v, 4)}`);
      last = v;
    }
  }
  st.alpha = true;
  const v0 = Math.max(0, Math.min(1, evalParam(op, lo) / 100));
  return g.chain(input, ["format=rgba", `sendcmd=c='${cmds.join(";")}'`, `${name}=aa=${num(v0, 4)}`, "format=yuva444p"]);
}

interface MotionParams {
  m: MotionProps;
  animatedGeom: boolean;
}

function motionOf(clip: Clip, seq: Sequence, w: number, h: number): MotionProps {
  if (clip.motion) return clip.motion;
  const W = seq.settings.width, H = seq.settings.height;
  const P = (v: number) => ({ value: v });
  return {
    positionX: P(W / 2), positionY: P(H / 2), scale: P(100), scaleWidth: P(100), uniformScale: true, rotation: P(0),
    anchorX: P(w / 2), anchorY: P(h / 2), cropLeft: P(0), cropRight: P(0), cropTop: P(0), cropBottom: P(0),
  };
}

/** Motion transform: returns a sprite (scaled/rotated, positioned by expressions) or a full-frame canvas. */
function applyMotion(g: Graph, clip: Clip, seq: Sequence, input: string, st: VState, lenF: number, lo: number, fv: number, hq: boolean): ClipLayer | null {
  const W = seq.settings.width, H = seq.settings.height;
  const { w, h } = st;
  const m = motionOf(clip, seq, w, h);
  const mp: MotionParams = { m, animatedGeom: isAnimated(m.scale) || (!m.uniformScale && isAnimated(m.scaleWidth)) || isAnimated(m.rotation) };
  const flags = hq ? "lanczos" : "bicubic";
  const e = (p: typeof m.scale, T: string, fb: number, scale = 1) => paramExpr(p, T, fb, scale);
  const sy0 = evalParam(m.scale, lo, 100) / 100;
  const sx0 = (m.uniformScale ? evalParam(m.scale, lo, 100) : evalParam(m.scaleWidth, lo, 100)) / 100;
  const rot0 = evalParam(m.rotation, lo, 0);
  const posAnimated = isAnimated(m.positionX) || isAnimated(m.positionY) || isAnimated(m.anchorX) || isAnimated(m.anchorY);

  if (!mp.animatedGeom) {
    if (sx0 <= 0.0005 || sy0 <= 0.0005) return null;
    const px = evalParam(m.positionX, lo, W / 2), py = evalParam(m.positionY, lo, H / 2);
    const ax = evalParam(m.anchorX, lo, w / 2), ay = evalParam(m.anchorY, lo, h / 2);
    const identity = !posAnimated && w === W && h === H && Math.abs(sx0 - 1) < 1e-6 && Math.abs(sy0 - 1) < 1e-6 && Math.abs(rot0 % 360) < 1e-6 &&
      Math.abs(px - W / 2) < 0.01 && Math.abs(py - H / 2) < 0.01 && Math.abs(ax - w / 2) < 0.01 && Math.abs(ay - h / 2) < 0.01;
    if (identity) return { label: input, mode: "canvas" };
    const sw = Math.max(1, Math.round(w * sx0)), sh = Math.max(1, Math.round(h * sy0));
    const ex = sw / w, ey = sh / h; // exact scale after rounding
    const scaled = sw === w && sh === h ? input : g.chain(input, [`scale=${sw}:${sh}:flags=${flags}`]);
    const PX = (T: string) => e(m.positionX, T, W / 2), PY = (T: string) => e(m.positionY, T, H / 2);
    const AX = (T: string) => e(m.anchorX, T, w / 2), AY = (T: string) => e(m.anchorY, T, h / 2);
    if (Math.abs(rot0 % 360) < 1e-6) {
      return {
        label: scaled, mode: "sprite",
        x: (T) => `${PX(T)}-(${AX(T)})*${num(ex, 8)}`,
        y: (T) => `${PY(T)}-(${AY(T)})*${num(ey, 8)}`,
      };
    }
    const th = (rot0 * Math.PI) / 180;
    const c = Math.cos(th), s = Math.sin(th);
    const ow = Math.ceil(Math.abs(sw * c) + Math.abs(sh * s)) + 2, oh = Math.ceil(Math.abs(sw * s) + Math.abs(sh * c)) + 2;
    const rotated = g.chain(scaled, ["format=yuva444p", `rotate=a=${num(th, 8)}:ow=${ow}:oh=${oh}:c=none:bilinear=1`]);
    st.alpha = true;
    // image center offset from anchor (scaled), rotated
    const dx = (T: string) => `(${num(w / 2, 4)}-(${AX(T)}))*${num(ex, 8)}`;
    const dy = (T: string) => `(${num(h / 2, 4)}-(${AY(T)}))*${num(ey, 8)}`;
    return {
      label: rotated, mode: "sprite",
      x: (T) => `${PX(T)}+${num(c, 8)}*${dx(T)}-${num(s, 8)}*${dy(T)}-${num(ow / 2, 3)}`,
      y: (T) => `${PY(T)}+${num(s, 8)}*${dx(T)}+${num(c, 8)}*${dy(T)}-${num(oh / 2, 3)}`,
    };
  }

  // Animated scale / rotation: per-frame perspective warp onto a full-frame canvas.
  const t1 = lo + lenF / fv;
  const [, syMax] = paramRange(m.scale, lo, t1, 100);
  const [, sxMax] = m.uniformScale ? [0, syMax] : paramRange(m.scaleWidth, lo, t1, 100);
  const maxS = Math.max(0.01, Math.abs(syMax) / 100, Math.abs(sxMax) / 100);
  const k = Math.min(maxS * 1.05, (W - 4) / w, (H - 4) / h);
  const kw = Math.max(2, Math.round(w * k)), kh = Math.max(2, Math.round(h * k));
  const kx = kw / w, ky = kh / h;
  const T = `(in/${num(fv, 9)}+${num(lo, 6)})`;
  const PX = e(m.positionX, T, W / 2), PY = e(m.positionY, T, H / 2);
  const AX = e(m.anchorX, T, w / 2), AY = e(m.anchorY, T, h / 2);
  const SY = e(m.scale, T, 100, 0.01);
  const SX = m.uniformScale ? SY : e(m.scaleWidth, T, 100, 0.01);
  const TH = e(m.rotation, T, 0, Math.PI / 180);
  const corner = (u: number, v: number) => {
    const sxp = num((u - 2) / kx, 4), syp = num((v - 2) / ky, 4);
    const dx = `(${SX})*(${sxp}-(${AX}))`, dy = `(${SY})*(${syp}-(${AY}))`;
    return {
      x: `${PX}+cos(${TH})*${dx}-sin(${TH})*${dy}`,
      y: `${PY}+sin(${TH})*${dx}+cos(${TH})*${dy}`,
    };
  };
  const c0 = corner(0, 0), c1 = corner(W, 0), c2 = corner(0, H), c3 = corner(W, H);
  st.alpha = true;
  const lab = g.chain(input, [
    "format=yuva444p",
    `scale=${kw}:${kh}:flags=${flags}`,
    `pad=${W}:${H}:2:2:color=black@0`,
    `perspective=x0='${c0.x}':y0='${c0.y}':x1='${c1.x}':y1='${c1.y}':x2='${c2.x}':y2='${c2.y}':x3='${c3.x}':y3='${c3.y}':sense=destination:eval=frame:interpolation=linear`,
  ]);
  return { label: lab, mode: "canvas" };
}

/** Build one clip as a layer (sprite or canvas) of exactly lenF frames. */
function buildClipLayer(ctx: Ctx, g: Graph, seq: Sequence, clip: Clip, src: Source, layerStartF: number, lenF: number, hq: boolean): ClipLayer | null {
  const fv = fpsValue(seq.settings.fps);
  const fr = fpsRational(seq.settings.fps);
  const lo = (layerStartF - frames(clip.start, fv)) / fv;
  const s = videoSourceChain(ctx, g, seq, clip, src, layerStartF, lenF);
  const st: VState = { w: src.w, h: src.h, alpha: s.alpha };
  let lab = s.label;
  lab = applyClipEffects(g, clip, lab, st, lenF, lo, fv);
  lab = applyMasks(g, clip, lab, st, lenF, fr);
  lab = applyCrop(g, clip, lab, st, lo + lenF / fv / 2);
  lab = applyOpacity(g, clip, lab, st, lenF, lo, fv);
  const layer = applyMotion(g, clip, seq, lab, st, lenF, lo, fv, hq);
  if (!layer) {
    g.sink(lab); // fully scaled away
    return null;
  }
  if (layer.mode === "canvas" && !st.alpha && layer.label === lab && (src.w !== seq.settings.width || src.h !== seq.settings.height)) {
    layer.label = g.chain(layer.label, [`scale=${seq.settings.width}:${seq.settings.height}`]);
  }
  (layer as ClipLayer & { alpha?: boolean }).alpha = st.alpha;
  return layer;
}

/** Turn a layer into a full-frame transparent canvas (for xfade / blend modes). */
function toCanvas(g: Graph, seq: Sequence, layer: ClipLayer, lenF: number, lo: number): string {
  const W = seq.settings.width, H = seq.settings.height;
  const fr = fpsRational(seq.settings.fps);
  const fv = fpsValue(seq.settings.fps);
  if (layer.mode === "canvas") return g.chain(layer.label, ["format=yuva444p"]);
  const cv = g.chain(null, [`color=c=black@0:s=${W}x${H}:r=${fr}:d=${num(lenF / fv + 1 / fv)}`, "setsar=1", "format=yuva444p", `trim=end_frame=${lenF}`]);
  const T = `(t+${num(lo, 6)})`;
  return g.chain([cv, layer.label], [`overlay=x='${layer.x!(T)}':y='${layer.y!(T)}':eval=frame:format=yuv444:eof_action=pass`, "format=yuva444p"]);
}

const BLEND: Record<string, string | null> = {
  normal: null, darken: "darken", multiply: "multiply", colorBurn: "burn", lighten: "lighten", screen: "screen",
  colorDodge: "dodge", add: "addition", overlay: "overlay", softLight: "softlight", hardLight: "hardlight",
  difference: "difference", exclusion: "exclusion", hue: null, saturation: null, color: null, luminosity: null,
};

function renderVideoRun(ctx: Ctx, g: Graph, seq: Sequence, run: Run, comp: string, R0F: number, R1F: number): string {
  const fv = fpsValue(seq.settings.fps);
  const fr = fpsRational(seq.settings.fps);
  const hq = !!(ctx as Ctx & { hq?: boolean }).hq;
  const runStartF = run[0].startF - run[0].preF;
  const runEndF = run[run.length - 1].endF + run[run.length - 1].postF;
  if (runEndF <= R0F || runStartF >= R1F) return comp;

  const first = run[0];
  const blendMode = BLEND[first.clip.opacity?.blendMode ?? "normal"] ?? null;
  const simple = run.length === 1 && !first.head && !first.tail;

  // Single clip without transitions: clamp to the export range and overlay as a sprite.
  if (simple) {
    const c = first;
    const ls = Math.max(c.startF, R0F), le = Math.min(c.endF, R1F);
    if (le <= ls) return comp;
    const src = sourceFor(ctx, c.clip, seq);
    if (!src || !src.hasVideo) return comp;
    const lenF = le - ls;
    const layer = buildClipLayer(ctx, g, seq, c.clip, src, ls, lenF, hq);
    if (!layer) return comp;
    const lo = (ls - c.startF) / fv;
    const offS = (ls - R0F) / fv;
    if (blendMode) {
      const canvas = toCanvas(g, seq, layer, lenF, lo);
      return blendOnto(g, comp, canvas, blendMode, ls - R0F, lenF, fv);
    }
    const shifted = g.chain(layer.label, [`setpts=PTS-STARTPTS+${num(offS, 9)}/TB`]);
    if (layer.mode === "canvas") return g.chain([comp, shifted], ["overlay=x=0:y=0:eof_action=pass:format=yuv444"]);
    const T = `(t-${num(offS, 9)}+${num(lo, 6)})`;
    return g.chain([comp, shifted], [`overlay=x='${layer.x!(T)}':y='${layer.y!(T)}':eval=frame:eof_action=pass:format=yuv444`]);
  }

  // Transition run: full-frame layers chained with xfade.
  let acc: string | null = null;
  let accLenF = 0;
  for (let i = 0; i < run.length; i++) {
    const c = run[i];
    const ls = c.startF - c.preF;
    const lenF = c.endF + c.postF - ls;
    const src = sourceFor(ctx, c.clip, seq);
    let canvas: string;
    const layer = src && src.hasVideo ? buildClipLayer(ctx, g, seq, c.clip, src, ls, lenF, hq) : null;
    if (layer) canvas = toCanvas(g, seq, layer, lenF, (ls - c.startF) / fv);
    else canvas = g.chain(null, [`color=c=black@0:s=${seq.settings.width}x${seq.settings.height}:r=${fr}:d=${num(lenF / fv + 1 / fv)}`, "setsar=1", "format=yuva444p", `trim=end_frame=${lenF}`]);
    canvas = g.chain(canvas, ["setpts=N/FRAME_RATE/TB"]);
    // one-sided head transition
    if (c.head) {
      const dF = c.head.s1F - c.head.s0F;
      const offF = c.head.s0F - ls;
      canvas = oneSided(g, seq, canvas, c.head.tr, offF, dF, lenF, "in");
    }
    if (c.tail) {
      const dF = c.tail.s1F - c.tail.s0F;
      const offF = c.tail.s0F - ls;
      canvas = oneSided(g, seq, canvas, c.tail.tr, offF, dF, lenF, "out");
    }
    if (acc === null) {
      acc = canvas;
      accLenF = lenF;
    } else {
      const prev = run[i - 1].next!;
      const dF = prev.s1F - prev.s0F;
      const offF = prev.s0F - runStartF;
      const tname = xfadeName(prev.tr);
      acc = g.chain([acc, canvas], [`xfade=transition=${tname}:duration=${num(dF / fv, 6)}:offset=${num(offF / fv, 6)}`, "format=yuva444p"]);
      accLenF = offF + lenF;
    }
  }
  let out = acc!;
  // clamp to range
  const visS = Math.max(runStartF, R0F), visE = Math.min(runStartF + accLenF, R1F);
  if (visE <= visS) {
    g.sink(out);
    return comp;
  }
  out = g.chain(out, [`trim=start_frame=${visS - runStartF}:end_frame=${visE - runStartF}`, "setpts=PTS-STARTPTS"]);
  if (blendMode) return blendOnto(g, comp, out, blendMode, visS - R0F, visE - visS, fv);
  out = g.chain(out, [`setpts=PTS-STARTPTS+${num((visS - R0F) / fv, 9)}/TB`]);
  return g.chain([comp, out], ["overlay=x=0:y=0:eof_action=pass:format=yuv444"]);
}

function xfadeName(tr: Transition): string {
  const def = TRANSITION_MAP[tr.type];
  if (!def || def.kind !== "video") return "fade";
  if (tr.type === "zoomOut") return "fade";
  return def.ffmpeg || "fade";
}

/** One-sided transition at a layer edge: xfade against a transparent copy (dissolves) or a solid (dips). */
function oneSided(g: Graph, seq: Sequence, canvas: string, tr: Transition, offF: number, dF: number, lenF: number, edge: "in" | "out"): string {
  const fv = fpsValue(seq.settings.fps);
  const fr = fpsRational(seq.settings.fps);
  const W = seq.settings.width, H = seq.settings.height;
  const dip = tr.type === "dipToBlack" ? "black" : tr.type === "dipToWhite" ? "white" : null;
  const tname = dip ? "fade" : xfadeName(tr);
  const [main, cp] = dip ? [canvas, null] : g.split(canvas, 2);
  let other: string;
  if (dip) other = g.chain(null, [`color=c=${dip}:s=${W}x${H}:r=${fr}:d=${num(dF / fv + 1 / fv)}`, "setsar=1", "format=yuva444p", `trim=end_frame=${dF}`]);
  else other = g.chain(cp!, [`trim=start_frame=${edge === "in" ? offF : offF}:end_frame=${offF + dF}`, "setpts=PTS-STARTPTS", "lut=a=0"]);
  if (edge === "in") {
    // [other (d frames)] → main; to keep main aligned, prefix main's first offF frames is not supported: assume offF = 0
    const pre = offF > 0 ? g.chain(main, [`trim=start_frame=${offF}`, "setpts=PTS-STARTPTS"]) : main;
    let res = g.chain([other, pre], [`xfade=transition=${tname}:duration=${num(dF / fv, 6)}:offset=0`, "format=yuva444p"]);
    if (offF > 0) res = g.chain(res, [`tpad=start=${offF}:color=black@0`]);
    return res;
  }
  const res = g.chain([main, other], [`xfade=transition=${tname}:duration=${num(dF / fv, 6)}:offset=${num(offF / fv, 6)}`, "format=yuva444p"]);
  // after a one-sided out transition the layer is gone; keep total length
  const tailF = lenF - (offF + dF);
  return tailF > 0 ? g.chain(res, [`tpad=stop=${tailF}:color=black@0`]) : res;
}

/** Composite a full-frame RGBA layer with a blend mode over [startF, startF+lenF) (output frames). */
function blendOnto(g: Graph, comp: string, layer: string, mode: string, startF: number, lenF: number, fv: number): string {
  const [c1, c2] = g.split(comp, 2);
  const win = g.chain(c2, [`trim=start_frame=${startF}:end_frame=${startF + lenF}`, "setpts=PTS-STARTPTS", "format=gbrp"]);
  const [b1, b2] = g.split(win, 2);
  const [l1, l2] = g.split(g.chain(layer, ["format=yuva444p", "setpts=PTS-STARTPTS"]), 2);
  const lrgb = g.chain(l1, ["format=gbrp"]);
  const mask = g.chain(l2, ["alphaextract", "format=gbrp"]);
  const blended = g.chain([b1, lrgb], [`blend=all_mode=${mode}:shortest=1`]);
  const merged = g.chain([b2, blended, mask], ["maskedmerge", "format=yuv444p", `setpts=PTS-STARTPTS+${num(startF / fv, 9)}/TB`]);
  return g.chain([c1, merged], ["overlay=x=0:y=0:eof_action=pass:format=yuv444"]);
}

/** Adjustment layer: re-process the composite below for its time range. */
function applyAdjustmentLayer(g: Graph, seq: Sequence, clip: Clip, comp: string, R0F: number, R1F: number): string {
  const fv = fpsValue(seq.settings.fps);
  const fr = fpsRational(seq.settings.fps);
  const s = Math.max(frames(clip.start, fv), R0F), e = Math.min(frames(clip.start + clip.duration, fv), R1F);
  if (e <= s || !clip.effects.some((x) => x.enabled)) return comp;
  const lenF = e - s;
  const lo = (s - frames(clip.start, fv)) / fv;
  const [c1, c2] = g.split(comp, 2);
  let win = g.chain(c2, [`trim=start_frame=${s - R0F}:end_frame=${e - R0F}`, "setpts=PTS-STARTPTS", "format=yuv444p"]);
  const st: VState = { w: seq.settings.width, h: seq.settings.height, alpha: false };
  win = applyClipEffects(g, clip, win, st, lenF, lo, fv);
  win = applyMasks(g, clip, win, st, lenF, fr);
  win = applyOpacity(g, clip, win, st, lenF, lo, fv);
  win = g.chain(win, [st.alpha ? "format=yuva444p" : "format=yuv444p", `setpts=PTS-STARTPTS+${num((s - R0F) / fv, 9)}/TB`]);
  return g.chain([c1, win], ["overlay=x=0:y=0:eof_action=pass:format=yuv444"]);
}

// ------------------------------------------------------------------ audio

function audioClipChain(ctx: Ctx, g: Graph, seq: Sequence, clip: Clip, src: Source, layerStartF: number, lenF: number, SR: number): string | null {
  const fv = fpsValue(seq.settings.fps);
  const len = lenF / fv;
  const total = Math.round(len * SR);
  const speed = clip.speed > 0 ? clip.speed : 1;
  const lo = (layerStartF - frames(clip.start, fv)) / fv;
  const dur = clip.duration;
  let wa: number, wb: number;
  if (!clip.reversed) {
    wa = clip.sourceIn + lo * speed;
    wb = clip.sourceIn + (lo + len) * speed;
  } else {
    wa = clip.sourceIn + (dur - lo - len) * speed;
    wb = clip.sourceIn + (dur - lo) * speed;
  }
  const srcDur = Number.isFinite(src.duration) ? src.duration : Infinity;
  const a = Math.max(0, wa), b = Math.min(srcDur, wb + 0.05 * speed);
  if (b - a < 0.005) return g.chain(null, [`anullsrc=r=${SR}:cl=stereo`, `atrim=end_sample=${total}`]);
  let startPad = 0;
  if (!clip.reversed && wa < 0) startPad = -wa / speed;
  if (clip.reversed && wb > srcDur) startPad = (wb - srcDur) / speed;
  const idx = g.input(["-ss", num(a), "-t", num(b - a), "-i", src.path!]);
  const ch = clip.audioChannel;
  const chans = src.audioChannels || 2;
  let panIn: string | false = false;
  if (ch !== undefined && ch >= 0 && ch < chans) panIn = `pan=stereo|c0=c${ch}|c1=c${ch}`;
  else if (chans === 1) panIn = "pan=stereo|c0=c0|c1=c0";
  const f: (string | false)[] = [
    "asetpts=PTS-STARTPTS",
    `aresample=${SR}`,
    panIn,
    `aformat=sample_fmts=fltp:sample_rates=${SR}:channel_layouts=stereo`,
    clip.reversed && "areverse",
  ];
  if (Math.abs(speed - 1) > 1e-6) {
    if (clip.maintainPitch !== false) f.push(...atempoChain(speed));
    else f.push(`asetrate=${Math.round(SR * speed)}`, `aresample=${SR}`);
  }
  if (startPad > 0.0005) f.push(`adelay=delays=${Math.round(startPad * SR)}S:all=1`);
  f.push(`apad=whole_len=${total}`, `atrim=end_sample=${total}`, "asetpts=N/SR/TB");
  // effects (keyframed audio effect params use the value at the clip middle)
  const mid = lo + len / 2;
  for (const e of clip.effects) for (const p of compileEffect(e, mid)) if (!isVideoPrimitive(p)) f.push(...audioPrimFilters(p as AudioPrimitive, SR));
  // clip volume (keyframes → per-frame expression)
  const vol = clip.audio?.volumeDb;
  if (vol) {
    if (isAnimated(vol)) {
      const T = `(t+${num(lo, 6)})`;
      f.push(`volume=volume='pow(10,(${paramExpr(vol, T, 0)})/20)':eval=frame`);
    } else {
      const db = evalParam(vol, 0);
      if (Math.abs(db) > 1e-3) f.push(db <= -96 ? "volume=0" : `volume=${num(db)}dB`);
    }
  }
  const pan = clip.audio ? evalParam(clip.audio.pan, mid) : 0;
  if (Math.abs(pan) > 0.5) f.push(balance(pan));
  f.push(`aformat=sample_fmts=fltp:sample_rates=${SR}:channel_layouts=stereo`);
  return g.chain(`${idx}:a`, f);
}

/** Stereo balance (-100..100). */
function balance(pan: number): string {
  const p = Math.max(-100, Math.min(100, pan)) / 100;
  const gl = p > 0 ? 1 - p : 1, gr = p < 0 ? 1 + p : 1;
  return `pan=stereo|c0=${num(gl, 4)}*c0|c1=${num(gr, 4)}*c1`;
}

const AFADE_CURVE: Record<string, string> = { constantPower: "qsin", constantGain: "tri", exponentialFade: "exp" };

function renderAudioRun(ctx: Ctx, g: Graph, seq: Sequence, run: Run, R0F: number, R1F: number, SR: number, track: Track): string | null {
  const fv = fpsValue(seq.settings.fps);
  const runStartF = run[0].startF - run[0].preF;
  const runEndF = run[run.length - 1].endF + run[run.length - 1].postF;
  if (runEndF <= R0F || runStartF >= R1F) return null;
  const simple = run.length === 1 && !run[0].head && !run[0].tail;
  let acc: string | null = null;
  let accStartF = runStartF;
  let accLenF = 0;
  if (simple) {
    const c = run[0];
    const ls = Math.max(c.startF, R0F), le = Math.min(c.endF, R1F);
    const src = sourceFor(ctx, c.clip, seq);
    if (!src || !src.hasAudio || le <= ls) return null;
    acc = audioClipChain(ctx, g, seq, c.clip, src, ls, le - ls, SR);
    accStartF = ls;
    accLenF = le - ls;
  } else {
    for (let i = 0; i < run.length; i++) {
      const c = run[i];
      const ls = c.startF - c.preF;
      const lenF = c.endF + c.postF - ls;
      const src = sourceFor(ctx, c.clip, seq);
      let lab = src && src.hasAudio ? audioClipChain(ctx, g, seq, c.clip, src, ls, lenF, SR) : null;
      if (!lab) lab = g.chain(null, [`anullsrc=r=${SR}:cl=stereo`, `atrim=end_sample=${Math.round((lenF / fv) * SR)}`]);
      if (c.head) {
        const curve = AFADE_CURVE[c.head.tr.type] ?? "tri";
        lab = g.chain(lab, [`afade=t=in:st=${num((c.head.s0F - ls) / fv, 6)}:d=${num((c.head.s1F - c.head.s0F) / fv, 6)}:curve=${curve}`]);
      }
      if (c.tail) {
        const curve = AFADE_CURVE[c.tail.tr.type] ?? "tri";
        lab = g.chain(lab, [`afade=t=out:st=${num((c.tail.s0F - ls) / fv, 6)}:d=${num((c.tail.s1F - c.tail.s0F) / fv, 6)}:curve=${curve}`]);
      }
      if (acc === null) {
        acc = lab;
        accLenF = lenF;
      } else {
        const prev = run[i - 1].next!;
        const dF = prev.s1F - prev.s0F;
        const curve = AFADE_CURVE[prev.tr.type] ?? "qsin";
        acc = g.chain([acc, lab], [`acrossfade=d=${num(dF / fv, 6)}:c1=${curve}:c2=${curve}`]);
        accLenF = prev.s0F - runStartF + lenF;
      }
    }
    // clamp to range
    const visS = Math.max(runStartF, R0F), visE = Math.min(runStartF + accLenF, R1F);
    if (visE <= visS) return null;
    acc = g.chain(acc!, [`atrim=start_sample=${Math.round(((visS - runStartF) / fv) * SR)}:end_sample=${Math.round(((visE - runStartF) / fv) * SR)}`, "asetpts=PTS-STARTPTS"]);
    accStartF = visS;
    accLenF = visE - visS;
  }
  const tf: (string | false)[] = [];
  if (track.volumeDb) tf.push(track.volumeDb <= -96 ? "volume=0" : `volume=${num(track.volumeDb)}dB`);
  if (track.pan) tf.push(balance(track.pan));
  const off = Math.round(((accStartF - R0F) / fv) * SR);
  if (off > 0) tf.push(`adelay=delays=${off}S:all=1`);
  return g.chain(acc!, tf.length ? tf : ["anull"]);
}

// ------------------------------------------------------------------ plan

export function exportRange(seq: Sequence, s: Pick<ExportSettings, "range" | "format">): [number, number] {
  return exportRangeOf(seq, s);
}

/** Build the full render plan for an export. Throws on invalid input. */
export function buildRenderPlan(project: Project, sequenceId: string, settings: ExportSettings, opts: BuildOptions): RenderPlan {
  const seq = project.sequences[sequenceId];
  if (!seq) throw new Error(`Sequence ${sequenceId} not found`);
  const warnings: string[] = [];
  const ctx: Ctx & { hq?: boolean } = { project, opts, steps: [], nested: new Map(), depth: 0, warnings, hq: settings.useMaxRenderQuality };
  const range = exportRange(seq, settings);
  if (range[1] - range[0] <= 0) throw new Error("Nothing to export: the sequence is empty.");
  const fmt = settings.format;
  const audioOnly = fmt === "wav" || fmt === "mp3" || fmt === "aac";
  const noAudio = fmt === "gif" || fmt === "png" || settings.audioCodec === "none";
  const wantVideo = !audioOnly;
  const wantAudio = !noAudio;
  const alphaOut = fmt === "prores" && settings.proresProfile === "4444";

  const comp = composeSequence(ctx, seq, range, { alphaBackground: alphaOut, video: wantVideo, audio: wantAudio || !!settings.loudnessNormalize?.enabled, burnCaptions: settings.burnCaptions });
  const g = comp.graph;
  const D = comp.duration;
  const script = path.join(opts.tmpDir, "main.fc");
  const caps = opts.caps ?? {};

  // video tail
  let vOut: string | undefined;
  if (wantVideo && comp.video) vOut = g.chain(comp.video, finalVideoFilters(seq, settings, alphaOut), "vout");
  // audio tail: loudnorm placeholder resolved at run time
  const audioTail = (ln?: LoudnormMeasure) => finalAudioFilters(seq, settings, ln);

  const ln = settings.loudnessNormalize?.enabled && wantAudio;
  const baseInputs = g.inputArgs();
  const extra = opts.ffmpegExtra ?? [];

  if (ln) {
    const anaScript = path.join(opts.tmpDir, "loudnorm.fc");
    const tgt = settings.loudnessNormalize!;
    ctx.steps.push({
      label: "Analyze loudness",
      duration: D,
      weight: 0.4,
      parse: "loudnorm",
      build: () => {
        // analysis graph: same graph, video branch discarded
        const lines = g.script() + (vOut ? `;\n[${vOut}]nullsink` : "") + `;\n[${comp.audio}]loudnorm=I=${num(tgt.targetLufs)}:TP=${num(tgt.truePeak)}:LRA=11:print_format=json[aana]`;
        return {
          args: ["-y", "-hide_banner", "-nostdin", ...baseInputs, "-/filter_complex", anaScript, "-map", "[aana]", "-f", "null", "-"],
          files: [{ path: anaScript, content: lines }],
        };
      },
    });
  }

  const passes = encoderArgs(settings, caps, opts.tmpDir);
  const out = opts.outputPath;
  passes.forEach((pass, i) => {
    const last = i === passes.length - 1;
    ctx.steps.push({
      label: passes.length > 1 ? `Encode pass ${i + 1}/${passes.length}` : "Encode",
      duration: D,
      weight: 1,
      build: (sc) => {
        let content = g.script();
        const maps: string[] = [];
        if (vOut) maps.push("-map", `[${vOut}]`);
        if (wantAudio && comp.audio && !pass.noAudio) {
          content += `;\n[${comp.audio}]${audioTail(sc.loudnorm).join(",")}[aout]`;
          maps.push("-map", "[aout]");
        } else if (comp.audio) content += `;\n[${comp.audio}]anullsink`;
        const args = ["-y", "-hide_banner", "-nostdin", ...extra, ...baseInputs, "-/filter_complex", script, ...maps, ...pass.args];
        if (!pass.noAudio && wantAudio) args.push(...pass.audioArgs);
        args.push("-metadata", `title=${seq.name}`, "-metadata", "encoder=EditCut");
        args.push(last ? out : pass.nullOut ?? out);
        return { args, files: [{ path: script, content }] };
      },
    });
  });

  // caption sidecars
  const sidecars: { path: string; content: string }[] = [];
  if (settings.exportCaptionsSidecar !== "none") {
    const text = captionsText(seq, range, settings.exportCaptionsSidecar);
    if (text) sidecars.push({ path: out.replace(/\.[^.\/]+$/, "") + "." + settings.exportCaptionsSidecar, content: text });
    else warnings.push("No caption clips in range; sidecar not written.");
  }
  warnings.push(...g.warnings);
  return { steps: ctx.steps, duration: D, outputPath: out, sidecars, warnings, range };
}

export { captionsText };
