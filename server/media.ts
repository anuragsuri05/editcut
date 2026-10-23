// Media pipeline: import (upload or by path), ffprobe analysis, thumbnail
// sprites, waveform peaks, browser-playable proxies, single-frame grabs and
// scene/silence detection. The analysis functions are exported so the AI agent
// and export renderer can call them server-side without going through HTTP.
//
// Every asset gets a folder MEDIA_DIR/<id>/ holding original.<ext> (uploads
// only), thumbs.jpg, waveform.json and proxy.* when one is needed. The asset
// records themselves live in memory and are mirrored to MEDIA_DIR/index.json so
// GET /api/media/:id keeps working across server restarts.
import { Router, type RequestHandler } from "express";
import multer from "multer";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import type { MediaAsset, MediaKind } from "../shared/types";
import { MEDIA_DIR, TMP_DIR } from "./config";
import { broadcast } from "./events";

// ---------------------------------------------------------------- file types

const VIDEO_EXT = new Set(["mp4", "m4v", "mov", "qt", "webm", "mkv", "avi", "mxf", "mts", "m2ts", "ts", "mpg", "mpeg", "wmv", "flv", "3gp", "ogv", "gif", "dv", "hevc", "r3d", "braw"]);
const AUDIO_EXT = new Set(["mp3", "wav", "aif", "aiff", "aifc", "m4a", "aac", "flac", "ogg", "oga", "opus", "wma", "caf", "w64", "ac3", "eac3", "amr"]);
const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "webp", "bmp", "tif", "tiff", "heic", "heif", "avif", "psd", "exr", "dpx", "tga", "svg"]);

/** Formats a Chromium <img> can display directly. */
const BROWSER_IMAGE_EXT = new Set(["png", "jpg", "jpeg", "webp", "bmp", "avif", "svg", "gif"]);
/** Codecs a Chromium <video>/<audio> element decodes. */
const BROWSER_VIDEO_CODECS = new Set(["h264", "vp8", "vp9", "av1"]);
const BROWSER_AUDIO_CODECS = new Set(["aac", "mp3", "opus", "vorbis", "flac", "pcm_s16le", "pcm_u8", "pcm_f32le", "pcm_s24le", "pcm_s32le"]);
const BROWSER_VIDEO_CONTAINERS = new Set(["mp4", "m4v", "mov", "webm"]);
const BROWSER_AUDIO_CONTAINERS = new Set(["mp3", "wav", "m4a", "aac", "flac", "ogg", "oga", "opus", "webm", "mp4"]);

/** Default still-image duration (Premiere: Preferences > Timeline > Still Image Default Duration). */
export const STILL_DURATION = 5;
const THUMB_WIDTH = 160;
const MAX_THUMBS = 120;
const PEAKS_PER_SECOND = 100;
const PROXY_MAX_WIDTH = 960;

export function extOf(p: string): string {
  return path.extname(p).slice(1).toLowerCase();
}

/** True if the file extension looks like importable media. */
export function isMediaFile(p: string): boolean {
  const e = extOf(p);
  return VIDEO_EXT.has(e) || AUDIO_EXT.has(e) || IMAGE_EXT.has(e);
}

export function mediaTypeOfExt(p: string): MediaKind | null {
  const e = extOf(p);
  if (IMAGE_EXT.has(e)) return "image";
  if (AUDIO_EXT.has(e)) return "audio";
  if (VIDEO_EXT.has(e)) return "video";
  return null;
}

// ---------------------------------------------------------------- process helpers

interface RunResult {
  stdout: Buffer;
  stderr: string;
}

/**
 * Run a command, collecting stdout as a Buffer and stderr as text. `onStderr`
 * and `onStdout` see output as it streams (progress parsing, waveform peaks).
 * When onStdout is provided stdout is not buffered.
 */
function run(
  cmd: string,
  args: string[],
  opts: { onStderr?: (chunk: string) => void; onStdout?: (chunk: Buffer) => void; allowFail?: boolean } = {},
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    const out: Buffer[] = [];
    let err = "";
    child.stdout.on("data", (b: Buffer) => (opts.onStdout ? opts.onStdout(b) : out.push(b)));
    child.stderr.on("data", (b: Buffer) => {
      const s = b.toString();
      // keep only the tail of very chatty logs (showinfo) unless the caller streams them
      err = (err + s).slice(-200_000);
      opts.onStderr?.(s);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      const res = { stdout: Buffer.concat(out), stderr: err };
      if (code === 0 || opts.allowFail) resolve(res);
      else reject(new Error(`${cmd} exited with ${code}: ${err.trim().split("\n").slice(-3).join(" | ")}`));
    });
  });
}

