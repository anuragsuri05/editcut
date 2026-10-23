// Client side of exporting: job store (fed by SSE), graphics pre-rendering, submit helpers.
import { create } from "zustand";
import type { ExportJob, ExportSettings, ID, Project, Sequence } from "@shared/types";
import { applyPreset, captionsText, defaultExportSettings, exportRangeOf, QUICK_EXPORT_PRESET_ID } from "@shared/exportPresets";
import { api, subscribeEvents } from "../../api";
import { renderClipToPNG } from "../../render/graphics";
import { useEditor } from "../../store/store";

const ed = () => useEditor.getState();

// ---------------------------------------------------------------- job store

interface ExportJobsState {
  jobs: ExportJob[];
  upsert: (j: ExportJob) => void;
  set: (jobs: ExportJob[]) => void;
}

export const useExportJobs = create<ExportJobsState>()((set) => ({
  jobs: [],
  upsert: (j) =>
    set((s) => {
      const i = s.jobs.findIndex((x) => x.id === j.id);
      if (i < 0) return { jobs: [...s.jobs, j] };
      const jobs = s.jobs.slice();
      jobs[i] = j;
      return { jobs };
    }),
  set: (jobs) => set({ jobs }),
}));

const terminal = (s: ExportJob["status"]) => s === "done" || s === "error" || s === "cancelled";
const fileName = (p: string) => p.split(/[\\/]/).pop() ?? p;

function onJob(j: ExportJob) {
  const prev = useExportJobs.getState().jobs.find((x) => x.id === j.id);
  useExportJobs.getState().upsert(j);
  // status bar
  if (j.status === "rendering" || j.status === "queued") ed().setJob(`export:${j.id}`, { label: `Exporting ${fileName(j.outputPath)}${j.status === "queued" ? " (queued)" : ""}`, progress: j.progress });
  else ed().setJob(`export:${j.id}`, null);
  if (prev && !terminal(prev.status) && terminal(j.status)) {
    if (j.status === "done") ed().toast(`Export complete: ${fileName(j.outputPath)}`, "success");
    else if (j.status === "error") ed().toast(`Export failed: ${j.error?.split("\n")[0] ?? "unknown error"}`, "error");
    else ed().toast(`Export cancelled: ${fileName(j.outputPath)}`);
  }
}

let started = false;
/** Subscribe to export progress (idempotent). */
export function startExportSync(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  subscribeEvents((e) => {
    if (e.type === "export") onJob(e.job);
  });
  api
    .listExports()
    .then((jobs) => {
      useExportJobs.getState().set(jobs);
      for (const j of jobs) if (!terminal(j.status)) onJob(j);
    })
    .catch(() => {});
}

// ---------------------------------------------------------------- export settings memory

interface ExportUIState {
  /** Last settings per sequence id (Premiere remembers export settings per sequence). */
  bySeq: Record<ID, ExportSettings>;
  directory: string | null;
  setFor: (id: ID, s: ExportSettings) => void;
  setDirectory: (d: string) => void;
}

export const useExportUI = create<ExportUIState>()((set) => ({
  bySeq: {},
  directory: null,
  setFor: (id, s) => set((st) => ({ bySeq: { ...st.bySeq, [id]: s } })),
  setDirectory: (d) => set({ directory: d }),
}));

let dirPromise: Promise<string> | null = null;
export function defaultDirectory(): Promise<string> {
  const known = useExportUI.getState().directory;
  if (known) return Promise.resolve(known);
  dirPromise ??= api
    .getSettings()
    .then((s) => {
      useExportUI.getState().setDirectory(s.exportDirectory);
      return s.exportDirectory;
    })
    .catch(() => "~/Movies/EditCut");
  return dirPromise;
}

export function settingsFor(seq: Sequence): ExportSettings {
  const saved = useExportUI.getState().bySeq[seq.id];
  if (saved) return saved;
  const s = defaultExportSettings(seq);
  if (seq.inPoint !== undefined || seq.outPoint !== undefined) s.range = "inOut";
  return s;
}

// ---------------------------------------------------------------- graphics

