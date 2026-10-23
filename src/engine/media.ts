// Pools of decoded media for the compositor: one <video> per (clip) so the same
// asset can be shown twice at once (transitions, split screens), images by url,
// and 2D-canvas textures for generator/caption clips.
import type { Clip, MediaAsset, SequenceSettings } from "@shared/types";
import { drawCaption, drawGenerator } from "../render/graphics";
import { useEditor } from "../store/store";

export function mediaUrl(asset: MediaAsset): string {
  return useEditor.getState().proxiesEnabled && asset.proxyUrl ? asset.proxyUrl : asset.url;
}

export interface PooledVideo {
  el: HTMLVideoElement;
  key: string;
  url: string;
  lastUsed: number;
  /** Incremented whenever a new frame is presented / seek completes. */
  frameSeq: number;
  /** frameSeq at last texture upload (per renderer). */
  uploaded: number;
  tex: WebGLTexture | null;
  lastSeekAt: number;
  /** performance.now() when the element first failed to show the wanted frame (0 = fine). */
  stallSince: number;
  /** Last server-decoded still shown for this element (held while the next one loads). */
  lastStill: { tex: WebGLTexture | null; width: number } | null;
}

/** Server-side decoded still (ffmpeg) for a media time — fallback when a <video> can't deliver a frame. */
export function serverFrameUrl(asset: MediaAsset, t: number, width: number): string {
  const fps = asset.fps || 30;
  const tq = Math.max(0, Math.round(t * fps) / fps);
  const w = Math.max(64, Math.min(asset.width || 1920, Math.ceil(width / 128) * 128));
  return `/api/media/${asset.id}/frame?t=${tq.toFixed(4)}&w=${w}`;
}

export class MediaPool {
  videos = new Map<string, PooledVideo>();
  images = new Map<string, { img: HTMLImageElement; ready: boolean; failed: boolean; tex: WebGLTexture | null; uploaded: boolean; lastUsed: number }>();
  graphics = new Map<string, { canvas: HTMLCanvasElement; tex: WebGLTexture | null; dirty: boolean; lastUsed: number }>();
  private clock = 0;

  constructor(private onUpdate: () => void, private maxVideos = 16) {}

  tick(): void {
    this.clock++;
  }