/** ffmpeg progress parser: maps "time=HH:MM:SS.xx" in stderr to a 0..1 fraction. */
function progressParser(duration: number, onProgress: (f: number) => void): (chunk: string) => void {
  let last = -1;
  return (chunk) => {
    const m = /time=(-?\d+):(\d+):(\d+(?:\.\d+)?)/g;
    let match: RegExpExecArray | null;
    let t = -1;
    while ((match = m.exec(chunk))) t = +match[1] * 3600 + +match[2] * 60 + +match[3];
    if (t < 0 || !duration) return;
    const f = Math.min(1, Math.max(0, t / duration));
    if (f - last >= 0.01) {
      last = f;
      onProgress(f);
    }
  };
}

// ---------------------------------------------------------------- probing

export interface ProbeResult {
  kind: MediaKind;
  duration: number;
  width?: number;
  height?: number;
  fps?: number;
  hasVideo: boolean;
  hasAudio: boolean;
  audioChannels?: number;
  sampleRate?: number;
  videoCodec?: string;
  audioCodec?: string;
  pixFmt?: string;
  formatName: string;
  sizeBytes: number;
  /** Display rotation in degrees from the stream side data (phone footage). */
  rotation: number;
}

function parseRate(r?: string): number | undefined {
  if (!r) return undefined;
  const [n, d] = r.split("/").map(Number);
  const v = d ? n / d : n;
  if (!v || !Number.isFinite(v) || v > 1000) return undefined;
  return Math.round(v * 1000) / 1000;
}

/** Run ffprobe and normalize the result into our media model. */
export async function probeMedia(file: string): Promise<ProbeResult> {
  const { stdout } = await run("ffprobe", ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file]);
  const info = JSON.parse(stdout.toString()) as {
    format?: { duration?: string; format_name?: string; size?: string };
    streams?: Array<Record<string, any>>;
  };
  const streams = info.streams ?? [];
  // Cover art in mp3/m4a shows up as a video stream with the attached_pic disposition.
  const v = streams.find((s) => s.codec_type === "video" && !s.disposition?.attached_pic);
  const a = streams.find((s) => s.codec_type === "audio");
  const ext = extOf(file);
  const formatName = info.format?.format_name ?? "";
  const imageCodec = v && /^(png|mjpeg|bmp|tiff|webp|gif|jpeg2000|psd|exr|dpx|targa|svg|heic|hevc|av1)$/.test(v.codec_name);
  const isImage = IMAGE_EXT.has(ext) || (!!v && !a && /image2|_pipe$|png|bmp|tiff|webp|svg/.test(formatName) && imageCodec);

  let duration = parseFloat(info.format?.duration ?? "") || parseFloat(v?.duration ?? a?.duration ?? "") || 0;
  let rotation = 0;
  if (v) {
    const sd = (v.side_data_list as Array<Record<string, any>> | undefined)?.find((d) => d.rotation !== undefined);
    rotation = Number(sd?.rotation ?? v.tags?.rotate ?? 0) || 0;
  }
  let width = v?.width as number | undefined;
  let height = v?.height as number | undefined;
  if (width && height && Math.abs(rotation) % 180 === 90) [width, height] = [height, width];

  const kind: MediaKind = isImage ? "image" : v ? "video" : "audio";
  if (kind === "image") duration = STILL_DURATION;
  if (!v && !a) throw new Error("No audio or video streams found");

  let fps: number | undefined;
  if (v && kind === "video") fps = parseRate(v.avg_frame_rate) ?? parseRate(v.r_frame_rate);
  // Snap near-standard rates (e.g. 29.97002997) to their canonical value.
  if (fps) for (const std of [23.976, 24, 25, 29.97, 30, 48, 50, 59.94, 60, 120]) if (Math.abs(fps - std) < 0.01) fps = std;

  let sizeBytes = Number(info.format?.size ?? 0);
  if (!sizeBytes) {
    try {
      sizeBytes = fs.statSync(file).size;
    } catch {
      /* ignore */
    }
  }
  return {
    kind,
    duration,
    width,
    height,
    fps,
    hasVideo: !!v,
    hasAudio: !!a && kind !== "image",
    audioChannels: a?.channels,
    sampleRate: a?.sample_rate ? Number(a.sample_rate) : undefined,
    videoCodec: v?.codec_name,
    audioCodec: a?.codec_name,
    pixFmt: v?.pix_fmt,
    formatName,
    sizeBytes,
    rotation,
  };
}

