// whisper.cpp integration: model discovery, transcription with word timings,
// on-disk caching (MEDIA_DIR/<id>/transcript.json) and an explicit, user-triggered
// model download into MODELS_DIR.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { MEDIA_DIR, MODELS_DIR, TMP_DIR } from "../config";
import { broadcast } from "../events";
import type { Transcript, TranscriptSegment, TranscriptWord } from "../../shared/types";

// ---------------------------------------------------------------- discovery

const BIN_CANDIDATES = [
  process.env.EDITCUT_WHISPER_BIN,
  "/usr/local/bin/whisper-cli",
  "/opt/homebrew/bin/whisper-cli",
  "/usr/bin/whisper-cli",
  "/usr/local/bin/whisper-cpp",
  "/opt/homebrew/bin/whisper-cpp",
].filter(Boolean) as string[];

function modelDirs(): string[] {
  return [
    MODELS_DIR,
    path.join(os.homedir(), "jarvis", "models"),
    path.join(os.homedir(), ".cache", "whisper"),
    "/usr/local/share/whisper-cpp/models",
    "/opt/homebrew/share/whisper-cpp/models",
  ];
}

export function whisperBinary(): string | undefined {
  return BIN_CANDIDATES.find((p) => fs.existsSync(p));
}

/** Rank models: larger multilingual > larger english-only > smaller. */
function modelRank(file: string): number {
  const f = path.basename(file).toLowerCase();
  const size = ["tiny", "base", "small", "medium", "large"].findIndex((s) => f.includes(s));
  return (size < 0 ? 0 : size) * 2 + (f.includes(".en") ? 0 : 1);
}

export function whisperModel(): string | undefined {
  const env = process.env.EDITCUT_WHISPER_MODEL;
  if (env && fs.existsSync(env)) return env;
  const found: string[] = [];
  for (const dir of modelDirs()) {
    try {
      for (const f of fs.readdirSync(dir)) if (/^ggml-.*\.bin$/.test(f) && !f.includes("silero") && !f.includes("vad")) found.push(path.join(dir, f));
    } catch {
      /* missing dir */
    }
  }
  found.sort((a, b) => modelRank(b) - modelRank(a));
  // the large models are slow on CPU; prefer <= small unless nothing else exists
  return found.find((f) => !/medium|large/.test(path.basename(f))) ?? found[0];
}

export function whisperStatus(): { available: boolean; model?: string; binary?: string; download?: DownloadState } {
  const binary = whisperBinary();
  const model = whisperModel();
  return { available: !!binary && !!model, model: model ? path.basename(model) : undefined, binary, download: downloadState };
}

// ---------------------------------------------------------------- transcription

export interface TranscribeOptions {
  language?: string; // "auto" | "en" | ...
  force?: boolean;
  signal?: AbortSignal;
  onProgress?: (p: number) => void;
}

const inflight = new Map<string, Promise<Transcript>>();

export function transcriptCachePath(assetId: string): string {
  return path.join(MEDIA_DIR, assetId, "transcript.json");
}

export function readCachedTranscript(assetId: string): Transcript | null {
  try {
    return JSON.parse(fs.readFileSync(transcriptCachePath(assetId), "utf8")) as Transcript;
  } catch {
    return null;
  }
}

/** Transcribe a media file (any ffmpeg-readable audio/video). Cached per asset id. */
export function transcribeMedia(assetId: string, mediaPath: string, opts: TranscribeOptions = {}): Promise<Transcript> {
  if (!opts.force) {
    const cached = readCachedTranscript(assetId);
    if (cached) return Promise.resolve(cached);
  }
  const key = assetId;
  const running = inflight.get(key);
  if (running) return running;
  const job = runTranscription(assetId, mediaPath, opts).finally(() => inflight.delete(key));
  inflight.set(key, job);
  return job;
}

