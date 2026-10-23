// Media Encoder-style queue: every export job with progress, ETA, status, cancel and reveal.
import { useEffect, useState, type ReactNode } from "react";
import { FolderOpen, X, AlertTriangle, CheckCircle2, Loader2, Clock, Ban, Trash2 } from "lucide-react";
import type { ExportJob } from "@shared/types";
import { formatInfo } from "@shared/exportPresets";
import { IconButton, Progress } from "../../ui/kit";
import { cancelExport, clearFinishedExports, revealOutput, startExportSync, useExportJobs } from "./exportClient";
import "./export.css";

function fmtEta(s?: number): string {
  if (s === undefined || !Number.isFinite(s)) return "";
  if (s < 60) return `${Math.max(1, Math.round(s))}s left`;
  const m = Math.floor(s / 60);
  return `${m}m ${String(Math.round(s % 60)).padStart(2, "0")}s left`;
}

function fmtElapsed(j: ExportJob): string {
  if (!j.startedAt) return "";
  const end = j.finishedAt ?? Date.now();
  const s = Math.max(0, (end - j.startedAt) / 1000);
  return s < 60 ? `${s.toFixed(1)}s` : `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}

const STATUS: Record<ExportJob["status"], { label: string; icon: ReactNode }> = {
  queued: { label: "Queued", icon: <Clock size={13} /> },
  rendering: { label: "Encoding", icon: <Loader2 size={13} className="spin" /> },
  done: { label: "Done", icon: <CheckCircle2 size={13} /> },
  error: { label: "Failed", icon: <AlertTriangle size={13} /> },
  cancelled: { label: "Stopped", icon: <Ban size={13} /> },
};

export function JobRow({ job }: { job: ExportJob }) {
  const [open, setOpen] = useState(false);
  const st = STATUS[job.status];
  const file = job.outputPath.split(/[\\/]/).pop();
  const dir = job.outputPath.slice(0, job.outputPath.length - (file?.length ?? 0));
  const details = (job.warnings?.length ?? 0) > 0 || !!job.error;
  return (
    <div className={`xq-job ${job.status}`}>
      <div className="xq-row1">
        <span className={`xq-status ${job.status}`} title={st.label}>
          {st.icon}
          {st.label}
        </span>
        <span className="xq-name" title={job.outputPath}>
          {file}
        </span>
        <span className="xq-meta">
          {job.sequenceName}
          {job.presetName ? ` · ${job.presetName}` : job.format ? ` · ${formatInfo(job.format).label}` : ""}
        </span>
        <span className="spacer" />
        {job.status === "rendering" || job.status === "queued" ? (
          <IconButton title="Stop" onClick={() => void cancelExport(job.id)}>
            <X size={14} />
          </IconButton>
        ) : null}
        {job.status === "done" ? (
          <IconButton title="Reveal in Finder" onClick={() => revealOutput(job.outputPath)}>
            <FolderOpen size={14} />
          </IconButton>
        ) : null}
      </div>
      <div className="xq-row2">
        <Progress value={job.status === "done" ? 1 : job.progress} />
        <span className="xq-pct">{job.status === "rendering" ? `${Math.round(job.progress * 100)}%` : ""}</span>
        <span className="xq-eta">{job.status === "rendering" ? fmtEta(job.etaSeconds) : job.status === "done" ? `in ${fmtElapsed(job)}` : ""}</span>
      </div>
      <div className="xq-path" title={job.outputPath} onClick={() => job.status === "done" && revealOutput(job.outputPath)}>
        {dir}
      </div>
      {details ? (
        <div className="xq-details">
          <button className="xq-more" onClick={() => setOpen(!open)}>
            {open ? "Hide details" : job.error ? "Show error" : `${job.warnings!.length} warning${job.warnings!.length > 1 ? "s" : ""}`}
          </button>
          {open ? <pre className="xq-log">{[job.error, ...(job.warnings ?? [])].filter(Boolean).join("\n")}</pre> : null}
        </div>
      ) : null}
    </div>
  );
}

export function JobList({ jobs, empty }: { jobs: ExportJob[]; empty?: string }) {
  if (!jobs.length) return <div className="panel-empty">{empty ?? "No exports yet. Use File › Export › Media (⌘M) or Quick Export."}</div>;
  return (
    <div className="xq-list">
      {jobs.map((j) => (
        <JobRow key={j.id} job={j} />
      ))}
    </div>
  );
}

export default function ExportQueuePanel() {
  const jobs = useExportJobs((s) => s.jobs);
  const [, tick] = useState(0);
  useEffect(() => startExportSync(), []);
  // refresh elapsed timers while something renders
  const active = jobs.some((j) => j.status === "rendering");
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => tick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [active]);
  const ordered = [...jobs].sort((a, b) => order(a) - order(b) || (b.startedAt ?? 0) - (a.startedAt ?? 0));
  const queued = jobs.filter((j) => j.status === "queued").length;
  const finished = jobs.filter((j) => j.status !== "queued" && j.status !== "rendering").length;
  return (
    <div className="xq-panel">
      <div className="xq-toolbar">
        <span className="xq-title">Queue</span>
        <span className="muted">
          {active ? "Encoding" : "Idle"}
          {queued ? ` · ${queued} waiting` : ""}
        </span>
        <span className="spacer" />
        <IconButton title="Clear finished" disabled={!finished} onClick={() => void clearFinishedExports()}>
          <Trash2 size={14} />
        </IconButton>
      </div>
      <JobList jobs={ordered} />
    </div>
  );
}

function order(j: ExportJob): number {
  return j.status === "rendering" ? 0 : j.status === "queued" ? 1 : 2;
}