/** Whether the original can be played/displayed by the browser without a proxy. */
export function isBrowserPlayable(file: string, p: ProbeResult): boolean {
  const ext = extOf(file);
  if (p.kind === "image") return BROWSER_IMAGE_EXT.has(ext);
  if (p.kind === "audio") return BROWSER_AUDIO_CONTAINERS.has(ext) && BROWSER_AUDIO_CODECS.has(p.audioCodec ?? "");
  if (!BROWSER_VIDEO_CONTAINERS.has(ext)) return false;
  if (!BROWSER_VIDEO_CODECS.has(p.videoCodec ?? "")) return false;
  // 10-bit / 4:2:2 / 4:4:4 H.264 does not decode in Chromium.
  if (p.pixFmt && !/^yuvj?420p$/.test(p.pixFmt)) return false;
  if (p.hasAudio && !BROWSER_AUDIO_CODECS.has(p.audioCodec ?? "")) return false;
  return true;
}

/** Proxies are also made for anything above 1080p so playback stays smooth. */
function wantsProxy(file: string, p: ProbeResult): boolean {
  if (!isBrowserPlayable(file, p)) return true;
  if (p.kind === "video" && (p.width ?? 0) * (p.height ?? 0) > 1920 * 1080) return true;
  return false;
}

// ---------------------------------------------------------------- derived files

/**
 * Render a horizontal JPEG sprite of evenly spaced frames (~1 per second,
 * capped at MAX_THUMBS), each THUMB_WIDTH wide keeping the aspect ratio.
 */
export async function makeThumbSprite(file: string, p: ProbeResult, outFile: string): Promise<NonNullable<MediaAsset["thumbs"]>> {
  const w = THUMB_WIDTH;
  const aspect = p.width && p.height ? p.height / p.width : 9 / 16;
  const h = Math.max(2, Math.round((w * aspect) / 2) * 2);
  if (p.kind === "image") {
    await run("ffmpeg", ["-v", "error", "-y", "-i", file, "-frames:v", "1", "-vf", `scale=${w}:${h}`, "-q:v", "4", outFile]);
    return { url: "", count: 1, interval: STILL_DURATION, width: w, height: h };
  }
  const count = Math.max(1, Math.min(MAX_THUMBS, Math.ceil(p.duration)));
  const interval = p.duration / count || 1;
  // Long media: decode keyframes only (orders of magnitude faster). Short media
  // may have only one keyframe, so decode everything there.
  const keyOnly = p.duration > 90 ? ["-skip_frame", "nokey"] : [];
  // Sample at the middle of each interval so the first thumb isn't a black lead-in frame.
  // round=down keeps the final sample from being dropped at end of stream.
  const vf = `fps=1/${interval.toFixed(6)}:start_time=${(interval * 0.4).toFixed(6)}:round=down,scale=${w}:${h},tile=${count}x1`;
  await run("ffmpeg", ["-v", "error", "-y", ...keyOnly, "-i", file, "-an", "-sn", "-vf", vf, "-frames:v", "1", "-q:v", "5", outFile]);
  return { url: "", count, interval, width: w, height: h };
}