  video(key: string, url: string): PooledVideo {
    let v = this.videos.get(key);
    if (v && v.url !== url) {
      v.el.src = url;
      v.url = url;
      v.frameSeq++;
    }
    if (!v) {
      const el = document.createElement("video");
      el.muted = true;
      el.playsInline = true;
      el.preload = "auto";
      el.crossOrigin = "anonymous";
      el.src = url;
      const pv: PooledVideo = { el, key, url, lastUsed: this.clock, frameSeq: 0, uploaded: -1, tex: null, lastSeekAt: 0, stallSince: 0, lastStill: null };
      const bump = () => {
        pv.frameSeq++;
        this.onUpdate();
      };
      el.addEventListener("loadeddata", bump);
      el.addEventListener("seeked", bump);
      const anyEl = el as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number };
      if (anyEl.requestVideoFrameCallback) {
        const loop = () => {
          pv.frameSeq++;
          if (this.videos.get(key) === pv) anyEl.requestVideoFrameCallback!(loop);
          if (el.paused) this.onUpdate();
        };
        anyEl.requestVideoFrameCallback(loop);
      } else el.addEventListener("timeupdate", bump);
      v = pv;
      this.videos.set(key, pv);
    }
    v.lastUsed = this.clock;
    return v;
  }

  image(url: string) {
    let im = this.images.get(url);
    if (!im) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      const entry = { img, ready: false, failed: false, tex: null as WebGLTexture | null, uploaded: false, lastUsed: this.clock };
      img.onload = () => {
        entry.ready = true;
        this.onUpdate();
      };
      img.onerror = () => {
        entry.failed = true;
      };
      img.src = url;
      im = entry;
      this.images.set(url, im);
    }
    im.lastUsed = this.clock;
    return im;
  }

  /** Number of server-frame requests still loading. */
  pendingFrames(): number {
    let n = 0;
    for (const [u, im] of this.images) if (!im.ready && !im.failed && u.includes("/frame?")) n++;
    return n;
  }

  /** 2D-canvas texture for a generator/caption clip at the given render scale. */
  graphic(clip: Clip, seq: SequenceSettings, scale: number) {
    const w = Math.max(1, Math.round(seq.width * scale));
    const h = Math.max(1, Math.round(seq.height * scale));
    const key = JSON.stringify([clip.generator ?? null, clip.caption ?? null, w, h]);
    let g = this.graphics.get(key);
    if (!g) {
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      if (clip.generator) drawGenerator(ctx, clip.generator, seq.width, seq.height);
      else if (clip.caption) drawCaption(ctx, clip.caption.text, seq.width, seq.height);
      g = { canvas, tex: null, dirty: true, lastUsed: this.clock };
      this.graphics.set(key, g);
    }
    g.lastUsed = this.clock;
    return g;
  }

  /** Pause/evict videos not used recently. Returns deleted textures for the GL owner to free. */
  sweep(gl: WebGL2RenderingContext | null, activeKeys: Set<string>): void {
    for (const v of this.videos.values()) if (!activeKeys.has(v.key) && !v.el.paused) v.el.pause();
    const old = [...this.videos.values()].filter((v) => !activeKeys.has(v.key)).sort((a, b) => a.lastUsed - b.lastUsed);
    while (this.videos.size > this.maxVideos && old.length) {
      const v = old.shift()!;
      this.dropVideo(v, gl);
    }
    const frames = [...this.images.entries()].filter(([u]) => u.includes("/frame?")).sort((a, b) => a[1].lastUsed - b[1].lastUsed);
    while (frames.length > 48) {
      const [u, im] = frames.shift()!;
      if (im.tex) {
        for (const v of this.videos.values()) if (v.lastStill?.tex === im.tex) v.lastStill = null;
        if (gl) gl.deleteTexture(im.tex);
      }
      this.images.delete(u);
    }
    for (const [k, g] of this.graphics) {
      if (this.clock - g.lastUsed > 600) {
        if (g.tex && gl) gl.deleteTexture(g.tex);
        this.graphics.delete(k);
      }
    }
  }

  private dropVideo(v: PooledVideo, gl: WebGL2RenderingContext | null) {
    v.el.pause();
    v.el.removeAttribute("src");
    v.el.load();
    if (v.tex && gl) gl.deleteTexture(v.tex);
    this.videos.delete(v.key);
  }

  /** Forget GL textures (context loss). */
  resetTextures(): void {
    for (const v of this.videos.values()) {
      v.tex = null;
      v.uploaded = -1;
    }
    for (const i of this.images.values()) {
      i.tex = null;
      i.uploaded = false;
    }
    for (const g of this.graphics.values()) {
      g.tex = null;
      g.dirty = true;
    }
  }

  pauseAll(): void {
    for (const v of this.videos.values()) v.el.pause();
  }
}

/** Resolve after the element has a decodable frame at its current position (or timeout). */
export function waitForFrame(el: HTMLVideoElement, timeoutMs = 3000): Promise<void> {
  return new Promise((resolve) => {
    if (el.readyState >= 2 && !el.seeking) return resolve();
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      el.removeEventListener("seeked", check);
      el.removeEventListener("loadeddata", check);
      el.removeEventListener("error", finish);
      resolve();
    };
    const check = () => {
      if (el.readyState >= 2 && !el.seeking) finish();
    };
    el.addEventListener("seeked", check);
    el.addEventListener("loadeddata", check);
    el.addEventListener("error", finish);
    setTimeout(finish, timeoutMs);
  });
}

export function waitForImage(img: HTMLImageElement, timeoutMs = 3000): Promise<void> {
  return new Promise((resolve) => {
    if (img.complete && img.naturalWidth) return resolve();
    const t = setTimeout(resolve, timeoutMs);
    img.addEventListener("load", () => { clearTimeout(t); resolve(); }, { once: true });
    img.addEventListener("error", () => { clearTimeout(t); resolve(); }, { once: true });
  });
}
