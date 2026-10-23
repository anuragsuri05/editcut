// Media analysis used by the AI agent. Prefers the helpers exported by
// server/media.ts (media engineer) when they exist, otherwise falls back to
// running ffmpeg directly so the agent works on its own.
import fs from "node:fs";
import { spawn } from "node:child_process";
import * as mediaModule from "../media";

type AnyFn = (...args: unknown[]) => unknown;
const mediaFn = (name: string): AnyFn | undefined => {
  const f = (mediaModule as unknown as Record<string, unknown>)[name];
  return typeof f === "function" ? (f as AnyFn) : undefined;
};

export function runFfmpeg(args: string[], opts: { signal?: AbortSignal; wantStdout?: boolean; timeoutMs?: number } = {}): Promise<{ stdout: Buffer; stderr: string }> {
  return new Promise((resolve, reject) => {
    const p = spawn("ffmpeg", ["-hide_banner", "-nostdin", ...args], { stdio: ["ignore", opts.wantStdout ? "pipe" : "ignore", "pipe"] });
    const chunks: Buffer[] = [];
    let err = "";
    p.stdout?.on("data", (d: Buffer) => chunks.push(d));
    p.stderr?.on("data", (d: Buffer) => {
      err += d.toString();
      if (err.length > 4_000_000) err = err.slice(-2_000_000);
    });
    const kill = () => p.kill("SIGKILL");
    opts.signal?.addEventListener("abort", kill, { once: true });
    const timer = setTimeout(kill, opts.timeoutMs ?? 180_000);
    p.on("error", reject);
    p.on("close", (code) => {
      clearTimeout(timer);
      opts.signal?.removeEventListener("abort", kill);
      if (opts.signal?.aborted) return reject(new Error("Cancelled"));
      if (code === 0) resolve({ stdout: Buffer.concat(chunks), stderr: err });
      else reject(new Error(`ffmpeg failed (${code}): ${err.trim().split("\n").slice(-2).join(" ")}`));
    });
  });
}

function ensureFile(p: string): void {
  if (!p || !fs.existsSync(p)) throw new Error(`Media file is missing on disk: ${p || "(no path)"}`);
}

/** JPEG frame of a media file at time t, scaled to width w. */
export async function frameJpeg(filePath: string, t: number, w = 512, signal?: AbortSignal): Promise<Buffer> {
  ensureFile(filePath);
  const ext = mediaFn("extractFrameJpeg");
  if (ext) {
    try {
      const b = await ext(filePath, t, w);
      if (Buffer.isBuffer(b) && b.length) return b;
    } catch {
      /* fall back */
    }
  }
  const seek = Math.max(0, t);
  const { stdout } = await runFfmpeg(
    ["-v", "error", "-ss", seek.toFixed(3), "-i", filePath, "-frames:v", "1", "-vf", `scale=${Math.round(w)}:-2`, "-f", "image2pipe", "-vcodec", "mjpeg", "-q:v", "5", "pipe:1"],
    { signal, wantStdout: true, timeoutMs: 30_000 },
  );
  if (!stdout.length && seek > 0.2) return frameJpeg(filePath, seek - 0.2, w, signal); // past the last frame
  if (!stdout.length) throw new Error("Could not decode a frame at " + t.toFixed(2) + "s");
  return stdout;
}

/** Scene-cut times (seconds). */
export async function sceneCuts(filePath: string, threshold = 0.3, signal?: AbortSignal): Promise<number[]> {
  ensureFile(filePath);
  const ext = mediaFn("detectScenes");
  if (ext) {
    try {
      const r = (await ext(filePath, threshold)) as number[] | { cuts: number[] };
      const cuts = Array.isArray(r) ? r : r?.cuts;
      if (Array.isArray(cuts)) return cuts;
    } catch {
      /* fall back */
    }
  }
  const { stderr } = await runFfmpeg(["-i", filePath, "-an", "-vf", `scale=320:-2,select='gt(scene,${threshold})',showinfo`, "-f", "null", "-"], { signal });
  const cuts: number[] = [];
  for (const m of stderr.matchAll(/pts_time:([\d.]+)/g)) cuts.push(Math.round(Number(m[1]) * 1000) / 1000);
  return cuts;
}