/** Compute max-abs peaks (0..1) at PEAKS_PER_SECOND from mono 8 kHz float PCM. */
export async function makeWaveform(file: string, outFile: string, duration: number, onProgress?: (f: number) => void): Promise<void> {
  const rate = 8000;
  const per = rate / PEAKS_PER_SECOND;
  const peaks: number[] = [];
  let acc = 0;
  let n = 0;
  let carry: Buffer = Buffer.alloc(0);
  const total = Math.max(1, duration * rate);
  let seen = 0;
  let lastReport = 0;
  await run("ffmpeg", ["-v", "error", "-i", file, "-vn", "-sn", "-ac", "1", "-ar", String(rate), "-f", "f32le", "-"], {
    onStdout: (chunk) => {
      const buf = carry.length ? Buffer.concat([carry, chunk]) : chunk;
      const usable = buf.length - (buf.length % 4);
      for (let i = 0; i < usable; i += 4) {
        const s = Math.abs(buf.readFloatLE(i));
        if (s > acc) acc = s;
        if (++n >= per) {
          peaks.push(Math.min(1, Math.round(acc * 1000) / 1000));
          acc = 0;
          n = 0;
        }
      }
      carry = buf.subarray(usable);
      seen += usable / 4;
      if (onProgress && seen - lastReport > rate * 5) {
        lastReport = seen;
        onProgress(Math.min(1, seen / total));
      }
    },
  });
  if (n > 0) peaks.push(Math.min(1, Math.round(acc * 1000) / 1000));
  fs.writeFileSync(outFile, JSON.stringify({ peaksPerSecond: PEAKS_PER_SECOND, peaks }));
}

/**
 * Create a browser-playable proxy. Video: H.264 yuv420p + AAC mp4, max 960px
 * wide, GOP 15 for fast seeking. Audio-only: 16-bit WAV (sample accurate, no
 * AAC priming delay). Images: JPEG at up to 4096px. Returns the file name.
 */
export async function makeProxy(file: string, p: ProbeResult, dir: string, onProgress?: (f: number) => void): Promise<string> {
  if (p.kind === "image") {
    const name = "proxy.jpg";
    await run("ffmpeg", ["-v", "error", "-y", "-i", file, "-frames:v", "1", "-vf", "scale='min(4096,iw)':-2", "-q:v", "2", path.join(dir, name)]);
    return name;
  }
  if (p.kind === "audio") {
    const name = "proxy.wav";
    const args = ["-hide_banner", "-y", "-i", file, "-vn", "-sn", "-map", "0:a:0", "-c:a", "pcm_s16le"];
    if ((p.audioChannels ?? 2) > 2) args.push("-ac", "2");
    await run("ffmpeg", [...args, path.join(dir, name)], { onStderr: onProgress && progressParser(p.duration, onProgress) });
    return name;
  }
  const name = "proxy.mp4";
  const tmp = path.join(dir, "proxy.tmp.mp4");
  const args = [
    "-hide_banner", "-y", "-i", file, "-map", "0:v:0", "-map", "0:a:0?", "-sn", "-dn",
    "-vf", `scale='trunc(min(${PROXY_MAX_WIDTH},iw)/2)*2':-2,format=yuv420p`,
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-g", "15", "-keyint_min", "15", "-sc_threshold", "0",
    "-c:a", "aac", "-b:a", "160k", "-ac", "2",
    "-movflags", "+faststart", tmp,
  ];
  await run("ffmpeg", args, { onStderr: onProgress && progressParser(p.duration, onProgress) });
  fs.renameSync(tmp, path.join(dir, name));
  return name;
}

/** Grab a single frame as JPEG (fast input seek). Images ignore t. */
export async function extractFrameJpeg(file: string, t: number, width = 640): Promise<Buffer> {
  const w = Math.max(16, Math.min(3840, Math.round(width / 2) * 2));
  const kind = mediaTypeOfExt(file);
  const seek = kind === "image" ? [] : ["-ss", String(Math.max(0, t))];
  const { stdout, stderr } = await run(
    "ffmpeg",
    ["-v", "error", ...seek, "-i", file, "-frames:v", "1", "-an", "-sn", "-vf", `scale='min(${w},iw)':-2`, "-f", "image2pipe", "-c:v", "mjpeg", "-q:v", "4", "-"],
    { allowFail: true },
  );
  if (!stdout.length) {
    // Seeking at/past the last frame yields nothing; retry from just before the end.
    if (t > 0.05 && kind !== "image") return extractFrameJpeg(file, t >= 1 ? t - 0.5 : 0, width);
    throw new Error("No frame at that time: " + stderr.trim().split("\n").pop());
  }
  return stdout;
}

