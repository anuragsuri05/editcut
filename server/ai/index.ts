// AI routes.
//   aiRouter        (mounted at /api/ai):   POST /chat (SSE agent), GET /whisper, POST /whisper/download
//   transcribeRouter (mounted at /api/media, before mediaRouter): POST /:id/transcribe
import { Router, type Request, type Response } from "express";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { AIChatRequest, AIEvent } from "../../src/api";
import { MEDIA_DIR } from "../config";
import { runAgentTurn } from "./agent";
import { DOWNLOADABLE_MODELS, downloadWhisperModel, transcribeMedia, whisperStatus } from "./transcribe";
import { assetPathFromRecord } from "./mediaTools";

export const aiRouter = Router();
export const transcribeRouter = Router();

const ChatBody = z.object({
  project: z.object({ id: z.string(), media: z.record(z.string(), z.unknown()), sequences: z.record(z.string(), z.unknown()) }).passthrough(),
  sequenceId: z.string().nullable().optional(),
  selection: z.object({ clipIds: z.array(z.string()), itemIds: z.array(z.string()) }).optional(),
  playhead: z.number().optional(),
  history: z.array(z.unknown()).optional(),
  message: z.string().min(1),
  programFrame: z.string().optional(),
});

aiRouter.post("/chat", async (req: Request, res: Response) => {
  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" });
  res.flushHeaders?.();
  const send = (e: AIEvent) => {
    if (!res.writableEnded) res.write(`data: ${JSON.stringify(e)}\n\n`);
  };
  const parsed = ChatBody.safeParse(req.body);
  if (!parsed.success) {
    send({ type: "error", error: "Bad request: " + parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") });
    send({ type: "done", messages: Array.isArray(req.body?.history) ? req.body.history : [] });
    return void res.end();
  }
  const body = parsed.data as unknown as AIChatRequest;
  const ac = new AbortController();
  // req 'close' fires as soon as the body is consumed; the response 'close' means the client went away
  res.on("close", () => {
    if (!res.writableFinished) ac.abort();
  });
  const ping = setInterval(() => !res.writableEnded && res.write(": ping\n\n"), 15000);
  try {
    await runAgentTurn(
      { ...body, sequenceId: body.sequenceId ?? null, selection: body.selection ?? { clipIds: [], itemIds: [] }, playhead: body.playhead ?? 0, history: body.history ?? [] },
      send,
      ac.signal,
    );
  } catch (e) {
    send({ type: "error", error: (e as Error).message });
  } finally {
    clearInterval(ping);
    res.end();
  }
});

aiRouter.get("/whisper", (_req, res) => {
  res.json({ ...whisperStatus(), models: DOWNLOADABLE_MODELS });
});

/** Explicit user action from AI Settings: download a whisper model into MODELS_DIR. */
aiRouter.post("/whisper/download", (req, res) => {
  const name = String(req.body?.model ?? "base");
  if (!DOWNLOADABLE_MODELS[name]) return void res.status(400).json({ error: `Unknown model ${name}` });
  if (whisperStatus().download?.active) return void res.status(409).json({ error: "Download already in progress" });
  downloadWhisperModel(name).catch((e) => console.error("whisper download failed:", (e as Error).message));
  res.json({ ok: true });
});

// ---------------------------------------------------------------- transcription route

async function resolveMediaPath(id: string, hint?: unknown): Promise<string | undefined> {
  if (typeof hint === "string" && hint && fs.existsSync(hint)) return hint;
  const rec = await assetPathFromRecord(id);
  if (rec && fs.existsSync(rec)) return rec;
  // media engineer stores originals as MEDIA_DIR/<id>/original.<ext>
  const dir = path.join(MEDIA_DIR, id);
  try {
    const f = fs.readdirSync(dir).find((n) => n.startsWith("original"));
    if (f) return path.join(dir, f);
  } catch {
    /* no dir */
  }
  return undefined;
}

transcribeRouter.post("/:id/transcribe", async (req, res) => {
  const id = String(req.params.id);
  if (!/^[\w-]+$/.test(id)) return void res.status(400).json({ error: "Bad media id" });
  const file = await resolveMediaPath(id, req.body?.path);
  if (!file) return void res.status(404).json({ error: "Media file not found for this asset" });
  const status = whisperStatus();
  if (!status.available) return void res.status(503).json({ error: status.binary ? "No whisper model installed. Download one in AI Settings." : "whisper.cpp (whisper-cli) is not installed." });
  const ac = new AbortController();
  res.on("close", () => {
    if (!res.writableFinished) ac.abort();
  });
  try {
    const t = await transcribeMedia(id, file, { language: typeof req.body?.language === "string" ? req.body.language : undefined, force: !!req.body?.force, signal: ac.signal });
    res.json(t);
  } catch (e) {
    if (!res.headersSent) res.status(500).json({ error: (e as Error).message });
  }
});