/** Silent ranges (seconds). */
export async function silences(filePath: string, noiseDb = -35, minDuration = 0.5, signal?: AbortSignal): Promise<{ start: number; end: number }[]> {
  ensureFile(filePath);
  const ext = mediaFn("detectSilence");
  if (ext) {
    try {
      const r = (await ext(filePath, noiseDb, minDuration)) as { start: number; end: number }[] | { silences: { start: number; end: number }[] };
      const s = Array.isArray(r) ? r : r?.silences;
      if (Array.isArray(s)) return s;
    } catch {
      /* fall back */
    }
  }
  const { stderr } = await runFfmpeg(["-i", filePath, "-vn", "-af", `silencedetect=noise=${noiseDb}dB:d=${minDuration}`, "-f", "null", "-"], { signal });
  const out: { start: number; end: number }[] = [];
  let start: number | null = null;
  for (const line of stderr.split("\n")) {
    const s = /silence_start:\s*(-?[\d.]+)/.exec(line);
    if (s) start = Math.max(0, Number(s[1]));
    const e = /silence_end:\s*([\d.]+)/.exec(line);
    if (e && start !== null) {
      out.push({ start: r3(start), end: r3(Number(e[1])) });
      start = null;
    }
  }
  if (start !== null) {
    const dur = /Duration:\s*(\d+):(\d+):([\d.]+)/.exec(stderr);
    const total = dur ? Number(dur[1]) * 3600 + Number(dur[2]) * 60 + Number(dur[3]) : start;
    if (total > start) out.push({ start: r3(start), end: r3(total) });
  }
  return out;
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;

/** Decode mono float PCM at the given rate. */
export async function decodePcm(filePath: string, rate = 11025, signal?: AbortSignal): Promise<Float32Array> {
  ensureFile(filePath);
  const { stdout } = await runFfmpeg(["-v", "error", "-i", filePath, "-vn", "-ac", "1", "-ar", String(rate), "-f", "f32le", "pipe:1"], { signal, wantStdout: true });
  const copy = new Uint8Array(stdout.length);
  copy.set(stdout);
  return new Float32Array(copy.buffer, 0, Math.floor(copy.length / 4));
}

/**
 * Beat tracking: onset-strength envelope (log-energy flux), tempo by
 * autocorrelation (prior around 120 BPM), then the beat phase that best
 * aligns with onsets. Good enough for cutting to the beat of music beds.
 */
export async function detectBeats(filePath: string, signal?: AbortSignal): Promise<{ bpm: number; beats: number[]; downbeats: number[]; onsets: number[]; duration: number }> {
  const rate = 11025;
  const pcm = await decodePcm(filePath, rate, signal);
  return analyzeBeats(pcm, rate);
}

export function analyzeBeats(pcm: Float32Array, rate: number): { bpm: number; beats: number[]; downbeats: number[]; onsets: number[]; duration: number } {
  const hop = 256;
  const win = 1024;
  const frames = Math.max(0, Math.floor((pcm.length - win) / hop));
  const fps = rate / hop;
  const duration = pcm.length / rate;
  // an onset shows up in the frame whose window first reaches it: report the window's leading edge
  const lag = (win - hop / 2) / rate;
  if (frames < 16) return { bpm: 0, beats: [], downbeats: [], onsets: [], duration };
  const loge = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let s = 0;
    const o = i * hop;
    // simple pre-emphasis to favour transients
    for (let k = 1; k < win; k++) {
      const x = pcm[o + k] - 0.97 * pcm[o + k - 1];
      s += x * x;
    }
    loge[i] = Math.log(1e-9 + s / win);
  }
  const env = new Float32Array(frames);
  for (let i = 1; i < frames; i++) env[i] = Math.max(0, loge[i] - loge[i - 1]);
  // remove local mean (adaptive threshold) and normalise
  const out = new Float32Array(frames);
  const W = Math.round(fps * 0.5);
  let acc = 0;
  for (let i = 0; i < frames; i++) {
    acc += env[i];
    if (i >= W) acc -= env[i - W];
    const mean = acc / Math.min(i + 1, W);
    out[i] = Math.max(0, env[i] - mean);
  }
  let max = 0;
  for (const v of out) max = Math.max(max, v);
  if (max <= 0) return { bpm: 0, beats: [], downbeats: [], onsets: [], duration };
  for (let i = 0; i < frames; i++) out[i] /= max;

  // onsets: local maxima above threshold, min spacing 100ms
  const onsets: number[] = [];
  const minGap = Math.round(fps * 0.1);
  let last = -minGap;
  for (let i = 1; i < frames - 1; i++) {
    if (out[i] > 0.3 && out[i] >= out[i - 1] && out[i] >= out[i + 1] && i - last >= minGap) {
      onsets.push(r3(i / fps + lag));
      last = i;
    }
  }

  // tempo via autocorrelation in 60..200 BPM with a log-normal prior at 120
  let bestLag = 0;
  let bestScore = -Infinity;
  const minLag = Math.floor((60 / 200) * fps);
  const maxLag = Math.ceil((60 / 60) * fps);
  for (let lag = minLag; lag <= maxLag; lag++) {
    let s = 0;
    for (let i = lag; i < frames; i++) s += out[i] * out[i - lag];
    const bpm = (60 * fps) / lag;
    const prior = Math.exp(-0.5 * Math.pow(Math.log2(bpm / 120) / 0.9, 2));
    const score = (s / (frames - lag)) * prior;
    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }
  if (!bestLag) return { bpm: 0, beats: [], downbeats: [], onsets, duration };
  // refine fractional period by maximizing alignment
  let period = bestLag;
  let phase = 0;
  let best = -Infinity;
  for (let p = bestLag - 1; p <= bestLag + 1; p += 0.05) {
    for (let ph = 0; ph < p; ph += 1) {
      let s = 0;
      for (let t = ph; t < frames; t += p) s += out[Math.round(t)] ?? 0;
      if (s > best) {
        best = s;
        period = p;
        phase = ph;
      }
    }
  }
  const beats: number[] = [];
  for (let t = phase; t < frames; t += period) beats.push(r3(t / fps + lag));
  // downbeats: choose the 4-beat offset with the strongest onsets
  let dbOff = 0;
  let dbBest = -Infinity;
  for (let o = 0; o < 4; o++) {
    let s = 0;
    for (let i = o; i < beats.length; i += 4) s += out[Math.round((beats[i] - lag) * fps)] ?? 0;
    if (s > dbBest) {
      dbBest = s;
      dbOff = o;
    }
  }
  const downbeats = beats.filter((_, i) => i % 4 === dbOff);
  return { bpm: Math.round(((60 * fps) / period) * 10) / 10, beats, downbeats, onsets, duration: r3(duration) };
}

/** Find an asset's original file via server/media.ts getAssetRecord when available. */
export async function assetPathFromRecord(id: string): Promise<string | undefined> {
  const get = mediaFn("getAssetRecord");
  if (!get) return undefined;
  try {
    const rec = (await get(id)) as { path?: string } | undefined;
    return rec?.path;
  } catch {
    return undefined;
  }
}