async function runTranscription(assetId: string, mediaPath: string, opts: TranscribeOptions): Promise<Transcript> {
  const bin = whisperBinary();
  const model = whisperModel();
  if (!bin) throw new Error("whisper.cpp (whisper-cli) is not installed. Install it with `brew install whisper-cpp`.");
  if (!model) throw new Error("No whisper model found. Download one from AI Settings (Download speech model).");
  if (!fs.existsSync(mediaPath)) throw new Error(`Media file not found: ${mediaPath}`);

  const progress = (p: number) => {
    opts.onProgress?.(p);
    broadcast({ type: "transcribe-progress", id: assetId, progress: p });
  };
  progress(0);
  fs.mkdirSync(TMP_DIR, { recursive: true });
  const base = path.join(TMP_DIR, `whisper_${assetId}_${Date.now()}`);
  const wav = base + ".wav";
  try {
    await run("ffmpeg", ["-v", "error", "-y", "-i", mediaPath, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", wav], opts.signal);
    progress(0.08);
    const englishOnly = /\.en\.bin$/.test(model);
    const lang = englishOnly ? "en" : opts.language && opts.language !== "" ? opts.language : "auto";
    const threads = String(Math.max(2, Math.min(8, os.cpus().length - 1)));
    await run(bin, ["-m", model, "-f", wav, "-l", lang, "-t", threads, "-ojf", "-of", base, "-np", "-pp"], opts.signal, (line) => {
      const m = /progress\s*=\s*(\d+)%/.exec(line);
      if (m) progress(0.08 + (Number(m[1]) / 100) * 0.9);
    });
    const raw = JSON.parse(fs.readFileSync(base + ".json", "utf8")) as WhisperJson;
    const transcript = parseWhisperJson(raw);
    const dir = path.join(MEDIA_DIR, assetId);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(transcriptCachePath(assetId), JSON.stringify(transcript));
    progress(1);
    return transcript;
  } finally {
    for (const f of [wav, base + ".json"]) fs.rm(f, { force: true }, () => {});
  }
}

interface WhisperToken { text: string; offsets: { from: number; to: number }; p?: number }
interface WhisperSegment { text: string; offsets: { from: number; to: number }; tokens?: WhisperToken[] }
interface WhisperJson { result?: { language?: string }; transcription: WhisperSegment[] }

const isSpecial = (t: string) => /^\s*\[_[A-Z_0-9]+_?\]\s*$/.test(t) || /^\s*\[_/.test(t);
const isPunct = (t: string) => /^[\s.,!?;:"'…\-–—)]+$/.test(t);
const isNonSpeech = (w: string) => /^[[(].*[\])]$/.test(w.trim());

/** Convert whisper.cpp -ojf output (token timings) into word-timed segments. */
export function parseWhisperJson(raw: WhisperJson): Transcript {
  const segments: TranscriptSegment[] = [];
  raw.transcription.forEach((s, i) => {
    const words: TranscriptWord[] = [];
    let cur: TranscriptWord | null = null;
    for (const tok of s.tokens ?? []) {
      if (isSpecial(tok.text)) continue;
      const start = tok.offsets.from / 1000;
      const end = tok.offsets.to / 1000;
      if (tok.text.startsWith(" ") || !cur) {
        if (cur) words.push(cur);
        if (isPunct(tok.text) && cur) {
          // stray leading-space punctuation: attach to previous word
          cur = words.pop()!;
          cur.text += tok.text.trim();
          continue;
        }
        cur = { text: tok.text.trim(), start, end };
      } else {
        cur.text += tok.text;
        if (!isPunct(tok.text)) cur.end = Math.max(cur.end, end);
      }
    }
    if (cur) words.push(cur);
    const clean = words.filter((w) => w.text && !isNonSpeech(w.text));
    // keep word times monotonic and inside the segment
    const segStart = s.offsets.from / 1000;
    const segEnd = s.offsets.to / 1000;
    for (let k = 0; k < clean.length; k++) {
      const w = clean[k];
      w.start = Math.max(segStart, Math.min(w.start, segEnd));
      w.end = Math.max(w.start, Math.min(w.end, segEnd));
      if (k > 0 && w.start < clean[k - 1].end) w.start = clean[k - 1].end;
      if (w.end < w.start) w.end = w.start;
      w.start = round3(w.start);
      w.end = round3(w.end);
    }
    const text = s.text.trim();
    if (!text || isNonSpeech(text)) return;
    segments.push({ id: `seg_${i}`, text, start: round3(segStart), end: round3(segEnd), words: clean });
  });
  return { language: raw.result?.language, segments };
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

function run(cmd: string, args: string[], signal?: AbortSignal, onStderrLine?: (l: string) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    let buf = "";
    p.stderr.on("data", (d: Buffer) => {
      const s = d.toString();
      err = (err + s).slice(-4000);
      if (onStderrLine) {
        buf += s;
        let i;
        while ((i = buf.search(/[\r\n]/)) >= 0) {
          onStderrLine(buf.slice(0, i));
          buf = buf.slice(i + 1);
        }
      }
    });
    const abort = () => p.kill("SIGKILL");
    signal?.addEventListener("abort", abort, { once: true });
    p.on("error", reject);
    p.on("close", (code) => {
      signal?.removeEventListener("abort", abort);
      if (signal?.aborted) reject(new Error("Transcription cancelled"));
      else if (code === 0) resolve();
      else reject(new Error(`${path.basename(cmd)} failed (${code}): ${err.trim().split("\n").slice(-3).join(" ")}`));
    });
  });
}

// ---------------------------------------------------------------- model download (explicit user action only)

export interface DownloadState { active: boolean; progress: number; file?: string; error?: string; done?: boolean }
let downloadState: DownloadState | undefined;

export const DOWNLOADABLE_MODELS: Record<string, { file: string; sizeMb: number; label: string }> = {
  base: { file: "ggml-base.bin", sizeMb: 142, label: "Base (multilingual, 142 MB)" },
  "base.en": { file: "ggml-base.en.bin", sizeMb: 142, label: "Base English (142 MB)" },
  small: { file: "ggml-small.bin", sizeMb: 466, label: "Small (multilingual, 466 MB)" },
};

export async function downloadWhisperModel(name = "base"): Promise<void> {
  const def = DOWNLOADABLE_MODELS[name];
  if (!def) throw new Error(`Unknown model ${name}`);
  if (downloadState?.active) throw new Error("A download is already in progress");
  const url = `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/${def.file}`;
  const dest = path.join(MODELS_DIR, def.file);
  const part = dest + ".part";
  downloadState = { active: true, progress: 0, file: def.file };
  try {
    const res = await fetch(url);
    if (!res.ok || !res.body) throw new Error(`Download failed: ${res.status} ${res.statusText}`);
    const total = Number(res.headers.get("content-length") ?? def.sizeMb * 1024 * 1024);
    const out = fs.createWriteStream(part);
    let got = 0;
    const reader = res.body.getReader();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      got += value.length;
      if (!out.write(value)) await new Promise((r) => out.once("drain", r));
      downloadState.progress = Math.min(0.999, got / total);
      broadcast({ type: "whisper-download", progress: downloadState.progress });
    }
    await new Promise<void>((resolve, reject) => out.end((e?: Error | null) => (e ? reject(e) : resolve())));
    fs.renameSync(part, dest);
    downloadState = { active: false, progress: 1, file: def.file, done: true };
    broadcast({ type: "whisper-download", progress: 1, done: true });
  } catch (e) {
    fs.rm(part, { force: true }, () => {});
    downloadState = { active: false, progress: 0, file: def.file, error: (e as Error).message };
    throw e;
  }
}
