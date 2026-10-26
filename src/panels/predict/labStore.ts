/// <reference types="vite/client" />
// Content Lab client state: current screen, server status, report history,
// running jobs (fed by {type:"predict"} server events) and the shared player clock.
import { create } from "zustand";
import type { PlatformId, PredictJob, PredictOptions, PredictionReport } from "@shared/predict";
import { PLATFORMS } from "@shared/predict";
import { api, subscribeEvents, type PredictReportSummary, type PredictStatus } from "../../api";
import { FIXTURE_STATUS, fixtureHistory, fixtureJob, makeFixtureReport } from "./fixture";

export type LabView =
  | { kind: "start" }
  | { kind: "progress"; jobId: string | null; fileName: string; prep?: "upload" | "render" | "asset"; upload?: number; error?: string }
  | { kind: "report"; id: string };

export interface LabOptions {
  platforms: PlatformId[];
  goal: string;
  useTribe: boolean;
  useClaude: boolean;
  tribeText: boolean;
}

const OPTS_KEY = "editcut.lab.options";
const SRC_KEY = "editcut.lab.sources";

function loadOptions(): LabOptions {
  const def: LabOptions = { platforms: ["tiktok", "reels", "shorts", "youtube"], goal: "", useTribe: true, useClaude: true, tribeText: false };
  try {
    const raw = localStorage.getItem(OPTS_KEY);
    if (raw) return { ...def, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return def;
}

function loadSources(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(SRC_KEY) ?? "{}");
  } catch {
    return {};
  }
}

const params = typeof location !== "undefined" ? new URLSearchParams(location.search) : new URLSearchParams();
/** Dev fixture mode: ?fixture=1 (only honored in dev builds). */
export const FIXTURE = import.meta.env.DEV && params.get("fixture") === "1";

interface LabState {
  view: LabView;
  status: PredictStatus | null;
  statusError: string | null;
  history: PredictReportSummary[] | null;
  jobs: Record<string, PredictJob>;
  reports: Record<string, PredictionReport>;
  reportError: Record<string, string>;
  options: LabOptions;
  /** report id / job id -> sequence id it was rendered from ("Open in editor"). */
  sources: Record<string, string>;

  setView: (v: LabView) => void;
  setOptions: (p: Partial<LabOptions>) => void;
  refreshStatus: () => Promise<void>;
  refreshHistory: () => Promise<void>;
  openReport: (id: string) => Promise<void>;
  deleteReport: (id: string) => Promise<void>;
  /** Show a job's progress (job already created on the server). */
  trackJob: (job: PredictJob, sourceSequenceId?: string) => void;
  upsertJob: (job: PredictJob) => void;
  rememberSource: (key: string, seqId: string) => void;
}

export function toPredictOptions(o: LabOptions, status: PredictStatus | null): PredictOptions {
  const tribeOk = !!status?.tribe.reachable;
  return {
    platforms: o.platforms.length ? o.platforms : PLATFORMS.map((p) => p.id),
    useTribe: o.useTribe && tribeOk,
    useClaude: o.useClaude && !!status?.claude,
    tribeText: o.useTribe && tribeOk && o.tribeText,
    goal: o.goal.trim() || undefined,
  };
}

export const useLab = create<LabState>()((set, get) => ({
  view: { kind: "start" },
  status: null,
  statusError: null,
  history: null,
  jobs: {},
  reports: {},
  reportError: {},
  options: loadOptions(),
  sources: loadSources(),

  setView: (view) => set({ view }),
  setOptions: (p) => {
    const options = { ...get().options, ...p };
    set({ options });
    try {
      localStorage.setItem(OPTS_KEY, JSON.stringify(options));
    } catch {
      /* ignore */
    }
  },
  refreshStatus: async () => {
    if (FIXTURE) return set({ status: FIXTURE_STATUS, statusError: null });
    try {
      set({ status: await api.predictStatus(), statusError: null });
    } catch (e) {
      set({ statusError: (e as Error).message || "Server unreachable" });
    }
  },
  refreshHistory: async () => {
    if (FIXTURE) return set({ history: fixtureHistory() });
    try {
      const h = await api.predictReports();
      set({ history: [...h].sort((a, b) => b.createdAt - a.createdAt) });
    } catch {
      set((s) => ({ history: s.history ?? [] }));
    }
  },
  openReport: async (id) => {
    set({ view: { kind: "report", id } });
    if (get().reports[id]) return;
    if (FIXTURE) {
      set((s) => ({ reports: { ...s.reports, [id]: makeFixtureReport(id) } }));
      return;
    }
    try {
      const rep = await api.predictReport(id);
      set((s) => ({ reports: { ...s.reports, [id]: rep } }));
    } catch (e) {
      set((s) => ({ reportError: { ...s.reportError, [id]: (e as Error).message } }));
    }
  },
  deleteReport: async (id) => {
    set((s) => ({ history: (s.history ?? []).filter((h) => h.id !== id) }));
    if (FIXTURE) return;
    try {
      await api.deletePredictReport(id);
    } catch {
      void get().refreshHistory();
    }
  },
  trackJob: (job, sourceSequenceId) => {
    if (sourceSequenceId) get().rememberSource(job.id, sourceSequenceId);
    get().upsertJob(job);
    const v = get().view;
    set({ view: { kind: "progress", jobId: job.id, fileName: job.fileName, prep: v.kind === "progress" ? v.prep : undefined, upload: 1 } });
  },
  upsertJob: (job) => {
    const prev = get().jobs[job.id];
    set((s) => ({ jobs: { ...s.jobs, [job.id]: job } }));
    // carry "from sequence" over from job id to report id
    if (job.reportId && get().sources[job.id] && !get().sources[job.reportId]) get().rememberSource(job.reportId, get().sources[job.id]);
    const v = get().view;
    if (job.status === "done" && job.reportId && (!prev || prev.status !== "done")) {
      void get().refreshHistory();
      if (v.kind === "progress" && v.jobId === job.id) void get().openReport(job.reportId);
    }
  },
  rememberSource: (key, seqId) => {
    const sources = { ...get().sources, [key]: seqId };
    set({ sources });
    try {
      localStorage.setItem(SRC_KEY, JSON.stringify(sources));
    } catch {
      /* ignore */
    }
  },
}));