/** Scene cut times (seconds) using ffmpeg's scene change score. */
export async function detectScenes(file: string, threshold = 0.3): Promise<number[]> {
  const thr = Math.min(1, Math.max(0.01, threshold));
  const cuts: number[] = [];
  let buf = "";
  await run(
    "ffmpeg",
    ["-hide_banner", "-i", file, "-an", "-sn", "-vf", `scale=320:-2,select='gt(scene,${thr})',showinfo`, "-f", "null", "-"],
    {
      onStderr: (s) => {
        buf += s;
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const l of lines) {
          const m = /Parsed_showinfo.*pts_time:\s*([\d.]+)/.exec(l);
          if (m) cuts.push(Math.round(parseFloat(m[1]) * 1000) / 1000);
        }
      },
    },
  );
  return cuts;
}

/** Silent ranges via silencedetect. Open-ended silence runs to the media end. */
export async function detectSilence(file: string, noiseDb = -35, minDuration = 0.5): Promise<{ start: number; end: number }[]> {
  const { stderr } = await run("ffmpeg", ["-hide_banner", "-i", file, "-vn", "-sn", "-af", `silencedetect=noise=${noiseDb}dB:d=${minDuration}`, "-f", "null", "-"]);
  const out: { start: number; end: number }[] = [];
  let open: number | null = null;
  for (const l of stderr.split("\n")) {
    const s = /silence_start:\s*(-?[\d.]+)/.exec(l);
    if (s) open = Math.max(0, parseFloat(s[1]));
    const e = /silence_end:\s*([\d.]+)/.exec(l);
    if (e && open !== null) {
      out.push({ start: round3(open), end: round3(parseFloat(e[1])) });
      open = null;
    }
  }
  if (open !== null) {
    let end = open;
    try {
      end = (await probeMedia(file)).duration;
    } catch {
      /* keep zero-length */
    }
    if (end > open) out.push({ start: round3(open), end: round3(end) });
  }
  return out;
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

// ---------------------------------------------------------------- asset index

const INDEX_FILE = path.join(MEDIA_DIR, "index.json");
const assets = new Map<string, MediaAsset>();
/** Probe results kept for the lifetime of the process (proxy decisions). */
const probes = new Map<string, ProbeResult>();

try {
  const list = JSON.parse(fs.readFileSync(INDEX_FILE, "utf8")) as MediaAsset[];
  for (const a of list) assets.set(a.id, a);
} catch {
  /* first run */
}

let saveTimer: NodeJS.Timeout | null = null;
function saveIndex(): void {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const tmp = INDEX_FILE + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify([...assets.values()]));
    fs.renameSync(tmp, INDEX_FILE);
  }, 300);
}

/** Server-side record of an imported asset (path, urls, status). */
export function getAssetRecord(id: string): MediaAsset | undefined {
  return assets.get(id);
}

/** Absolute path of the asset's original media file. */
export function assetPath(id: string): string | undefined {
  return assets.get(id)?.path;
}

/** Best file for fast server-side analysis/decoding: the proxy if one exists, else the original. */
export function assetWorkingPath(id: string): string | undefined {
  const a = assets.get(id);
  if (!a) return undefined;
  if (a.proxyUrl && a.kind === "video") {
    const p = path.join(MEDIA_DIR, id, path.basename(a.proxyUrl));
    if (fs.existsSync(p)) return p;
  }
  return a.path;
}

function update(id: string, changes: Partial<MediaAsset>): MediaAsset | undefined {
  const a = assets.get(id);
  if (!a) return undefined;
  Object.assign(a, changes);
  saveIndex();
  broadcast({ type: "media", asset: a });
  return a;
}

function progress(id: string, stage: string, p: number): void {
  broadcast({ type: "media-progress", id, stage, progress: Math.round(p * 1000) / 1000 });
}

function newId(): string {
  return "med_" + (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36)).replace(/-/g, "").slice(0, 12);
}

function baseRecord(id: string, file: string, name: string, url: string, sizeBytes: number): MediaAsset {
  return {
    id, name, kind: mediaTypeOfExt(file) ?? "video", path: file, url, duration: 0,
    hasVideo: mediaTypeOfExt(file) !== "audio", hasAudio: mediaTypeOfExt(file) !== "image",
    sizeBytes, markers: [], status: "importing", importedAt: Date.now(),
  };
}

// ---------------------------------------------------------------- processing queue

const queue: string[] = [];
let active = 0;
const CONCURRENCY = Math.max(1, Math.min(3, Math.floor(os.cpus().length / 4)));

function enqueue(id: string): void {
  queue.push(id);
  pump();
}

