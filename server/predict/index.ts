// Content Lab: upload a video, get a second-by-second prediction of how it will
// perform on social platforms. Pipeline: probe -> playable copy + thumbnails ->
// transcript -> ffmpeg features -> TRIBE v2 brain response (optional, remote GPU
// worker) -> scoring -> Claude coaching (optional). Mounted at /api/predict.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { Router } from "express";
import multer from "multer";
import type { PlatformId, PredictJob, PredictOptions, PredictionReport } from "../../shared/predict";
import { PLATFORMS } from "../../shared/predict";
import { DATA_DIR, getSettings, updateSettings } from "../config";
import { broadcast } from "../events";
import { assetWorkingPath, extractFrameJpeg, getAssetRecord, isBrowserPlayable, makeThumbSprite, probeMedia } from "../media";
import { transcribeMedia, whisperStatus } from "../ai/transcribe";
import { resolveProvider } from "../ai/index";
import { extractFeatures } from "./features";
import { runTribe, tribeHealth } from "./tribe";
import { scoreReport } from "./score";
import { writeCoaching, type CoachFrame } from "./coach";

export const PREDICT_DIR = path.join(DATA_DIR, "predict");
fs.mkdirSync(PREDICT_DIR, { recursive: true });

export const predictRouter = Router();

const jobs = new Map<string, PredictJob>();
const aborts = new Map<string, AbortController>();
let queue: Promise<unknown> = Promise.resolve();

const newId = () => "rpt_" + crypto.randomUUID().replace(/-/g, "").slice(0, 12);

function update(job: PredictJob, patch: Partial<PredictJob>): void {
  Object.assign(job, patch);
  broadcast({ type: "predict", job: { ...job } });
}

function ffmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => execFile("ffmpeg", args, { maxBuffer: 64 * 1024 * 1024 }, (err, _o, stderr) => (err ? reject(new Error(String(stderr).slice(-400))) : resolve())));
}

const PLATFORM_IDS = PLATFORMS.map((p) => p.id);

function cleanOptions(raw: unknown): PredictOptions {
  const o = (raw ?? {}) as PredictOptions;
  return {
    platforms: Array.isArray(o.platforms) ? o.platforms.filter((p): p is PlatformId => PLATFORM_IDS.includes(p)) : undefined,
    useTribe: o.useTribe !== false,
    useClaude: o.useClaude !== false,
    tribeText: !!o.tribeText,
    goal: typeof o.goal === "string" ? o.goal.slice(0, 500) : undefined,
  };
}

/** Queue an analysis of `file` (already inside or referenced from the report dir). */
function enqueue(id: string, file: string, fileName: string, options: PredictOptions, source?: string): PredictJob {
  const job: PredictJob = { id: "job_" + id.slice(4), fileName, status: "queued", stage: "Queued", progress: 0, createdAt: Date.now(), options };
  jobs.set(job.id, job);
  const ac = new AbortController();
  aborts.set(job.id, ac);
  broadcast({ type: "predict", job: { ...job } });
  queue = queue
    .then(() => (ac.signal.aborted ? undefined : analyze(id, file, fileName, options, job, ac.signal, source)))
    .catch(() => undefined)
    .finally(() => aborts.delete(job.id));
  return job;
}

