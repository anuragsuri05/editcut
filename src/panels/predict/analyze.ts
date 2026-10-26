// Starting analyses from the editor: the active sequence (rendered with a fast
// preset first) or the selected project media item.
import type { ExportJob } from "@shared/types";
import { applyPreset, defaultExportSettings } from "@shared/exportPresets";
import { api } from "../../api";
import { useEditor } from "../../store/store";
import { defaultDirectory, startExportSync, submitExport, useExportJobs } from "../export/exportClient";
import { toPredictOptions, useLab } from "./labStore";

const ed = () => useEditor.getState();

export function activeSequence() {
  const p = ed().project;
  return p.activeSequenceId ? p.sequences[p.activeSequenceId] ?? null : null;
}

/** First selected project item that is a video (or audio) media asset. */
export function selectedAsset() {
  const p = ed().project;
  for (const id of ed().selection.itemIds) {
    const a = p.media[id];
    if (a && (a.hasVideo || a.hasAudio) && a.kind !== "image") return a;
  }
  return null;
}

function waitForExport(jobId: string): Promise<ExportJob> {
  return new Promise((resolve, reject) => {
    const check = (jobs: ExportJob[]) => {
      const j = jobs.find((x) => x.id === jobId);
      if (!j) return false;
      if (j.status === "done") resolve(j);
      else if (j.status === "error") reject(new Error(j.error?.split("\n")[0] ?? "Render failed"));
      else if (j.status === "cancelled") reject(new Error("Render cancelled"));
      else return false;
      return true;
    };
    if (check(useExportJobs.getState().jobs)) return;
    const unsub = useExportJobs.subscribe((s) => {
      if (check(s.jobs)) unsub();
    });
  });
}

/** Render the active sequence with a fast H.264 preset, then send the file to the Content Lab. */
export async function analyzeActiveSequence(): Promise<void> {
  const seq = activeSequence();
  const lab = useLab.getState();
  if (!seq || !seq.clips.length) {
    ed().toast(seq ? "The active sequence is empty" : "No active sequence to analyze", "error");
    return;
  }
  ed().setUI({ mode: "predict" });
  const name = `${seq.name} (Content Lab)`;
  lab.setView({ kind: "progress", jobId: null, fileName: seq.name, prep: "render", upload: 0 });
  try {
    const s = applyPreset(defaultExportSettings(seq), "match-medium", seq);
    const scale = Math.min(1, 1280 / Math.max(seq.settings.width, seq.settings.height));
    s.width = Math.round((seq.settings.width * scale) / 2) * 2;
    s.height = Math.round((seq.settings.height * scale) / 2) * 2;
    s.videoBitrateMbps = 6;
    s.range = "entire";
    s.fileName = name;
    s.hardwareEncoding = true;
    s.useMaxRenderQuality = false;
    s.burnCaptions = true;
    s.exportCaptionsSidecar = "none";
    s.directory = await defaultDirectory();
    startExportSync();
    const job = await submitExport(ed().project, seq.id, s);
    const unsub = useExportJobs.subscribe((st) => {
      const j = st.jobs.find((x) => x.id === job.id);
      const v = useLab.getState().view;
      if (j && v.kind === "progress" && v.jobId === null) useLab.getState().setView({ ...v, upload: j.progress });
    });
    let done: ExportJob;
    try {
      done = await waitForExport(job.id);
    } finally {
      unsub();
    }
    const v = useLab.getState().view;
    if (v.kind !== "progress" || v.jobId !== null) return; // user navigated away
    const pj = await api.predictPath(done.outputPath, toPredictOptions(useLab.getState().options, useLab.getState().status), seq.name, seq.id);
    useLab.getState().trackJob(pj, seq.id);
  } catch (e) {
    const v = useLab.getState().view;
    if (v.kind === "progress") useLab.getState().setView({ ...v, error: (e as Error).message });
  }
}

/** Analyze the selected project media item (by asset id, server reads it in place). */
export async function analyzeSelectedAsset(): Promise<void> {
  const a = selectedAsset();
  if (!a) {
    ed().toast("Select a video clip in the Project panel first", "error");
    return;
  }
  ed().setUI({ mode: "predict" });
  const lab = useLab.getState();
  lab.setView({ kind: "progress", jobId: null, fileName: a.name, prep: "asset" });
  try {
    const job = await api.predictAsset(a.id, toPredictOptions(lab.options, lab.status));
    useLab.getState().trackJob(job, `asset:${a.id}`);
  } catch (e) {
    useLab.getState().setView({ kind: "progress", jobId: null, fileName: a.name, prep: "asset", error: (e as Error).message });
  }
}

/** Upload a local file (drop zone / picker). */
export async function analyzeFile(file: File): Promise<void> {
  const lab = useLab.getState();
  lab.setView({ kind: "progress", jobId: null, fileName: file.name, prep: "upload", upload: 0 });
  try {
    const job = await api.predictUpload(file, toPredictOptions(lab.options, lab.status), (f) => {
      const v = useLab.getState().view;
      if (v.kind === "progress" && v.jobId === null) useLab.getState().setView({ ...v, upload: f });
    });
    const v = useLab.getState().view;
    if (v.kind === "progress" && v.jobId === null) useLab.getState().trackJob(job);
    else useLab.getState().upsertJob(job);
  } catch (e) {
    const v = useLab.getState().view;
    if (v.kind === "progress") useLab.getState().setView({ ...v, error: (e as Error).message });
  }
}
