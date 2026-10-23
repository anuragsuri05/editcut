// EditCut local server: media processing (ffmpeg), project storage, export renderer, Claude AI agent.
import express from "express";
import path from "node:path";
import fs from "node:fs";
import { execFile } from "node:child_process";
import { DATA_DIR, MEDIA_DIR, PORT, getSettings, updateSettings, apiKey } from "./config";
import { eventsHandler } from "./events";
import { mediaRouter, browseHandler } from "./media";
import { projectsRouter } from "./projects";
import { exportRouter } from "./export/index";
import { aiRouter, transcribeRouter } from "./ai/index";
import { whisperStatus } from "./ai/transcribe";

const app = express();
app.use(express.json({ limit: "500mb" }));

app.get("/api/health", (_req, res) => {
  execFile("ffmpeg", ["-version"], (err, out) => res.json({ ok: true, ffmpeg: err ? "missing" : out.split("\n")[0] }));
});
app.get("/api/events", eventsHandler);

app.get("/api/settings", (_req, res) => {
  const s = getSettings();
  const w = whisperStatus();
  res.json({ hasApiKey: !!apiKey(), model: s.model, whisperAvailable: w.available, whisperModel: w.model, exportDirectory: s.exportDirectory, dataDirectory: DATA_DIR });
});
app.post("/api/settings", (req, res) => {
  const { anthropicApiKey, model, exportDirectory } = req.body ?? {};
  const patch: Record<string, string> = {};
  if (typeof anthropicApiKey === "string") patch.anthropicApiKey = anthropicApiKey.trim();
  if (typeof model === "string" && model) patch.model = model;
  if (typeof exportDirectory === "string" && exportDirectory) patch.exportDirectory = exportDirectory;
  const s = updateSettings(patch);
  const w = whisperStatus();
  res.json({ hasApiKey: !!apiKey(), model: s.model, whisperAvailable: w.available, whisperModel: w.model, exportDirectory: s.exportDirectory, dataDirectory: DATA_DIR });
});

app.post("/api/reveal", (req, res) => {
  const p = String(req.body?.path ?? "");
  if (!p || !fs.existsSync(p)) return void res.status(404).json({ error: "File not found" });
  execFile(process.platform === "darwin" ? "open" : "xdg-open", process.platform === "darwin" ? ["-R", p] : [path.dirname(p)]);
  res.json({ ok: true });
});

app.use("/files/media", express.static(MEDIA_DIR, { fallthrough: false, maxAge: "1h" }));
app.use("/api/media", transcribeRouter);
app.use("/api/media", mediaRouter);
app.get("/api/fs", browseHandler);
app.use("/api/projects", projectsRouter);
app.use("/api/export", exportRouter);
app.use("/api/ai", aiRouter);

// production: serve built client
const dist = path.resolve("dist");
if (process.env.NODE_ENV === "production" && fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api|files).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

app.listen(PORT, "127.0.0.1", () => console.log(`EditCut server on http://localhost:${PORT} (data: ${DATA_DIR})`));
