// Content Lab: predicted audience response for a video, second by second.
// Shared by the server pipeline (server/predict), the TRIBE v2 worker client and the UI.
//
// What the numbers mean:
// - Brain-network signals come from Meta's TRIBE v2, which predicts the fMRI
//   response of an average viewer's cortex to the video (1 value per second per
//   vertex, ~20k vertices), grouped here into functional networks.
// - "Attention", retention curves and scores are EditCut's own model built on top
//   of those signals plus measurable video features (cuts, motion, loudness,
//   speech). They are estimates, not data from any social platform.

export type PlatformId = "tiktok" | "reels" | "shorts" | "youtube" | "linkedin" | "x";

export const PLATFORMS: { id: PlatformId; name: string; vertical: boolean; idealMaxSec: number }[] = [
  { id: "tiktok", name: "TikTok", vertical: true, idealMaxSec: 60 },
  { id: "reels", name: "Instagram Reels", vertical: true, idealMaxSec: 90 },
  { id: "shorts", name: "YouTube Shorts", vertical: true, idealMaxSec: 60 },
  { id: "youtube", name: "YouTube", vertical: false, idealMaxSec: 900 },
  { id: "linkedin", name: "LinkedIn", vertical: false, idealMaxSec: 120 },
  { id: "x", name: "X / Twitter", vertical: false, idealMaxSec: 140 },
];

/** Cortical networks we summarize TRIBE v2 vertex predictions into. */
export type NetworkId = "visual" | "motion" | "faces" | "auditory" | "language" | "attention" | "salience" | "social";

export const NETWORKS: { id: NetworkId; name: string; meaning: string }[] = [
  { id: "visual", name: "Visual", meaning: "Early visual cortex: how much there is to look at" },
  { id: "motion", name: "Motion", meaning: "MT+/lateral occipital: movement and dynamics on screen" },
  { id: "faces", name: "Faces & bodies", meaning: "Fusiform / occipito-temporal: people, faces, bodies" },
  { id: "auditory", name: "Auditory", meaning: "Auditory cortex: sound, music, voice" },
  { id: "language", name: "Language", meaning: "Temporal & inferior frontal language areas: speech comprehension" },
  { id: "attention", name: "Attention", meaning: "Dorsal attention (intraparietal, frontal eye fields): focused attention" },
  { id: "salience", name: "Salience", meaning: "Insula & anterior cingulate: surprise, emotional salience" },
  { id: "social", name: "Social / meaning", meaning: "Medial prefrontal, precuneus, TPJ: self-relevance, story, social reasoning" },
];

/** Per-second measurable video features (always computed locally with ffmpeg/whisper). */
export interface SecondFeatures {
  t: number; // second index
  cut: boolean; // a scene cut happens in this second
  motion: number; // 0..1 mean frame-to-frame change
  brightness: number; // 0..1 mean luma
  loudness: number; // RMS level in dBFS for this second, -70 when silent
  speech: number; // words spoken in this second (from transcript), 0 if unknown
  silent: boolean;
  text?: string; // words spoken in this second
}

export interface TribeResult {
  /** Seconds per prediction (TRIBE v2: 1.0). */
  tr: number;
  /** networks[id][second] = mean predicted activation (z-scored within the video). */
  networks: Record<NetworkId, number[]>;
  /** Whole-cortex mean absolute activation per second (z-scored). */
  global: number[];
  /** Modalities the model actually used. */
  modalities: ("video" | "audio" | "text")[];
  model: string; // e.g. "facebook/tribev2"
  device: string;
  /** True when produced by the worker's synthetic --mock mode (development only). */
  mock?: boolean;
  elapsedSec: number;
}

export interface SecondScore {
  t: number;
  attention: number; // 0..100 predicted attention / engagement at this second
  neural?: number; // 0..100 TRIBE-based component (when available)
  features: number; // 0..100 feature-based component
  /** Main reasons this second scores high/low. */
  drivers: string[];
}

export interface PlatformPrediction {
  platform: PlatformId;
  /** retention[i] = predicted % of viewers still watching at second i (100 at 0). */
  retention: number[];
  avgViewSec: number;
  avgViewPct: number;
  completionPct: number;
  /** Viewers still there after the first 3 seconds (the hook). */
  hookHoldPct: number;
  score: number; // 0..100
  verdict: string;
}

export type SuggestionKind = "hook" | "pacing" | "dead-air" | "audio" | "captions" | "length" | "visual" | "story" | "format";

export interface Suggestion {
  id: string;
  kind: SuggestionKind;
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
  /** Time range the suggestion applies to (seconds), if any. */
  start?: number;
  end?: number;
  /** Rough expected effect, e.g. "+6% hook hold". */
  impact?: string;
}

export interface Moment {
  start: number;
  end: number;
  kind: "peak" | "dip";
  attention: number;
  label: string;
}

export interface PredictionReport {
  id: string;
  createdAt: number;
  fileName: string;
  durationSec: number;
  width?: number;
  height?: number;
  /** Thumbnail sprite: `count` frames horizontally tiled, one every `interval` seconds (≈1). */
  thumbs?: { url: string; count: number; width: number; height: number; interval?: number };
  /** Playable URL of the analyzed video. */
  videoUrl: string;
  /** Which engines produced this report. */
  engine: { tribe: "used" | "unavailable" | "failed" | "disabled"; tribeError?: string; mock?: boolean; claude: "used" | "unavailable" | "failed" | "skipped" };
  features: SecondFeatures[];
  tribe?: TribeResult;
  seconds: SecondScore[];
  overall: {
    score: number; // 0..100 headline content score
    hook: number; // 0..100 first-3-seconds strength
    pacing: number; // 0..100
    clarity: number; // 0..100 audio/speech clarity
    neural?: number; // 0..100 mean neural engagement
  };
  platforms: PlatformPrediction[];
  bestPlatform: PlatformId;
  moments: Moment[];
  suggestions: Suggestion[];
  /** Claude's written coaching (markdown), when a Claude connection is available. */
  coaching?: string;
  transcript?: string;
  /** What was analyzed, for "Open in editor": a sequence id, or "asset:<mediaId>". */
  source?: string;
}

export interface PredictJob {
  id: string;
  fileName: string;
  status: "queued" | "running" | "done" | "error" | "cancelled";
  stage: string; // human readable current step
  progress: number; // 0..1
  error?: string;
  reportId?: string;
  createdAt: number;
  /** The options this job runs with. */
  options?: PredictOptions;
}

export interface PredictOptions {
  platforms?: PlatformId[];
  /** Use TRIBE v2 when a worker is configured (default true). */
  useTribe?: boolean;
  /** Ask Claude for a written coaching report (default true). */
  useClaude?: boolean;
  /** Also feed TRIBE the transcript (needs gated LLaMA 3.2 on the worker). */
  tribeText?: boolean;
  /** Creator's goal/context for Claude, e.g. "fitness tips for beginners". */
  goal?: string;
}
