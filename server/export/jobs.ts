// Export job queue (Media Encoder-like): one render at a time, progress/ETA
// broadcast over SSE, cancel (kills ffmpeg and removes partial output).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import type { ExportJob, ExportSettings, Project } from "../../shared/types";
import { extensionFor, PRESET_MAP } from "../../shared/exportPresets";
import { buildRenderPlan, type LoudnormMeasure, type RenderPlan, type StepContext } from "./graph";
import type { EncoderCaps } from "./encode";

export const FFMPEG = process.env.FFMPEG_PATH || (fs.existsSync("/usr/local/bin/ffmpeg") ? "/usr/local/bin/ffmpeg" : fs.existsSync("/opt/homebrew/bin/ffmpeg") ? "/opt/homebrew/bin/ffmpeg" : "ffmpeg");

let caps: EncoderCaps | null = null;
export function encoderCaps(): EncoderCaps {
  if (caps) return caps;
  try {
    const out = execFileSync(FFMPEG, ["-hide_banner", "-encoders"], { encoding: "utf8" });
    const has = (n: string) => new RegExp(`\\s${n}\\s`).test(out);
    caps = {
      av1: has("libsvtav1") ? "libsvtav1" : has("libaom-av1") ? "libaom-av1" : has("librav1e") ? "librav1e" : null,
      videotoolbox: process.platform === "darwin" && has("h264_videotoolbox"),
      libopus: has("libopus"),
    };
  } catch {
    caps = { av1: null, videotoolbox: false, libopus: false };
  }
  return caps;
}

export interface JobInternal {
  job: ExportJob;
  project: Project;
  sequenceId: string;
  settings: ExportSettings;
  graphics: Record<string, string>;
  tmpDir: string;
  proc?: ChildProcess;
  cancelled?: boolean;
  /** Called when the job finishes (any terminal status). */
  done: Promise<ExportJob>;
  resolve: (j: ExportJob) => void;
}

export interface QueueConfig {
  tmpRoot: string;
  defaultDirectory: () => string;
  resolveAssetPath: Parameters<typeof buildRenderPlan>[3]["resolveAssetPath"];
  broadcast: (job: ExportJob) => void;
}

function expandHome(p: string): string {
  return p.startsWith("~") ? path.join(os.homedir(), p.slice(1)) : p;
}

