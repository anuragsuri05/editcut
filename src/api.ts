// Client for the EditCut local server (server/index.ts, port 5174, proxied by Vite at /api and /files).
// This file is the HTTP contract between browser and server.
import type { ExportJob, ExportSettings, ID, MediaAsset, Project, Transcript } from "@shared/types";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

const post = (url: string, body: unknown) =>
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export interface ProjectSummary { id: ID; name: string; updatedAt: number; path: string }
export interface ServerSettings { hasApiKey: boolean; model: string; whisperAvailable: boolean; whisperModel?: string; exportDirectory: string; dataDirectory: string }

export const api = {
  health: () => fetch("/api/health").then((r) => json<{ ok: true; ffmpeg: string }>(r)),

  // ---- projects (stored as JSON on the server) ----
  listProjects: () => fetch("/api/projects").then((r) => json<ProjectSummary[]>(r)),
  loadProject: (id: ID) => fetch(`/api/projects/${id}`).then((r) => json<Project>(r)),
  saveProject: (p: Project) =>
    fetch(`/api/projects/${p.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) }).then((r) => json<{ ok: true; savedAt: number }>(r)),
  deleteProject: (id: ID) => fetch(`/api/projects/${id}`, { method: "DELETE" }).then((r) => json<{ ok: true }>(r)),

  // ---- media ----
  /** Upload files from the browser. Returns assets immediately with status "importing"; processing continues server-side. */
  uploadMedia: (files: File[], onProgress?: (fraction: number) => void): Promise<MediaAsset[]> =>
    new Promise((resolve, reject) => {
      const fd = new FormData();
      for (const f of files) fd.append("files", f, f.name);
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/media/upload");
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
      xhr.onload = () => (xhr.status < 300 ? resolve(JSON.parse(xhr.responseText)) : reject(new Error(xhr.responseText || xhr.statusText)));
      xhr.onerror = () => reject(new Error("Upload failed"));
      xhr.send(fd);
    }),
  /** Import by absolute path on the server machine (no copy). */
  importPaths: (paths: string[]) => post("/api/media/import-paths", { paths }).then((r) => json<MediaAsset[]>(r)),
  /** Current state of an asset (poll while status === "importing"). */
  getMedia: (id: ID) => fetch(`/api/media/${id}`).then((r) => json<MediaAsset>(r)),
  /** Browse server filesystem for the Media Browser panel. */
  browse: (dir?: string) => fetch(`/api/fs?dir=${encodeURIComponent(dir ?? "")}`).then((r) => json<{ dir: string; parent: string | null; entries: { name: string; path: string; isDir: boolean; size: number }[] }>(r)),
  /** Generate a proxy for an asset. */
  createProxy: (id: ID) => post(`/api/media/${id}/proxy`, {}).then((r) => json<{ ok: true }>(r)),
  /** Scene cut times (seconds) via ffmpeg scene detection. */
  detectScenes: (id: ID, threshold = 0.3) => post(`/api/media/${id}/scenes`, { threshold }).then((r) => json<{ cuts: number[] }>(r)),
  /** Silent ranges via ffmpeg silencedetect. */
  detectSilence: (id: ID, noiseDb = -35, minDuration = 0.5) => post(`/api/media/${id}/silence`, { noiseDb, minDuration }).then((r) => json<{ silences: { start: number; end: number }[] }>(r)),
  /** Single frame JPEG url for a time (used for Export Frame and AI vision). */
  frameUrl: (id: ID, t: number, width = 640) => `/api/media/${id}/frame?t=${t}&w=${width}`,

  // ---- transcription (whisper.cpp) ----
  transcribe: (id: ID, language = "auto") => post(`/api/media/${id}/transcribe`, { language }).then((r) => json<Transcript>(r)),

  // ---- export ----
  /** graphics: rendered PNG data URLs for generator clips (text/shapes) keyed by clip id, so export matches preview exactly. */
  startExport: (body: { project: Project; sequenceId: ID; settings: ExportSettings; graphics: Record<ID, string> }) =>
    post("/api/export", body).then((r) => json<ExportJob>(r)),
  listExports: () => fetch("/api/export/jobs").then((r) => json<ExportJob[]>(r)),
  cancelExport: (id: ID) => post(`/api/export/jobs/${id}/cancel`, {}).then((r) => json<{ ok: true }>(r)),
  revealFile: (path: string) => post("/api/reveal", { path }).then((r) => json<{ ok: true }>(r)),

  // ---- settings ----
  getSettings: () => fetch("/api/settings").then((r) => json<ServerSettings>(r)),
  saveSettings: (s: Partial<{ anthropicApiKey: string; model: string; exportDirectory: string }>) => post("/api/settings", s).then((r) => json<ServerSettings>(r)),
};

/**
 * Server-sent events (media status, export progress). All subscribers share ONE
 * EventSource: browsers allow ~6 HTTP/1.1 connections per host and video range
 * requests need them. Event payloads: {type, ...}.
 */
const eventListeners = new Set<(e: ServerEvent) => void>();
let eventSource: EventSource | null = null;

export function subscribeEvents(onEvent: (e: ServerEvent) => void): () => void {
  eventListeners.add(onEvent);
  if (!eventSource) {
    eventSource = new EventSource("/api/events");
    eventSource.onmessage = (m) => {
      let data: ServerEvent;
      try {
        data = JSON.parse(m.data);
      } catch {
        return;
      }
      for (const l of eventListeners) l(data);
    };
  }
  return () => {
    eventListeners.delete(onEvent);
    if (!eventListeners.size && eventSource) {
      eventSource.close();
      eventSource = null;
    }
  };
}

export type ServerEvent =
  | { type: "media"; asset: MediaAsset }
  | { type: "media-progress"; id: ID; stage: string; progress: number }
  | { type: "export"; job: ExportJob }
  | { type: "transcribe-progress"; id: ID; progress: number };

// ---- AI agent (Claude) streaming chat ----
export type AIEvent =
  | { type: "text"; text: string } // streamed assistant text delta
  | { type: "thinking"; text: string } // progress/summary
  | { type: "tool_start"; id: string; name: string; input: unknown }
  | { type: "tool_result"; id: string; name: string; summary: string; isError?: boolean }
  | { type: "project"; project: Project; label: string } // updated project state to apply as ONE undoable step
  | { type: "export_started"; job: ExportJob }
  /** Sequence has titles/captions: the client renders graphics (src/render/graphics) and starts the export itself. */
  | { type: "export_request"; sequenceId: ID; settings: ExportSettings }
  | { type: "done"; messages: unknown[] } // full API message history for the next turn
  | { type: "error"; error: string };

export interface AIChatRequest {
  project: Project;
  sequenceId: ID | null;
  selection: { clipIds: ID[]; itemIds: ID[] };
  playhead: number;
  /** Prior Anthropic API messages returned by the last "done" event. */
  history: unknown[];
  message: string;
  /** Optional data-URL JPEG of the current Program Monitor frame. */
  programFrame?: string;
}

export async function streamAIChat(req: AIChatRequest, onEvent: (e: AIEvent) => void, signal?: AbortSignal): Promise<void> {
  const res = await fetch("/api/ai/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(req), signal });
  if (!res.ok || !res.body) throw new Error(await res.text());
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const line = chunk.split("\n").find((l) => l.startsWith("data: "));
      if (line) onEvent(JSON.parse(line.slice(6)));
    }
  }
}