async function analyze(id: string, file: string, fileName: string, options: PredictOptions, job: PredictJob, signal: AbortSignal, source?: string): Promise<void> {
  const checkpoint = () => {
    if (signal.aborted) throw new Error("cancelled");
  };
  const dir = path.join(PREDICT_DIR, id);
  fs.mkdirSync(dir, { recursive: true });
  try {
    update(job, { status: "running", stage: "Analyzing video", progress: 0.03 });
    const probe = await probeMedia(file);
    if (!probe.hasVideo) throw new Error("This file has no video stream");
    const duration = probe.duration;
    if (!duration || duration < 1) throw new Error("Video is too short to analyze");

    // a browser-playable copy for the report player
    let videoName = "video.mp4";
    if (isBrowserPlayable(file, probe) && (probe.width ?? 0) * (probe.height ?? 0) <= 1920 * 1080) {
      videoName = "video" + path.extname(file).toLowerCase();
      const dest = path.join(dir, videoName);
      if (path.resolve(file) !== path.resolve(dest)) {
        fs.rmSync(dest, { force: true });
        fs.symlinkSync(path.resolve(file), dest);
      }
    } else {
      update(job, { stage: "Making a playable copy", progress: 0.06 });
      await ffmpeg(["-v", "error", "-y", "-i", file, "-vf", "scale='min(1280,iw)':-2", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", path.join(dir, videoName)]);
    }
    checkpoint();
    update(job, { stage: "Rendering thumbnails", progress: 0.12 });
    const thumbs = await makeThumbSprite(file, probe, path.join(dir, "thumbs.jpg")).catch(() => null);

    let transcript;
    if (probe.hasAudio && whisperStatus().available) {
      update(job, { stage: "Transcribing speech", progress: 0.2 });
      transcript = await transcribeMedia(`predict_${id}`, file, { signal }).catch(() => undefined);
      checkpoint();
    }

    update(job, { stage: "Measuring cuts, motion and audio", progress: 0.35 });
    const features = await extractFeatures(file, duration, { hasAudio: probe.hasAudio, transcript, signal });
    checkpoint();

    let tribe;
    let tribeState: PredictionReport["engine"]["tribe"] = options.useTribe ? "unavailable" : "disabled";
    let tribeError: string | undefined;
    if (options.useTribe) {
      const health = await tribeHealth();
      if (health.configured) {
        update(job, { stage: "TRIBE v2: predicting brain response", progress: 0.5 });
        try {
          tribe = await runTribe(file, { useText: !!options.tribeText, signal });
          // align to our per-second grid
          const n = features.length;
          for (const k of Object.keys(tribe.networks) as (keyof typeof tribe.networks)[]) {
            const v = tribe.networks[k];
            tribe.networks[k] = Array.from({ length: n }, (_, i) => v[Math.min(i, v.length - 1)] ?? 0);
          }
          tribe.global = Array.from({ length: n }, (_, i) => tribe!.global[Math.min(i, tribe!.global.length - 1)] ?? 0);
          tribeState = "used";
        } catch (e) {
          checkpoint();
          tribeState = "failed";
          tribeError = (e as Error).message;
        }
      } else tribeError = "No TRIBE v2 worker connected";
    }

    update(job, { stage: "Scoring and simulating retention", progress: 0.85 });
    const platforms = options.platforms?.length ? options.platforms : (["tiktok", "reels", "shorts", "youtube"] as PlatformId[]);
    const scored = scoreReport(features, platforms, { width: probe.width, height: probe.height }, tribe);
    const transcriptText = transcript?.segments.map((s) => s.text.trim()).join(" ");

    const report: PredictionReport = {
      id, createdAt: Date.now(), fileName, durationSec: duration, width: probe.width, height: probe.height,
      thumbs: thumbs ? { url: `/files/predict/${id}/thumbs.jpg`, count: thumbs.count, width: thumbs.width, height: thumbs.height, interval: thumbs.interval } : undefined,
      videoUrl: `/files/predict/${id}/${videoName}`,
      engine: { tribe: tribeState, tribeError, mock: tribe?.mock, claude: options.useClaude ? "unavailable" : "skipped" },
      features, tribe, ...scored, transcript: transcriptText, source,
    };

    if (options.useClaude && (await resolveProvider())) {
      update(job, { stage: "Claude is writing your coaching notes", progress: 0.9 });
      try {
        const peak = scored.moments.find((m) => m.kind === "peak");
        const dip = scored.moments.find((m) => m.kind === "dip");
        const shots: [string, number][] = [["Opening frame (0.5s)", 0.5]];
        if (peak) shots.push([`Peak moment (${peak.start}s)`, peak.start + 1]);
        if (dip) shots.push([`Attention dip (${dip.start}s)`, dip.start + 1]);
        const frames: CoachFrame[] = [];
        for (const [label, t] of shots) {
          const jpg = await extractFrameJpeg(file, Math.min(t, duration - 0.1), 512).catch(() => null);
          if (jpg) frames.push({ label, jpegBase64: jpg.toString("base64") });
        }
        report.coaching = (await writeCoaching(report, frames, options.goal, signal)) ?? undefined;
        report.engine.claude = report.coaching ? "used" : "unavailable";
      } catch (e) {
        checkpoint();
        report.engine.claude = "failed";
        report.coaching = `_Claude couldn't write coaching notes: ${(e as Error).message}_`;
      }
    }

    fs.writeFileSync(path.join(dir, "report.json"), JSON.stringify(report));
    update(job, { status: "done", stage: "Done", progress: 1, reportId: id });
  } catch (e) {
    if (signal.aborted) {
      fs.rmSync(dir, { recursive: true, force: true });
      update(job, { status: "cancelled", stage: "Cancelled", error: undefined });
    } else update(job, { status: "error", stage: "Failed", error: (e as Error).message });
  }
}

// ---------------------------------------------------------------- routes

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const id = newId();
      (req as unknown as { reportId: string }).reportId = id;
      const dir = path.join(PREDICT_DIR, id);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => cb(null, "source" + (path.extname(file.originalname).toLowerCase() || ".mp4")),
  }),
  limits: { fileSize: 8 * 1024 ** 3 },
});