let synced = false;
/** Subscribe to predict job events (idempotent). Also polls jobs as a fallback. */
export function startLabSync(): void {
  if (synced || typeof window === "undefined") return;
  synced = true;
  if (FIXTURE) {
    const v = params.get("view");
    if (v === "start") useLab.setState({ view: { kind: "start" } });
    else if (v === "progress") {
      const j = fixtureJob();
      useLab.setState({ jobs: { [j.id]: j }, view: { kind: "progress", jobId: j.id, fileName: j.fileName } });
    } else void useLab.getState().openReport("fixture-1");
    return;
  }
  subscribeEvents((e) => {
    if (e.type === "predict") useLab.getState().upsertJob(e.job);
  });
  // Deep link: ?app=lab&report=<id>
  const rid = params.get("report");
  if (rid) void useLab.getState().openReport(rid);
  // Fallback poll while a job is on screen (SSE can drop during long TRIBE runs).
  setInterval(() => {
    const v = useLab.getState().view;
    if (v.kind !== "progress" || !v.jobId) return;
    const j = useLab.getState().jobs[v.jobId];
    if (j && (j.status === "done" || j.status === "error")) return;
    api
      .predictJobs()
      .then((jobs) => jobs.forEach((x) => x.id === v.jobId && useLab.getState().upsertJob(x)))
      .catch(() => {});
  }, 3000);
}

// ---------------------------------------------------------------- player clock

interface PlayerState {
  time: number;
  playing: boolean;
  duration: number;
  /** Video element when one is mounted and playable; otherwise a simulated clock runs. */
  video: HTMLVideoElement | null;
  hasVideo: boolean;
  setVideo: (v: HTMLVideoElement | null, playable: boolean) => void;
  seek: (t: number) => void;
  toggle: () => void;
  pause: () => void;
  reset: (duration: number) => void;
}

let raf = 0;
let simStart = 0;
let simFrom = 0;

export const usePlayer = create<PlayerState>()((set, get) => {
  const tick = () => {
    const s = get();
    if (!s.playing) return;
    if (s.hasVideo && s.video) {
      set({ time: s.video.currentTime });
      if (s.video.ended) set({ playing: false });
    } else {
      const t = simFrom + (performance.now() - simStart) / 1000;
      if (t >= s.duration) {
        set({ time: s.duration, playing: false });
        return;
      }
      set({ time: t });
    }
    raf = requestAnimationFrame(tick);
  };
  return {
    time: 0,
    playing: false,
    duration: 0,
    video: null,
    hasVideo: false,
    setVideo: (video, playable) => set({ video, hasVideo: playable && !!video }),
    seek: (t) => {
      const s = get();
      const time = Math.max(0, Math.min(s.duration || t, t));
      if (s.hasVideo && s.video) s.video.currentTime = time;
      simFrom = time;
      simStart = performance.now();
      set({ time });
    },
    toggle: () => {
      const s = get();
      if (s.playing) return get().pause();
      let from = s.time;
      if (from >= s.duration - 0.05) from = 0;
      if (s.hasVideo && s.video) {
        s.video.currentTime = from;
        void s.video.play().catch(() => set({ playing: false }));
      }
      simFrom = from;
      simStart = performance.now();
      set({ playing: true, time: from });
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(tick);
    },
    pause: () => {
      const s = get();
      s.video?.pause();
      cancelAnimationFrame(raf);
      set({ playing: false, time: s.hasVideo && s.video ? s.video.currentTime : s.time });
    },
    reset: (duration) => {
      cancelAnimationFrame(raf);
      get().video?.pause();
      set({ time: 0, playing: false, duration });
    },
  };
});
