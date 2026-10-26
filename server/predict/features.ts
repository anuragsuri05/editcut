// Measurable per-second video features for Content Lab, computed locally with ffmpeg
// (scene cuts, motion, brightness, loudness) and whisper.cpp (speech words).
import { execFile } from "node:child_process";
import type { SecondFeatures } from "../../shared/predict";
import type { Transcript } from "../../shared/types";
import { detectScenes } from "../media";

function ffmpeg(args: string[], signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile("ffmpeg", args, { maxBuffer: 256 * 1024 * 1024, signal }, (err, stdout, stderr) => {
      if (err) reject(new Error(String(stderr).split("\n").slice(-4).join(" ") || err.message));
      else resolve(String(stdout) + String(stderr));
    });
  });
}

/** Per-frame YAVG / YDIF from signalstats at 2 fps, averaged per second. */
async function visualStats(file: string, n: number, signal?: AbortSignal): Promise<{ motion: number[]; brightness: number[] }> {
  const out = await ffmpeg(["-v", "error", "-i", file, "-an", "-sn", "-vf", "fps=2,scale=160:-2,signalstats,metadata=print:file=-", "-f", "null", "-"], signal);
  const motion = new Array(n).fill(0), brightness = new Array(n).fill(0), counts = new Array(n).fill(0);
  let t = 0;
  for (const line of out.split("\n")) {
    const pts = /pts_time:([\d.]+)/.exec(line);
    if (pts) t = parseFloat(pts[1]);
    const y = /lavfi\.signalstats\.YAVG=([\d.]+)/.exec(line);
    const d = /lavfi\.signalstats\.YDIF=([\d.]+)/.exec(line);
    const i = Math.min(n - 1, Math.floor(t));
    if (y) {
      brightness[i] += parseFloat(y[1]) / 255;
      counts[i]++;
    }
    if (d) motion[i] += parseFloat(d[1]);
  }
  for (let i = 0; i < n; i++) {
    if (counts[i]) {
      brightness[i] /= counts[i];
      // YDIF is the mean absolute luma difference to the previous frame (0..255); ~25 is very busy
      motion[i] = Math.min(1, motion[i] / counts[i] / 25);
    }
  }
  return { motion, brightness };
}

/** RMS level (dBFS) per second. */
async function loudnessPerSecond(file: string, n: number, signal?: AbortSignal): Promise<number[]> {
  const levels = new Array(n).fill(-70);
  try {
    const out = await ffmpeg([
      "-v", "error", "-i", file, "-vn", "-sn",
      "-af", "aresample=48000,asetnsamples=n=48000:p=0,astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level:file=-",
      "-f", "null", "-",
    ], signal);
    let i = 0;
    for (const line of out.split("\n")) {
      const m = /RMS_level=(-?[\d.]+|-inf)/.exec(line);
      if (!m) continue;
      if (i < n) levels[i] = m[1] === "-inf" ? -70 : Math.max(-70, parseFloat(m[1]));
      i++;
    }
  } catch {
    /* no audio stream */
  }
  return levels;
}

export async function extractFeatures(file: string, duration: number, opts: { hasAudio: boolean; transcript?: Transcript; signal?: AbortSignal }): Promise<SecondFeatures[]> {
  const n = Math.max(1, Math.ceil(duration - 0.05));
  const [cuts, visual, loud] = await Promise.all([
    detectScenes(file, 0.3).catch(() => [] as number[]),
    visualStats(file, n, opts.signal),
    opts.hasAudio ? loudnessPerSecond(file, n, opts.signal) : Promise.resolve(new Array(n).fill(-70)),
  ]);
  const cutSeconds = new Set(cuts.map((c) => Math.floor(c)));
  const words: string[][] = Array.from({ length: n }, () => []);
  for (const seg of opts.transcript?.segments ?? []) {
    for (const w of seg.words) {
      const i = Math.floor(w.start);
      if (i >= 0 && i < n) words[i].push(w.text.trim());
    }
  }
  return Array.from({ length: n }, (_, t) => ({
    t,
    cut: cutSeconds.has(t),
    motion: Math.round(visual.motion[t] * 1000) / 1000,
    brightness: Math.round(visual.brightness[t] * 1000) / 1000,
    loudness: Math.round(loud[t] * 10) / 10,
    speech: words[t].length,
    silent: loud[t] < -45,
    text: words[t].length ? words[t].join(" ") : undefined,
  }));
}