predictRouter.post("/upload", upload.single("file"), (req, res) => {
  const file = req.file;
  if (!file) return void res.status(400).json({ error: "No file uploaded (field 'file')" });
  let options: unknown = {};
  try {
    options = JSON.parse(String(req.body?.options ?? "{}"));
  } catch {
    /* defaults */
  }
  const id = (req as unknown as { reportId: string }).reportId;
  res.json(enqueue(id, file.path, file.originalname, cleanOptions(options)));
});

predictRouter.post("/from-path", (req, res) => {
  const p = String(req.body?.path ?? "");
  if (!p || !fs.existsSync(p) || !fs.statSync(p).isFile()) return void res.status(404).json({ error: "File not found" });
  const source = typeof req.body?.source === "string" ? req.body.source.slice(0, 100) : undefined;
  res.json(enqueue(newId(), p, String(req.body?.fileName ?? path.basename(p)), cleanOptions(req.body?.options), source));
});

predictRouter.post("/from-asset", (req, res) => {
  const id = String(req.body?.assetId ?? "");
  const asset = getAssetRecord(id);
  const p = assetWorkingPath(id);
  if (!asset || !p || !fs.existsSync(p)) return void res.status(404).json({ error: "Media not found" });
  res.json(enqueue(newId(), p, asset.name, cleanOptions(req.body?.options), `asset:${id}`));
});

predictRouter.delete("/jobs/:id", (req, res) => {
  const job = jobs.get(String(req.params.id));
  if (!job) return void res.status(404).json({ error: "Job not found" });
  if (job.status === "queued" || job.status === "running") {
    aborts.get(job.id)?.abort();
    if (job.status === "queued") update(job, { status: "cancelled", stage: "Cancelled" });
  }
  res.json({ ok: true });
});

predictRouter.get("/jobs", (_req, res) => res.json([...jobs.values()].sort((a, b) => b.createdAt - a.createdAt)));

function readReport(id: string): PredictionReport | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(PREDICT_DIR, id, "report.json"), "utf8"));
  } catch {
    return null;
  }
}

predictRouter.get("/reports", (_req, res) => {
  const out = [];
  for (const id of fs.readdirSync(PREDICT_DIR)) {
    const r = readReport(id);
    if (r) out.push({ id, fileName: r.fileName, createdAt: r.createdAt, durationSec: r.durationSec, score: r.overall.score, bestPlatform: r.bestPlatform, tribe: r.engine.tribe, thumbUrl: r.thumbs?.url });
  }
  res.json(out.sort((a, b) => b.createdAt - a.createdAt));
});

predictRouter.get("/reports/:id", (req, res) => {
  const id = String(req.params.id);
  if (!/^rpt_\w+$/.test(id)) return void res.status(400).json({ error: "Bad id" });
  const r = readReport(id);
  if (!r) return void res.status(404).json({ error: "Report not found" });
  res.json(r);
});

predictRouter.delete("/reports/:id", (req, res) => {
  const id = String(req.params.id);
  if (!/^rpt_\w+$/.test(id)) return void res.status(400).json({ error: "Bad id" });
  fs.rmSync(path.join(PREDICT_DIR, id), { recursive: true, force: true });
  res.json({ ok: true });
});

async function status() {
  return { tribe: await tribeHealth(), claude: await resolveProvider(), whisper: whisperStatus().available };
}

predictRouter.get("/status", async (_req, res) => res.json(await status()));

predictRouter.post("/settings", async (req, res) => {
  const patch: { tribeUrl?: string; tribeToken?: string } = {};
  if (typeof req.body?.tribeUrl === "string") patch.tribeUrl = req.body.tribeUrl.trim();
  if (typeof req.body?.tribeToken === "string") patch.tribeToken = req.body.tribeToken.trim();
  updateSettings(patch);
  res.json(await status());
});

void getSettings;