/** Render every generator/caption clip of a sequence (and nested sequences) to PNG data URLs. */
export function collectGraphics(project: Project, seqId: ID, opts: { captions: boolean } = { captions: true }): Record<ID, string> {
  const out: Record<ID, string> = {};
  const seen = new Set<ID>();
  const walk = (id: ID) => {
    if (seen.has(id)) return;
    seen.add(id);
    const seq = project.sequences[id];
    if (!seq) return;
    for (const c of seq.clips) {
      if (c.enabled === false) continue;
      if (c.sequenceId) walk(c.sequenceId);
      if (c.generator && c.generator.kind !== "adjustmentLayer") {
        const png = renderClipToPNG(c, seq.settings);
        if (png) out[c.id] = png;
      } else if (c.caption && opts.captions) {
        const png = renderClipToPNG(c, seq.settings);
        if (png) out[c.id] = png;
      }
    }
  };
  walk(seqId);
  return out;
}

// ---------------------------------------------------------------- submit

export interface CustomRange {
  start: number;
  end: number;
}

/** Queue an export on the server. A custom range is applied to a copy of the sequence as In/Out. */
export async function submitExport(project: Project, seqId: ID, settings: ExportSettings, custom?: CustomRange | null): Promise<ExportJob> {
  let proj = project;
  let s = settings;
  if (custom && custom.end > custom.start) {
    const seq = project.sequences[seqId];
    proj = { ...project, sequences: { ...project.sequences, [seqId]: { ...seq, inPoint: custom.start, outPoint: custom.end } } };
    s = { ...settings, range: "inOut" };
  }
  const graphics = collectGraphics(proj, seqId, { captions: s.burnCaptions });
  const job = await api.startExport({ project: proj, sequenceId: seqId, settings: s, graphics });
  startExportSync();
  onJob(job);
  return job;
}

/** Quick Export (header button): Match Source – High Bitrate H.264 to the default folder, In/Out respected. */
export async function quickExport(): Promise<void> {
  const project = ed().project;
  const seqId = project.activeSequenceId;
  const seq = seqId ? project.sequences[seqId] : null;
  if (!seq) {
    ed().toast("No active sequence to export", "error");
    return;
  }
  if (!seq.clips.length) {
    ed().toast("The sequence is empty", "error");
    return;
  }
  const base = applyPreset(defaultExportSettings(seq), QUICK_EXPORT_PRESET_ID, seq);
  base.range = seq.inPoint !== undefined || seq.outPoint !== undefined ? "inOut" : "entire";
  base.directory = await defaultDirectory();
  try {
    const job = await submitExport(project, seq.id, base);
    ed().toast(`Quick Export started → ${job.outputPath}`, "info");
  } catch (e) {
    ed().toast(`Quick Export failed: ${(e as Error).message}`, "error");
  }
}

/** Download the caption track as SRT/VTT (File > Export > Captions). */
export function downloadCaptions(format: "srt" | "vtt" = "srt"): void {
  const project = ed().project;
  const seq = project.activeSequenceId ? project.sequences[project.activeSequenceId] : null;
  if (!seq) {
    ed().toast("No active sequence", "error");
    return;
  }
  const text = captionsText(seq, exportRangeOf(seq, { range: "entire", format: "h264" }), format);
  if (!text) {
    ed().toast("This sequence has no captions", "error");
    return;
  }
  const blob = new Blob([text], { type: format === "vtt" ? "text/vtt" : "application/x-subrip" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${seq.name}.${format}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  ed().toast(`Captions exported (${format.toUpperCase()})`, "success");
}

export async function cancelExport(id: ID): Promise<void> {
  try {
    await api.cancelExport(id);
  } catch (e) {
    ed().toast((e as Error).message, "error");
  }
}

export async function clearFinishedExports(): Promise<void> {
  try {
    await fetch("/api/export/jobs/clear", { method: "POST" });
  } catch {
    /* ignore */
  }
  useExportJobs.getState().set(useExportJobs.getState().jobs.filter((j) => !terminal(j.status)));
}

export function revealOutput(path: string): void {
  api.revealFile(path).catch((e) => ed().toast((e as Error).message, "error"));
}
