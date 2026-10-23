// Export renderer HTTP API + programmatic API (used by the AI agent).
//   POST /api/export                 {project, sequenceId, settings, graphics} → ExportJob
//   GET  /api/export/jobs            → ExportJob[]
//   POST /api/export/jobs/:id/cancel → {ok}
//   POST /api/export/jobs/clear      → {ok} (remove finished jobs)
//   POST /api/export/captions        {project, sequenceId, format, range?} → {text}
import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import type { ExportJob, ExportSettings, ID, MediaAsset, Project } from "../../shared/types";
import { defaultExportSettings, applyPreset } from "../../shared/exportPresets";
import { MEDIA_DIR, TMP_DIR, getSettings } from "../config";
import { broadcast } from "../events";
import { ExportQueue } from "./jobs";
import { captionsText, exportRange } from "./graph";

/** Absolute path of an asset's original file, or null if offline. */
export function resolveAssetPath(a: MediaAsset): string | null {
  if (a.path && fs.existsSync(a.path)) return a.path;
  const dir = path.join(MEDIA_DIR, a.id);
  try {
    const f = fs.readdirSync(dir).find((n) => n.startsWith("original."));
    if (f) return path.join(dir, f);
  } catch {
    /* ignore */
  }
  return null;
}

const queue = new ExportQueue({
  tmpRoot: path.join(TMP_DIR, "export"),
  defaultDirectory: () => getSettings().exportDirectory,
  resolveAssetPath,
  broadcast: (job) => broadcast({ type: "export", job }),
});

/** Fill in missing settings fields (AI agent / partial requests). */
export function normalizeSettings(project: Project, sequenceId: ID, s: Partial<ExportSettings> | undefined): ExportSettings {
  const seq = project.sequences[sequenceId];
  if (!seq) throw new Error(`Sequence ${sequenceId} not found`);
  let base = defaultExportSettings(seq);
  if (s?.presetId) base = applyPreset(base, s.presetId, seq);
  const out = { ...base, ...(s ?? {}) } as ExportSettings;
  if (!out.width || !out.height) {
    out.width = out.width || seq.settings.width;
    out.height = out.height || Math.round((out.width * seq.settings.height) / seq.settings.width / 2) * 2;
  }
  if (!out.fps) out.fps = seq.settings.fps;
  if (!out.fileName) out.fileName = seq.name;
  return out;
}

/**
 * Queue an export. Returns immediately with the queued job; progress is broadcast
 * as SSE {type:"export", job}. `graphics` maps clipId → PNG data URL (or absolute
 * PNG path) for generator/caption clips (see src/render/graphics.ts).
 */
export function startExportJob(project: Project, sequenceId: ID, settings: Partial<ExportSettings>, graphics: Record<ID, string> = {}): ExportJob {
  const s = normalizeSettings(project, sequenceId, settings);
  return queue.enqueue(project, sequenceId, s, graphics).job;
}

/** Same as startExportJob but resolves when the job finishes (done/error/cancelled). */
export function runExportJob(project: Project, sequenceId: ID, settings: Partial<ExportSettings>, graphics: Record<ID, string> = {}): Promise<ExportJob> {
  const s = normalizeSettings(project, sequenceId, settings);
  return queue.enqueue(project, sequenceId, s, graphics).done;
}

export function getJobs(): ExportJob[] {
  return queue.jobs();
}

export function cancelExportJob(id: ID): boolean {
  return queue.cancel(id);
}

export const exportRouter = Router();

exportRouter.post("/", (req, res) => {
  try {
    const { project, sequenceId, settings, graphics } = req.body ?? {};
    if (!project || !sequenceId) return void res.status(400).json({ error: "project and sequenceId are required" });
    res.json(startExportJob(project as Project, String(sequenceId), settings ?? {}, graphics ?? {}));
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

exportRouter.get("/jobs", (_req, res) => {
  res.json(getJobs());
});

exportRouter.post("/jobs/clear", (_req, res) => {
  queue.clearFinished();
  res.json({ ok: true });
});

exportRouter.post("/jobs/:id/cancel", (req, res) => {
  const ok = cancelExportJob(req.params.id);
  if (!ok) return void res.status(404).json({ error: "Job not found or already finished" });
  res.json({ ok: true });
});

exportRouter.post("/captions", (req, res) => {
  try {
    const { project, sequenceId, format, range } = req.body ?? {};
    const seq = (project as Project)?.sequences?.[sequenceId];
    if (!seq) return void res.status(400).json({ error: "Sequence not found" });
    const r = range === "inOut" ? exportRange(seq, { range: "inOut", format: "h264" } as ExportSettings) : exportRange(seq, { range: "entire", format: "h264" } as ExportSettings);
    res.json({ text: captionsText(seq, r, format === "vtt" ? "vtt" : "srt") });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});