function pump(): void {
  while (active < CONCURRENCY && queue.length) {
    const id = queue.shift()!;
    active++;
    processAsset(id)
      .catch((e: Error) => update(id, { status: "error", error: e.message }))
      .finally(() => {
        active--;
        pump();
      });
  }
}

/** Probe → thumbnails → waveform → proxy (when needed). Broadcasts every stage. */
async function processAsset(id: string): Promise<void> {
  const a = assets.get(id);
  if (!a) return;
  const dir = path.join(MEDIA_DIR, id);
  fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(a.path)) throw new Error("Media file not found: " + a.path);

  progress(id, "probe", 0);
  const p = await probeMedia(a.path);
  probes.set(id, p);
  update(id, {
    kind: p.kind, duration: p.duration, width: p.width, height: p.height, fps: p.fps,
    hasVideo: p.hasVideo, hasAudio: p.hasAudio, audioChannels: p.audioChannels, sampleRate: p.sampleRate,
    videoCodec: p.videoCodec, audioCodec: p.audioCodec, sizeBytes: p.sizeBytes, error: undefined,
  });

  if (p.hasVideo) {
    progress(id, "thumbnails", 0);
    try {
      const thumbs = await makeThumbSprite(a.path, p, path.join(dir, "thumbs.jpg"));
      update(id, { thumbs: { ...thumbs, url: `/files/media/${id}/thumbs.jpg?v=${Date.now().toString(36)}` } });
    } catch (e) {
      console.warn(`[media] thumbnails failed for ${a.name}:`, (e as Error).message);
    }
  }

  if (p.hasAudio) {
    progress(id, "waveform", 0);
    try {
      await makeWaveform(a.path, path.join(dir, "waveform.json"), p.duration, (f) => progress(id, "waveform", f));
      update(id, { waveformUrl: `/files/media/${id}/waveform.json` });
    } catch (e) {
      console.warn(`[media] waveform failed for ${a.name}:`, (e as Error).message);
    }
  }

  const playable = isBrowserPlayable(a.path, p);
  if (!wantsProxy(a.path, p)) {
    update(id, { status: "ready" });
    progress(id, "done", 1);
    return;
  }
  if (playable) {
    // Original plays fine; the proxy is an optimization, so the asset is usable now.
    update(id, { status: "ready" });
  }
  await buildProxy(id, p, !playable);
}

async function buildProxy(id: string, p: ProbeResult, required: boolean): Promise<void> {
  const a = assets.get(id);
  if (!a) return;
  const dir = path.join(MEDIA_DIR, id);
  progress(id, "proxy", 0);
  try {
    const name = await makeProxy(a.path, p, dir, (f) => progress(id, "proxy", f));
    const proxyUrl = `/files/media/${id}/${name}`;
    // An unplayable original is replaced by the proxy as the main playback url.
    update(id, { proxyUrl, url: required ? proxyUrl : a.url, status: "ready" });
    progress(id, "done", 1);
  } catch (e) {
    if (required) throw e;
    console.warn(`[media] proxy failed for ${a.name}:`, (e as Error).message);
    progress(id, "done", 1);
  }
}

// Resume any processing interrupted by a server restart.
for (const a of assets.values()) if (a.status === "importing") enqueue(a.id);

// ---------------------------------------------------------------- import entry points

/**
 * Import files by absolute path. By default the original is referenced in place
 * (no copy); with copy=true it is cloned into MEDIA_DIR/<id>/original.<ext>
 * (Import mode's "Copy media"). Directories are scanned recursively.
 */
