// WebGL2 compositor: renders a Sequence at time t. Per visual track bottom→top:
// source → [effects passes] → [masks] → crop + motion + opacity + blend onto the
// composite. Transitions render both sides to frame buffers and mix them;
// adjustment layers re-process the composite below; nested sequences recurse.
import type { Clip, Mask, Project, Sequence } from "@shared/types";
import { GL, type Program, type Target } from "./gl";
import { MediaPool, mediaUrl, serverFrameUrl } from "./media";
import { buildPasses, clipVideoPrimitives, colorSignature, type Pass } from "./passes";
import {
  ADD_FRAG, APPLY_MASK_FRAG, BLUR_FRAG, BRIGHTPASS_FRAG, COPY_FRAG, EDGE_FRAG, EMBOSS_FRAG, LAYER_FRAG, MASK_FRAG,
  MAX_MASK_POINTS, OUTPUT_FRAG, SHARPEN_FRAG, TRANSITION_FRAG, TRANSITION_INDEX, WARP_FRAG, blendModeIndex, colorShaderSource,
} from "./shaders";
import {
  affToMat3, clipSourceSize, evalMotion, layerUvMatrix, motionMatrix, sourceTimeUnclamped, trackDrawItem, visualTracks,
  type MotionValues,
} from "./timing";
import { evalParam } from "@shared/params";

export interface RenderOptions {
  /** Output size in device pixels. */
  width: number;
  height: number;
  /** Skip all video effects (Comparison View "frame" mode / Global FX Mute). */
  bypassEffects?: boolean;
  transparencyGrid?: boolean;
  /** Device-pixel size of a checkerboard cell. */
  gridCell?: number;
  /** True while playing: allows skipping mipmaps etc. */
  playing?: boolean;
  /** Use server-decoded stills immediately for any video element that isn't showing the wanted frame. */
  serverFrames?: boolean;
}

interface Layer {
  tex: WebGLTexture;
  srcW: number;
  srcH: number;
  /** Texture px per source px. */
  texScale: number;
}

