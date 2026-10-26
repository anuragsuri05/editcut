// Content Lab progress: stepper driven by job.stage text + progress.
import { api } from "../../api";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, Check, Loader2, MinusCircle } from "lucide-react";
import { Button, Progress } from "../../ui/kit";
import { useLab } from "./labStore";

interface Step {
  id: string;
  label: string;
  match: RegExp;
  skipped?: boolean;
}

function useElapsed(since: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const s = Math.max(0, Math.round((now - since) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function ProgressScreen() {
  const view = useLab((s) => s.view);
  const jobs = useLab((s) => s.jobs);
  const options = useLab((s) => s.options);
  const status = useLab((s) => s.status);
  const setView = useLab((s) => s.setView);
  const refreshHistory = useLab((s) => s.refreshHistory);
  const started = useRef(Date.now());
  const maxIdx = useRef(0);
  const elapsed = useElapsed(started.current);
  if (view.kind !== "progress") return null;
  const job = view.jobId ? jobs[view.jobId] : undefined;

  // prefer the options the server is actually running with
  const runOpts = job?.options ?? options;
  const tribeOn = runOpts.useTribe !== false && !!status?.tribe.reachable;
  const claudeOn = runOpts.useClaude !== false && !!status?.claude;
  const steps: Step[] = [
    view.prep === "render"
      ? { id: "prep", label: "Render sequence", match: /render|export/i }
      : view.prep === "asset"
        ? { id: "prep", label: "Locate clip", match: /locat|queue/i }
        : { id: "prep", label: "Upload", match: /upload|receiv/i },
    { id: "video", label: "Analyzing video", match: /analy|playable|thumb|probe|ffmpeg/i },
    { id: "transcribe", label: "Transcribing", match: /transcri|whisper/i },
    { id: "measure", label: "Measuring cuts, motion & audio", match: /measur|cut|motion|loud|scene|feature/i },
    { id: "tribe", label: "TRIBE v2 brain response", match: /tribe|brain|neural|cortex|fmri/i, skipped: !tribeOn },
    { id: "score", label: "Scoring", match: /scor|retention|predict|platform/i },
    { id: "coach", label: "Coaching", match: /claude|coach|writ/i, skipped: !claudeOn },
  ];
  let idx = 0;
  if (job) {
    // Most specific first: "TRIBE … frame 18" must not match the generic video step.
    const order = ["tribe", "coach", "transcribe", "score", "measure", "video"];
    const hit = order.find((id) => steps.find((s) => s.id === id)!.match.test(job.stage));
    const found = hit ? steps.findIndex((s) => s.id === hit) : -1;
    idx = found >= 0 ? found : Math.max(1, maxIdx.current);
    if (job.status === "done") idx = steps.length;
  }
  maxIdx.current = Math.max(maxIdx.current, idx);
  idx = maxIdx.current;

  const error = view.error ?? (job?.status === "error" ? job.error ?? "Analysis failed" : job?.status === "cancelled" ? "Analysis cancelled" : undefined);
  const overall = job ? job.progress : (view.upload ?? 0) * 0.08;
  const stageText = error ? "Analysis failed" : job ? job.stage || "Queued" : view.prep === "render" ? `Rendering sequence… ${Math.round((view.upload ?? 0) * 100)}%` : view.prep === "upload" ? `Uploading… ${Math.round((view.upload ?? 0) * 100)}%` : "Starting…";

  const back = () => {
    void refreshHistory();
    setView({ kind: "start" });
  };

  return (
    <div className="lab-progress">
      <div className="lab-prog-card">
        <div className="lab-eyebrow">Analyzing</div>
        <h1 className="lab-prog-file" title={view.fileName}>{view.fileName}</h1>
        <div className={"lab-prog-stage" + (error ? " bad" : "")}>
          {error ? <AlertTriangle size={14} /> : <Loader2 size={14} className="lab-spin" />}
          <span>{stageText}</span>
          <span className="lab-prog-time">{elapsed}</span>
        </div>
        <Progress value={error ? 0 : overall} />
        <ol className="lab-steps">
          {steps.map((s, i) => {
            const state = s.skipped ? "skipped" : error && i === idx ? "error" : i < idx ? "done" : i === idx ? "active" : "pending";
            return (
              <li key={s.id} className={"lab-step " + state}>
                <span className="lab-step-dot">
                  {state === "done" ? <Check size={11} /> : state === "skipped" ? <MinusCircle size={12} /> : state === "error" ? <AlertTriangle size={11} /> : state === "active" ? <Loader2 size={11} className="lab-spin" /> : null}
                </span>
                <span className="lab-step-label">{s.label}</span>
                <span className="lab-step-note">
                  {state === "skipped" ? (s.id === "tribe" ? "not connected" : "off") : state === "active" && s.id === "prep" && view.upload !== undefined && !job ? `${Math.round(view.upload * 100)}%` : ""}
                </span>
              </li>
            );
          })}
        </ol>
        {error ? <div className="lab-prog-error">{error}</div> : null}
        {tribeOn && !error ? <div className="lab-hint">TRIBE v2 takes roughly 1–2× the video's length on a GPU, longer on CPU.</div> : null}
        <div className="lab-prog-actions">
          <Button onClick={back}>
            <span className="lab-btn-in"><ArrowLeft size={13} /> {error ? "Back" : "Back to Content Lab"}</span>
          </Button>
          {!error && job && (job.status === "queued" || job.status === "running") ? (
            <Button onClick={() => void api.cancelPredict(job.id).catch(() => undefined)}>Cancel analysis</Button>
          ) : null}
          {!error ? <span className="lab-hint">Going back keeps it running; the report will appear under Past reports.</span> : null}
        </div>
      </div>
    </div>
  );
}