export async function importPaths(paths: string[], opts: { copy?: boolean } = {}): Promise<MediaAsset[]> {
  const files: string[] = [];
  const walk = (p: string, depth: number) => {
    let st: fs.Stats;
    try {
      st = fs.statSync(p);
    } catch {
      return;
    }
    if (st.isDirectory()) {
      if (depth > 4) return;
      for (const name of fs.readdirSync(p).sort()) if (!name.startsWith(".")) walk(path.join(p, name), depth + 1);
    } else if (st.isFile() && isMediaFile(p)) files.push(p);
  };
  for (const p of paths) {
    const abs = path.resolve(p.replace(/^~(?=$|\/)/, os.homedir()));
    if (!fs.existsSync(abs)) throw new Error(`File not found: ${p}`);
    if (fs.statSync(abs).isFile() && !isMediaFile(abs)) throw new Error(`Unsupported file type: ${path.basename(abs)}`);
    walk(abs, 0);
  }
  const out: MediaAsset[] = [];
  for (const file of files) {
    const id = newId();
    let a: MediaAsset;
    if (opts.copy) {
      const dir = path.join(MEDIA_DIR, id);
      fs.mkdirSync(dir, { recursive: true });
      const ext = extOf(file) || "bin";
      const dest = path.join(dir, `original.${ext}`);
      // Copy-on-write clone where the filesystem supports it (APFS/btrfs): instant.
      await fs.promises.copyFile(file, dest, fs.constants.COPYFILE_FICLONE);
      a = baseRecord(id, dest, path.basename(file), `/files/media/${id}/original.${ext}`, fs.statSync(dest).size);
    } else {
      a = baseRecord(id, file, path.basename(file), `/api/media/${id}/original`, fs.statSync(file).size);
    }
    assets.set(id, a);
    enqueue(id);
    out.push({ ...a });
  }
  saveIndex();
  return out;
}

/** Register an uploaded temp file: moves it into MEDIA_DIR/<id>/original.<ext>. */
function importUploaded(tmpPath: string, originalName: string): MediaAsset {
  const id = newId();
  const dir = path.join(MEDIA_DIR, id);
  fs.mkdirSync(dir, { recursive: true });
  const ext = extOf(originalName) || "bin";
  const dest = path.join(dir, `original.${ext}`);
  try {
    fs.renameSync(tmpPath, dest);
  } catch {
    fs.copyFileSync(tmpPath, dest);
    fs.unlinkSync(tmpPath);
  }
  const a = baseRecord(id, dest, originalName, `/files/media/${id}/original.${ext}`, fs.statSync(dest).size);
  assets.set(id, a);
  saveIndex();
  enqueue(id);
  return { ...a };
}

// ---------------------------------------------------------------- HTTP

export const mediaRouter = Router();

const upload = multer({
  dest: TMP_DIR,
  limits: { fileSize: 64 * 1024 ** 3 },
});

mediaRouter.post("/upload", upload.array("files"), (req, res) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (!files.length) return void res.status(400).json({ error: "No files uploaded" });
  const out: MediaAsset[] = [];
  for (const f of files) {
    // multer decodes the multipart filename as latin1; restore UTF-8 names.
    const name = Buffer.from(f.originalname, "latin1").toString("utf8");
    if (!isMediaFile(name)) {
      fs.rmSync(f.path, { force: true });
      continue;
    }
    out.push(importUploaded(f.path, name));
  }
  if (!out.length) return void res.status(400).json({ error: "No supported media files" });
  res.json(out);
});