const MAX_DEPTH = 4;
const MAX_LAYER_DIM = 4096;

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  private g: GL | null = null;
  readonly pool: MediaPool;
  /** Last rendered composite (straight alpha), kept for scopes / readback. */
  private lastFrame: Target | null = null;
  private failed = false;
  private onUpdate: () => void;
  private time = 0;
  /** Set when a needed source wasn't ready; the caller should re-render later. */
  incomplete = false;
  lastError: string | null = null;

  constructor(onUpdate: () => void, canvas?: HTMLCanvasElement) {
    this.onUpdate = onUpdate;
    this.canvas = canvas ?? document.createElement("canvas");
    this.canvas.width = 16;
    this.canvas.height = 9;
    this.pool = new MediaPool(onUpdate);
    this.canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      this.g = null;
      this.lastFrame = null;
      this.pool.resetTextures();
    });
    this.canvas.addEventListener("webglcontextrestored", () => {
      this.failed = false;
      this.onUpdate();
    });
  }

  get supported(): boolean {
    return !!this.ensure();
  }

  private ensure(): GL | null {
    if (this.g) return this.g;
    if (this.failed) return null;
    const gl = this.canvas.getContext("webgl2", { alpha: false, antialias: false, preserveDrawingBuffer: true, premultipliedAlpha: false });
    if (!gl) {
      this.failed = true;
      this.lastError = "WebGL2 is not available in this browser.";
      return null;
    }
    this.g = new GL(gl);
    return this.g;
  }

  private prog(key: string, src: string): Program {
    return this.g!.program(key, src);
  }

  /** Render `seq` at time t to this renderer's canvas. */
  render(project: Project, seq: Sequence, t: number, opts: RenderOptions): boolean {
    const g = this.ensure();
    if (!g) return false;
    const W = Math.max(2, Math.round(opts.width));
    const H = Math.max(2, Math.round(opts.height));
    if (this.canvas.width !== W) this.canvas.width = W;
    if (this.canvas.height !== H) this.canvas.height = H;
    this.time = t;
    this.incomplete = false;
    this.pool.tick();
    try {
      if (this.lastFrame) g.release(this.lastFrame);
      this.lastFrame = null;
      const comp = this.renderSequence(project, seq, t, W, H, 0, "", opts);
      this.lastFrame = comp;
      g.draw(this.prog("output", OUTPUT_FRAG), null, [["u_tex", comp.tex]], (u) => {
        g.gl.uniform1i(u("u_grid"), opts.transparencyGrid ? 1 : 0);
        g.gl.uniform1f(u("u_cell"), opts.gridCell ?? 8);
      }, [W, H]);
      g.releaseAll(new Set([comp]));
      this.lastError = null;
      return true;
    } catch (err) {
      this.lastError = String((err as Error)?.message ?? err);
      console.error("[engine] render failed", err);
      g.releaseAll();
      this.lastFrame = null;
      return false;
    }
  }

  /** Clear the canvas (no sequence). */
  renderEmpty(width: number, height: number): void {
    const g = this.ensure();
    if (!g) return;
    if (this.canvas.width !== Math.round(width)) this.canvas.width = Math.max(2, Math.round(width));
    if (this.canvas.height !== Math.round(height)) this.canvas.height = Math.max(2, Math.round(height));
    g.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    g.clear(null, 0, 0, 0, 1);
    if (this.lastFrame) g.release(this.lastFrame);
    this.lastFrame = null;
  }

  /** Read back the last frame (composited over black) at w×h. RGBA rows bottom-up. */
  readPixels(w: number, h: number): Uint8Array | null {
    const g = this.g;
    if (!g || !this.lastFrame) return null;
    const small = g.acquire(w, h);
    g.draw(this.prog("output", OUTPUT_FRAG), small, [["u_tex", this.lastFrame.tex]], (u) => {
      g.gl.uniform1i(u("u_grid"), 0);
      g.gl.uniform1f(u("u_cell"), 8);
    });
    const out = new Uint8Array(small.w * small.h * 4);
    g.gl.bindFramebuffer(g.gl.FRAMEBUFFER, small.fbo);
    g.gl.readPixels(0, 0, small.w, small.h, g.gl.RGBA, g.gl.UNSIGNED_BYTE, out);
    g.gl.bindFramebuffer(g.gl.FRAMEBUFFER, null);
    g.release(small);
    return out;
  }

  // ------------------------------------------------------------------ sequence

  private renderSequence(project: Project, seq: Sequence, t: number, W: number, H: number, depth: number, keyPrefix: string, opts: RenderOptions): Target {
    const g = this.g!;
    let comp = g.acquire(W, H);
    g.clear(comp);
    const scale = W / seq.settings.width;
    for (const track of visualTracks(seq)) {
      if (track.muted) continue;
      const item = trackDrawItem(seq, track, t);
      if (!item) continue;
      if (item.kind === "clip") {
        const clip = item.clip;
        if (clip.generator?.kind === "adjustmentLayer") {
          comp = this.applyAdjustment(project, seq, clip, t, comp, scale, opts);
          continue;
        }
        const layer = this.renderClipLayer(project, seq, clip, t, scale, depth, keyPrefix, opts);
        if (!layer) continue;
        comp = this.compositeClip(seq, clip, t, comp, layer, scale);
      } else {
        const { a, b, transition, progress } = item;
        const frameOf = (c: Clip | undefined): Target | null => {
          if (!c) return null;
          const f = g.acquire(W, H);
          g.clear(f);
          if (c.generator?.kind === "adjustmentLayer") return f;
          const layer = this.renderClipLayer(project, seq, c, t, scale, depth, keyPrefix, opts);
          if (!layer) return f;
          return this.compositeClip(seq, c, t, f, layer, scale, true);
        };
        const fa = frameOf(a);
        const fb = frameOf(b);
        const tr = g.acquire(W, H);
        g.draw(this.prog("transition", TRANSITION_FRAG), tr, [["u_a", fa?.tex ?? g.empty], ["u_b", fb?.tex ?? g.empty]], (u) => {
          g.gl.uniform1f(u("u_p"), progress);
          g.gl.uniform1i(u("u_type"), TRANSITION_INDEX[transition.type] ?? 0);
          g.gl.uniform2f(u("u_size"), W, H);
        });
        g.release(fa);
        g.release(fb);
        const out = g.acquire(W, H);
        g.draw(this.prog("layer", LAYER_FRAG), out, [["u_dst", comp.tex], ["u_src", tr.tex]], (u) => {
          g.gl.uniformMatrix3fv(u("u_m"), false, affToMat3([1 / W, 0, 0, 1 / H, 0, 0]));
          g.gl.uniform4f(u("u_crop"), 0, 0, 1, 1);
          g.gl.uniform1f(u("u_opacity"), 1);
          g.gl.uniform1i(u("u_mode"), 0);
        });
        g.release(tr);
        g.release(comp);
        comp = out;
      }
    }
    return comp;
  }

  private clipMotion(seq: Sequence, clip: Clip, t: number, srcW: number, srcH: number): MotionValues {
    return evalMotion(clip.motion, t - clip.start, srcW, srcH, seq.settings.width, seq.settings.height);
  }

  /** Draw a prepared layer with the clip's motion/crop/opacity/blend onto `dst`. Releases dst. */
  private compositeClip(seq: Sequence, clip: Clip, t: number, dst: Target, layer: Layer, scale: number, forceNormal = false): Target {
    const g = this.g!;
    const v = this.clipMotion(seq, clip, t, layer.srcW, layer.srcH);
    const opacity = clip.opacity ? evalParam(clip.opacity.opacity, t - clip.start, 100) / 100 : 1;
    const mode = forceNormal ? 0 : blendModeIndex(clip.opacity?.blendMode);
    const out = g.acquire(dst.w, dst.h);
    const m = layerUvMatrix(motionMatrix(v), layer.srcW, layer.srcH, scale, dst.h);
    g.draw(this.prog("layer", LAYER_FRAG), out, [["u_dst", dst.tex], ["u_src", layer.tex]], (u) => {
      g.gl.uniformMatrix3fv(u("u_m"), false, affToMat3(m));
      g.gl.uniform4f(u("u_crop"), v.cl, v.cb, 1 - v.cr, 1 - v.ct);
      g.gl.uniform1f(u("u_opacity"), Math.max(0, Math.min(1, opacity)));
      g.gl.uniform1i(u("u_mode"), mode);
    });
    g.release(dst);
    return out;
  }

  /** Produce the clip's processed (effects + masks) image in source space. */
  private renderClipLayer(project: Project, seq: Sequence, clip: Clip, t: number, scale: number, depth: number, keyPrefix: string, opts: RenderOptions): Layer | null {
    const g = this.g!;
    const gl = g.gl;
    const { w: srcW, h: srcH } = clipSourceSize(project, seq, clip);
    const v = this.clipMotion(seq, clip, t, srcW, srcH);
    let layerScale = Math.min(1, scale * Math.max(Math.abs(v.sx), Math.abs(v.sy), 0.05));
    layerScale = Math.min(layerScale, MAX_LAYER_DIM / Math.max(srcW, srcH));
    const LW = Math.max(1, Math.round(srcW * layerScale));
    const LH = Math.max(1, Math.round(srcH * layerScale));

    // ---- source texture
    let srcTex: WebGLTexture | null = null;
    let owned: Target | null = null;
    let srcPx = srcW; // width in texels of the source texture
    if (clip.sequenceId) {
      const nested = project.sequences[clip.sequenceId];
      if (!nested || depth >= MAX_DEPTH || nested.id === seq.id) return null;
      const tn = sourceTimeUnclamped(clip, t);
      owned = this.renderSequence(project, nested, tn, LW, LH, depth + 1, keyPrefix + clip.id + "/", opts);
      srcTex = owned.tex;
      srcPx = LW;
    } else if (clip.generator || clip.caption) {
      const gr = this.pool.graphic(clip, seq.settings, layerScale);
      if (!gr.tex) gr.tex = g.createTexture();
      if (gr.dirty) {
        g.upload(gr.tex, gr.canvas);
        gr.dirty = false;
      }
      srcTex = gr.tex;
      srcPx = gr.canvas.width;
    } else if (clip.assetId) {
      const asset = project.media[clip.assetId];
      if (!asset || asset.status === "error") return null;
      if (asset.kind === "image") {
        const im = this.pool.image(asset.url);
        if (!im.ready) {
          this.incomplete = true;
          return null;
        }
        if (!im.tex) im.tex = g.createTexture();
        if (!im.uploaded) {
          g.upload(im.tex, im.img, im.img.naturalWidth > 2 * LW);
          im.uploaded = true;
        }
        srcTex = im.tex;
        srcPx = im.img.naturalWidth;
      } else if (asset.kind === "video" && asset.hasVideo) {
        const pv = this.pool.video(keyPrefix + clip.id, mediaUrl(asset));
        const el = pv.el;
        const target = sourceTimeUnclamped(clip, t, asset.duration);
        const fps = asset.fps || 30;
        const ready = el.readyState >= 2 && !!el.videoWidth;
        // "fresh" = the element is showing (about) the wanted frame
        const fresh = ready && !el.seeking && (opts.playing ? Math.abs(el.currentTime - target) < 0.5 : Math.abs(el.currentTime - target) < 1.5 / fps);
        const now = performance.now();
        if (fresh) pv.stallSince = 0;
        else if (!pv.stallSince) pv.stallSince = now;
        if (ready && (pv.uploaded !== pv.frameSeq || !el.paused)) {
          if (!pv.tex) pv.tex = g.createTexture();
          const strongDownscale = !opts.playing && el.videoWidth > 2.2 * LW;
          g.upload(pv.tex, el, strongDownscale);
          pv.uploaded = pv.frameSeq;
        }
        if (!fresh) this.incomplete = true;
        srcTex = ready || pv.tex ? pv.tex : null;
        srcPx = el.videoWidth || srcW;
        // Fallback: the element can't deliver this frame (stalled seek, undecodable codec,
        // headless browser without a display) → use a server-decoded still for it.
        const stallMs = opts.serverFrames ? 0 : opts.playing ? 1000 : 500;
        if (!fresh && pv.stallSince && now - pv.stallSince >= stallMs) {
          const step = 0.25;
          const tq = opts.playing ? Math.round(target / step) * step : target;
          const want = (tt: number) => {
            const url = serverFrameUrl(asset, tt, Math.max(LW, 64));
            return this.pool.images.get(url) ?? (this.pool.pendingFrames() < 3 ? this.pool.image(url) : null);
          };
          const im = want(tq);
          // while playing, prefetch the next stills so they're ready when the playhead arrives
          if (opts.playing) for (let k = 1; k <= 3; k++) want(Math.min(asset.duration, tq + k * step * Math.max(1, clip.speed)));
          if (im?.ready) {
            if (!im.tex) im.tex = g.createTexture();
            if (!im.uploaded) {
              g.upload(im.tex, im.img);
              im.uploaded = true;
            }
            srcTex = im.tex;
            srcPx = im.img.naturalWidth || srcW;
            pv.lastStill = { tex: im.tex, width: srcPx };
          } else if (!ready && pv.lastStill?.tex && opts.playing) {
            srcTex = pv.lastStill.tex;
            srcPx = pv.lastStill.width;
          }
        }
      } else return null;
    }
    if (!srcTex) return null;

    const passes: Pass[] = opts.bypassEffects ? [] : buildPasses(clipVideoPrimitives(clip, t), layerScale);
    const masks = clip.masks ?? [];
    if (!passes.length && !masks.length) return { tex: srcTex, srcW, srcH, texScale: srcPx / srcW };

    // ---- copy into a layer-sized target, then process
    let cur = owned && owned.w === LW && owned.h === LH ? owned : null;
    if (!cur) {
      cur = g.acquire(LW, LH);
      g.draw(this.prog("copy", COPY_FRAG), cur, [["u_tex", srcTex]], () => {});
      g.release(owned);
    }
    cur = this.runPasses(cur, passes, layerScale);
    if (masks.length) cur = this.applyMasks(cur, masks, layerScale);
    return { tex: cur.tex, srcW, srcH, texScale: layerScale };
  }

  /** Adjustment layer: process a copy of the composite below and lay it back on top. */
  private applyAdjustment(project: Project, seq: Sequence, clip: Clip, t: number, comp: Target, scale: number, opts: RenderOptions): Target {
    void project;
    const g = this.g!;
    if (opts.bypassEffects) return comp;
    const passes = buildPasses(clipVideoPrimitives(clip, t), scale);
    if (!passes.length && !clip.masks.length) return comp;
    let cur = g.acquire(comp.w, comp.h);
    g.draw(this.prog("copy", COPY_FRAG), cur, [["u_tex", comp.tex]], () => {});
    cur = this.runPasses(cur, passes, scale);
    if (clip.masks.length) cur = this.applyMasks(cur, clip.masks, scale);
    const tex = cur.tex;
    const layer: Layer = { tex, srcW: seq.settings.width, srcH: seq.settings.height, texScale: scale };
    const out = this.compositeClip(seq, clip, t, comp, layer, scale);
    g.release(cur);
    return out;
  }

  /** Multiply alpha by the union of the masks (normalized points in frame space, px params scaled by pxScale). Consumes `cur`. */
  private applyMasks(cur: Target, masks: Mask[], pxScale: number): Target {
    const g = this.g!;
    const gl = g.gl;
    const LW = cur.w, LH = cur.h;
    const mt = g.acquire(LW, LH);
    g.clear(mt);
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.MAX);
    gl.blendFunc(gl.ONE, gl.ONE);
    const mp = this.prog("mask", MASK_FRAG);
    for (const mk of masks) {
      const pts = mk.points.slice(0, MAX_MASK_POINTS).map((p) => [p.x * LW, p.y * LH] as [number, number]);
      if (!pts.length) continue;
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
      const flat = new Float32Array(MAX_MASK_POINTS * 2);
      pts.forEach((p, i) => { flat[i * 2] = p[0]; flat[i * 2 + 1] = p[1]; });
      g.draw(mp, mt, [], (u) => {
        gl.uniform2f(u("u_size"), LW, LH);
        gl.uniform1i(u("u_shape"), mk.shape === "ellipse" ? 0 : mk.shape === "rectangle" ? 1 : pts.length >= 3 ? 2 : 1);
        gl.uniform1i(u("u_n"), pts.length);
        gl.uniform2fv(u("u_pts"), flat);
        gl.uniform2f(u("u_bmin"), Math.min(...xs), Math.min(...ys));
        gl.uniform2f(u("u_bmax"), Math.max(...xs), Math.max(...ys));
        gl.uniform1f(u("u_feather"), mk.feather * pxScale);
        gl.uniform1f(u("u_expansion"), mk.expansion * pxScale);
        gl.uniform1f(u("u_opacity"), Math.max(0, Math.min(1, mk.opacity / 100)));
        gl.uniform1i(u("u_invert"), mk.inverted ? 1 : 0);
      });
    }
    gl.disable(gl.BLEND);
    gl.blendEquation(gl.FUNC_ADD);
    const out = g.acquire(LW, LH);
    g.draw(this.prog("applyMask", APPLY_MASK_FRAG), out, [["u_tex", cur.tex], ["u_mask", mt.tex]], () => {});
    g.release(mt);
    g.release(cur);
    return out;
  }

  /** Run effect passes; consumes `input` (released when replaced). */
  private runPasses(input: Target, passes: Pass[], pxScale: number): Target {
    void pxScale;
    const g = this.g!;
    const gl = g.gl;
    let cur = input;
    const W = input.w, H = input.h;
    const step = (frag: string, key: string, set: (u: (n: string) => WebGLUniformLocation | null) => void, extra: [string, WebGLTexture][] = []): void => {
      const out = g.acquire(W, H);
      g.draw(this.prog(key, frag), out, [["u_tex", cur.tex], ...extra], set);
      g.release(cur);
      cur = out;
    };
    const blur = (sigma: number, dir: "both" | "horizontal" | "vertical") => {
      if (dir !== "vertical") step(BLUR_FRAG, "blur", (u) => { gl.uniform2f(u("u_dir"), 1 / W, 0); gl.uniform1f(u("u_sigma"), sigma); });
      if (dir !== "horizontal") step(BLUR_FRAG, "blur", (u) => { gl.uniform2f(u("u_dir"), 0, 1 / H); gl.uniform1f(u("u_sigma"), sigma); });
    };
    for (const p of passes) {
      switch (p.kind) {
        case "color": {
          const sig = colorSignature(p.ops);
          const data = new Float32Array(p.ops.length * 12);
          p.ops.forEach((o, i) => data.set(o.u.slice(0, 12), i * 12));
          step(colorShaderSource(p.ops.map((o) => o.op)), "color:" + sig, (u) => {
            gl.uniform4fv(u("u_p[0]") ?? u("u_p"), data);
            gl.uniform2f(u("u_size"), W, H);
            gl.uniform1f(u("u_time"), this.time);
          });
          break;
        }
        case "blur":
          blur(p.radius, p.direction);
          break;
        case "sharpen":
          step(SHARPEN_FRAG, "sharpen", (u) => { gl.uniform2f(u("u_size"), W, H); gl.uniform1f(u("u_amount"), p.amount); });
          break;
        case "edge":
          step(EDGE_FRAG, "edge", (u) => { gl.uniform2f(u("u_size"), W, H); gl.uniform1f(u("u_amount"), p.amount); });
          break;
        case "emboss":
          step(EMBOSS_FRAG, "emboss", (u) => { gl.uniform2f(u("u_size"), W, H); gl.uniform1f(u("u_amount"), p.amount); });
          break;
        case "warp":
          step(WARP_FRAG, "warp", (u) => {
            gl.uniform2f(u("u_size"), W, H);
            gl.uniform1i(u("u_mode"), p.mode);
            gl.uniform4f(u("u_a"), p.a[0], p.a[1], p.a[2], p.a[3]);
          });
          break;
        case "glow": {
          const base = cur;
          // bright pass into a new target without consuming base
          let glow = g.acquire(W, H);
          g.draw(this.prog("brightpass", BRIGHTPASS_FRAG), glow, [["u_tex", base.tex]], (u) => gl.uniform1f(u("u_threshold"), p.threshold));
          for (const dir of [[1 / W, 0], [0, 1 / H]] as const) {
            const o2 = g.acquire(W, H);
            g.draw(this.prog("blur", BLUR_FRAG), o2, [["u_tex", glow.tex]], (u) => { gl.uniform2f(u("u_dir"), dir[0], dir[1]); gl.uniform1f(u("u_sigma"), Math.max(0.5, p.radius)); });
            g.release(glow);
            glow = o2;
          }
          const out = g.acquire(W, H);
          g.draw(this.prog("add", ADD_FRAG), out, [["u_tex", base.tex], ["u_tex2", glow.tex]], (u) => gl.uniform1f(u("u_amount"), p.intensity));
          g.release(glow);
          g.release(base);
          cur = out;
          break;
        }
      }
    }
    return cur;
  }

  /** Pause/evict pooled media not in `activeKeys`, freeing GL textures. */
  sweep(activeKeys: Set<string>): void {
    this.pool.sweep(this.g?.gl ?? null, activeKeys);
  }

  dispose(): void {
    this.pool.pauseAll();
    this.g?.dispose();
    this.g = null;
  }
}