function sanitize(name: string): string {
  const s = name.replace(/[\/\\:*?"<>|\x00-\x1f]/g, "_").replace(/\s+/g, " ").trim();
  return s.slice(0, 180) || "Untitled";
}

export class ExportQueue {
  private list: JobInternal[] = [];
  private running: JobInternal | null = null;
  private lastBroadcast = new Map<string, number>();
  constructor(private cfg: QueueConfig) {}

  jobs(): ExportJob[] {
    return this.list.map((j) => j.job);
  }

  get(id: string): JobInternal | undefined {
    return this.list.find((j) => j.job.id === id);
  }

  private reserved(): Set<string> {
    return new Set(this.list.filter((j) => j.job.status === "queued" || j.job.status === "rendering").map((j) => j.job.outputPath));
  }

  /** Unique output path: "<name>.<ext>", "<name>_1.<ext>", … */
  outputPathFor(settings: ExportSettings): string {
    const dir = expandHome(settings.directory?.trim() || this.cfg.defaultDirectory());
    fs.mkdirSync(dir, { recursive: true });
    const ext = extensionFor(settings.format);
    let base = sanitize(settings.fileName || "Sequence");
    if (base.toLowerCase().endsWith("." + ext)) base = base.slice(0, -(ext.length + 1));
    const taken = this.reserved();
    for (let i = 0; i < 10000; i++) {
      const p = path.join(dir, `${base}${i ? "_" + i : ""}.${ext}`);
      if (!fs.existsSync(p) && !taken.has(p)) return p;
    }
    return path.join(dir, `${base}_${Date.now()}.${ext}`);
  }

  enqueue(project: Project, sequenceId: string, settings: ExportSettings, graphics: Record<string, string>): JobInternal {
    const seq = project.sequences[sequenceId];
    if (!seq) throw new Error(`Sequence ${sequenceId} not found`);
    const id = "exp_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
    const tmpDir = path.join(this.cfg.tmpRoot, id);
    fs.mkdirSync(tmpDir, { recursive: true });
    // materialize graphics (PNG data URLs or existing file paths)
    const gfx: Record<string, string> = {};
    for (const [clipId, v] of Object.entries(graphics ?? {})) {
      if (typeof v !== "string" || !v) continue;
      const m = /^data:image\/(png|jpeg|webp);base64,(.*)$/s.exec(v);
      if (m) {
        const p = path.join(tmpDir, `gfx_${clipId.replace(/[^\w-]/g, "_")}.${m[1] === "jpeg" ? "jpg" : m[1]}`);
        fs.writeFileSync(p, Buffer.from(m[2], "base64"));
        gfx[clipId] = p;
      } else if (path.isAbsolute(v) && fs.existsSync(v)) gfx[clipId] = v;
    }
    const outputPath = this.outputPathFor(settings);
    const preset = settings.presetId ? PRESET_MAP[settings.presetId] : undefined;
    const job: ExportJob = {
      id, sequenceName: seq.name, outputPath, status: "queued", progress: 0,
      sequenceId, format: settings.format, presetName: preset?.name, warnings: [],
    };
    let resolve!: (j: ExportJob) => void;
    const done = new Promise<ExportJob>((r) => (resolve = r));
    const ji: JobInternal = { job, project, sequenceId, settings, graphics: gfx, tmpDir, done, resolve };
    this.list.push(ji);
    this.emit(ji, true);
    queueMicrotask(() => this.pump());
    return ji;
  }

  cancel(id: string): boolean {
    const ji = this.get(id);
    if (!ji) return false;
    if (ji.job.status === "queued") {
      ji.job.status = "cancelled";
      ji.job.finishedAt = Date.now();
      this.cleanup(ji, true);
      this.emit(ji, true);
      ji.resolve(ji.job);
      return true;
    }
    if (ji.job.status === "rendering") {
      ji.cancelled = true;
      ji.proc?.kill("SIGKILL");
      return true;
    }
    return false;
  }

  /** Remove finished jobs from the list. */
  clearFinished(): void {
    this.list = this.list.filter((j) => j.job.status === "queued" || j.job.status === "rendering");
  }

  private emit(ji: JobInternal, force = false) {
    const now = Date.now();
    const last = this.lastBroadcast.get(ji.job.id) ?? 0;
    if (!force && now - last < 250) return;
    this.lastBroadcast.set(ji.job.id, now);
    this.cfg.broadcast({ ...ji.job });
  }

  private pump() {
    if (this.running) return;
    const next = this.list.find((j) => j.job.status === "queued");
    if (!next) return;
    this.running = next;
    this.run(next)
      .catch((e) => {
        if (next.job.status === "rendering") {
          next.job.status = next.cancelled ? "cancelled" : "error";
          if (!next.cancelled) next.job.error = String(e?.message ?? e);
        }
      })
      .finally(() => {
        next.job.finishedAt = Date.now();
        const failed = next.job.status !== "done";
        this.cleanup(next, failed);
        this.emit(next, true);
        next.resolve(next.job);
        this.running = null;
        this.pump();
      });
  }

  private cleanup(ji: JobInternal, removeOutput: boolean) {
    try {
      fs.rmSync(ji.tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
    if (removeOutput) {
      try {
        if (fs.existsSync(ji.job.outputPath)) fs.rmSync(ji.job.outputPath, { force: true });
      } catch {
        /* ignore */
      }
    }
  }

  private plan(ji: JobInternal, settings: ExportSettings): RenderPlan {
    return buildRenderPlan(ji.project, ji.sequenceId, settings, {
      tmpDir: ji.tmpDir,
      outputPath: ji.job.outputPath,
      graphics: ji.graphics,
      resolveAssetPath: this.cfg.resolveAssetPath,
      caps: encoderCaps(),
    });
  }

  private async run(ji: JobInternal): Promise<void> {
    const job = ji.job;
    job.status = "rendering";
    job.startedAt = Date.now();
    job.progress = 0;
    this.emit(ji, true);
    let settings = ji.settings;
    let plan = this.plan(ji, settings);
    job.warnings = plan.warnings;
    try {
      await this.execPlan(ji, plan);
    } catch (e) {
      if (ji.cancelled) throw e;
      if (settings.hardwareEncoding) {
        // Hardware encoder unavailable/failed: fall back to software like Premiere does.
        settings = { ...settings, hardwareEncoding: false };
        plan = this.plan(ji, settings);
        job.warnings = [...plan.warnings, "Hardware encoding failed; used software encoding."];
        await this.execPlan(ji, plan);
      } else throw e;
    }
    for (const sc of plan.sidecars) fs.writeFileSync(sc.path, sc.content);
    if (!fs.existsSync(job.outputPath)) throw new Error("ffmpeg finished but no output file was written");
    job.status = "done";
    job.progress = 1;
    job.etaSeconds = 0;
  }

  private async execPlan(ji: JobInternal, plan: RenderPlan): Promise<void> {
    const job = ji.job;
    const totalW = plan.steps.reduce((s, x) => s + x.weight * Math.max(0.01, x.duration), 0) || 1;
    let doneW = 0;
    const sctx: StepContext = {};
    const t0 = Date.now();
    for (const step of plan.steps) {
      if (ji.cancelled) throw new Error("cancelled");
      const { args, files } = step.build(sctx);
      for (const f of files) {
        fs.mkdirSync(path.dirname(f.path), { recursive: true });
        fs.writeFileSync(f.path, f.content);
      }
      const stepW = step.weight * Math.max(0.01, step.duration);
      const stderr = await runFfmpeg(args, (sec) => {
        const frac = Math.max(0, Math.min(1, sec / Math.max(0.001, step.duration)));
        job.progress = Math.min(0.995, (doneW + stepW * frac) / totalW);
        const el = (Date.now() - t0) / 1000;
        job.etaSeconds = job.progress > 0.02 ? Math.max(0, Math.round((el / job.progress) * (1 - job.progress))) : undefined;
        this.emit(ji);
      }, (p) => (ji.proc = p));
      ji.proc = undefined;
      if (ji.cancelled) throw new Error("cancelled");
      if (step.parse === "loudnorm") sctx.loudnorm = parseLoudnorm(stderr);
      doneW += stepW;
      job.progress = Math.min(0.995, doneW / totalW);
      this.emit(ji, true);
    }
  }
}

function parseLoudnorm(stderr: string): LoudnormMeasure | undefined {
  const i = stderr.lastIndexOf("{");
  const j = stderr.lastIndexOf("}");
  if (i < 0 || j < i) return undefined;
  try {
    const o = JSON.parse(stderr.slice(i, j + 1));
    return { input_i: o.input_i, input_tp: o.input_tp, input_lra: o.input_lra, input_thresh: o.input_thresh, target_offset: o.target_offset };
  } catch {
    return undefined;
  }
}

/** Run ffmpeg with -progress; resolves with stderr text, rejects with the tail of stderr on failure. */
export function runFfmpeg(args: string[], onProgress?: (sec: number) => void, onSpawn?: (p: ChildProcess) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const full = [args[0] === "-y" ? "-y" : "", "-progress", "pipe:1", "-nostats", ...args.filter((a, i) => !(i === 0 && a === "-y"))].filter((a) => a !== "");
    const p = spawn(FFMPEG, full, { stdio: ["ignore", "pipe", "pipe"] });
    onSpawn?.(p);
    let err = "";
    let buf = "";
    p.stdout.on("data", (d: Buffer) => {
      buf += d.toString();
      let idx;
      while ((idx = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        const m = /^out_time_(?:us|ms)=(\d+)/.exec(line);
        if (m) onProgress?.(Number(m[1]) / 1e6);
      }
    });
    p.stderr.on("data", (d: Buffer) => {
      err += d.toString();
      if (err.length > 400_000) err = err.slice(-200_000);
    });
    p.on("error", (e) => reject(e));
    p.on("close", (code, signal) => {
      if (code === 0) resolve(err);
      else {
        const tail = err.split("\n").filter((l) => l.trim()).slice(-12).join("\n");
        reject(new Error(signal ? `ffmpeg killed (${signal})` : `ffmpeg failed (exit ${code}):\n${tail}`));
      }
    });
  });
}