/** Body: { paths: string[], copy?: boolean }. */
mediaRouter.post("/import-paths", async (req, res) => {
  const paths = req.body?.paths;
  if (!Array.isArray(paths) || !paths.every((p) => typeof p === "string")) return void res.status(400).json({ error: "paths must be an array of strings" });
  try {
    res.json(await importPaths(paths, { copy: req.body?.copy === true }));
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

/** Poster frame for an arbitrary file (Media Browser thumbnails; no import needed). */
mediaRouter.get("/fs-thumb", async (req, res) => {
  const file = String(req.query.path ?? "");
  const w = Number(req.query.w ?? 240);
  if (!file || !fs.existsSync(file) || !isMediaFile(file) || mediaTypeOfExt(file) === "audio") return void res.status(404).end();
  try {
    const kind = mediaTypeOfExt(file);
    // Grab a frame a little in to avoid black lead-ins, but only for files long enough.
    const jpg = await cachedFrame(`fs|${file}|${w}`, () => extractFrameJpeg(file, kind === "video" ? 1 : 0, w).catch(() => extractFrameJpeg(file, 0, w)));
    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Cache-Control", "max-age=3600");
    res.end(jpg);
  } catch {
    res.status(415).end();
  }
});

mediaRouter.get("/:id", (req, res) => {
  const a = assets.get(req.params.id);
  if (!a) return void res.status(404).json({ error: "Unknown media" });
  res.json(a);
});

/** Streams a by-path original with HTTP Range support (sendFile handles Range/ETag). */
mediaRouter.get("/:id/original", (req, res) => {
  const a = assets.get(req.params.id);
  if (!a || !fs.existsSync(a.path)) return void res.status(404).json({ error: "Media offline" });
  res.sendFile(a.path, { acceptRanges: true, dotfiles: "allow", maxAge: "1h" });
});

// Small LRU of recently served frames (scrubbing the same spot repeatedly).
const frameCache = new Map<string, Buffer>();
async function cachedFrame(key: string, make: () => Promise<Buffer>): Promise<Buffer> {
  const hit = frameCache.get(key);
  if (hit) {
    frameCache.delete(key);
    frameCache.set(key, hit);
    return hit;
  }
  const buf = await make();
  frameCache.set(key, buf);
  if (frameCache.size > 200) frameCache.delete(frameCache.keys().next().value!);
  return buf;
}

mediaRouter.get("/:id/frame", async (req, res) => {
  const a = assets.get(req.params.id);
  if (!a) return void res.status(404).json({ error: "Unknown media" });
  const t = Math.max(0, Number(req.query.t ?? 0) || 0);
  const w = Number(req.query.w ?? 640) || 640;
  try {
    const jpg = await cachedFrame(`${a.id}|${t.toFixed(3)}|${w}`, () => extractFrameJpeg(a.path, t, w));
    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Cache-Control", "max-age=3600");
    res.end(jpg);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

mediaRouter.post("/:id/proxy", (req, res) => {
  const a = assets.get(req.params.id);
  if (!a) return void res.status(404).json({ error: "Unknown media" });
  res.json({ ok: true });
  // Regenerate in the background; progress arrives as media-progress events.
  void (async () => {
    try {
      const p = probes.get(a.id) ?? (await probeMedia(a.path));
      probes.set(a.id, p);
      await buildProxy(a.id, p, !isBrowserPlayable(a.path, p));
    } catch (e) {
      console.warn("[media] proxy failed:", (e as Error).message);
    }
  })();
});

mediaRouter.post("/:id/scenes", async (req, res) => {
  const a = assets.get(req.params.id);
  if (!a) return void res.status(404).json({ error: "Unknown media" });
  if (!a.hasVideo || a.kind === "image") return void res.json({ cuts: [] });
  try {
    res.json({ cuts: await detectScenes(assetWorkingPath(a.id) ?? a.path, Number(req.body?.threshold ?? 0.3)) });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

mediaRouter.post("/:id/silence", async (req, res) => {
  const a = assets.get(req.params.id);
  if (!a) return void res.status(404).json({ error: "Unknown media" });
  if (!a.hasAudio) return void res.json({ silences: [] });
  try {
    res.json({ silences: await detectSilence(a.path, Number(req.body?.noiseDb ?? -35), Number(req.body?.minDuration ?? 0.5)) });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// ---------------------------------------------------------------- file system browser

/** GET /api/fs?dir= — directories and media files of a folder (default: home). */
export const browseHandler: RequestHandler = (req, res) => {
  let dir = String(req.query.dir ?? "").trim() || os.homedir();
  dir = path.resolve(dir.replace(/^~(?=$|\/)/, os.homedir()));
  let names: fs.Dirent[];
  try {
    names = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    return void res.status(400).json({ error: `Cannot read folder: ${(e as Error).message}` });
  }
  const entries: { name: string; path: string; isDir: boolean; size: number }[] = [];
  for (const d of names) {
    if (d.name.startsWith(".")) continue;
    const full = path.join(dir, d.name);
    let isDir = d.isDirectory();
    if (d.isSymbolicLink()) {
      try {
        isDir = fs.statSync(full).isDirectory();
      } catch {
        continue;
      }
    }
    // macOS bundles (.app, .photoslibrary, .fcpbundle) are opaque packages.
    if (isDir && /\.(app|photoslibrary|fcpbundle|bundle|framework)$/i.test(d.name)) continue;
    if (!isDir && !isMediaFile(d.name)) continue;
    let size = 0;
    if (!isDir) {
      try {
        size = fs.statSync(full).size;
      } catch {
        continue;
      }
    }
    entries.push({ name: d.name, path: full, isDir, size });
  }
  entries.sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }) : a.isDir ? -1 : 1));
  const parent = path.dirname(dir);
  res.json({ dir, parent: parent === dir ? null : parent, entries });
};
