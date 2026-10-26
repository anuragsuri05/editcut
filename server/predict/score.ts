// Content Lab scoring model: per-second features (+ optional TRIBE v2 network
// signals) -> attention curve -> simulated retention per platform -> scores,
// moments and suggestions. Pure functions, no I/O.
//
// This is a transparent heuristic model, not a model trained on platform
// analytics. The constants below encode common short-form/long-form editing
// knowledge (fast hooks, frequent visual change, no dead air, clear audio) and
// are meant to rank and explain, not to promise view counts.

import type {
  Moment, NetworkId, PlatformId, PlatformPrediction, PredictionReport, SecondFeatures, SecondScore, Suggestion, TribeResult,
} from "../../shared/predict";
import { PLATFORMS } from "../../shared/predict";

const clamp = (x: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, x));
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const sd = (xs: number[]) => {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};
export const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

// ---------------------------------------------------------------- attention

/** How much each cortical network contributes to the neural engagement signal. */
const NETWORK_WEIGHTS: Record<NetworkId, number> = {
  attention: 0.24, salience: 0.2, social: 0.14, visual: 0.12, motion: 0.09, faces: 0.08, language: 0.07, auditory: 0.06,
};

/** Feature-based attention for one second (0..100). Returns score and the reasons behind it. */
function featureAttention(f: SecondFeatures[], i: number, hasTranscript: boolean): { score: number; drivers: string[] } {
  const s = f[i];
  const drivers: string[] = [];
  let score = 42;
  // visual change: motion and recent cuts
  score += 22 * Math.min(1, s.motion / 0.35);
  const sinceCut = secondsSinceCut(f, i);
  if (s.cut) {
    score += 12;
    drivers.push("cut");
  } else if (sinceCut <= 1) score += 6;
  if (s.motion > 0.3) drivers.push("lots of movement");
  // sound: audible audio and speech density
  if (!s.silent) score += 10 * clamp((s.loudness + 45) / 25, 0, 1);
  if (hasTranscript) {
    score += 14 * Math.min(1, s.speech / 2.5);
    if (s.speech >= 2) drivers.push("dense speech");
  }
  // penalties: staleness and dead air
  if (sinceCut > 4 && s.motion < 0.12) {
    const p = Math.min(22, (sinceCut - 4) * 3);
    score -= p;
    drivers.push(`no visual change for ${sinceCut}s`);
  }
  if (s.silent && s.motion < 0.15) {
    score -= 18;
    drivers.push("dead air");
  } else if (s.silent) {
    score -= 6;
    drivers.push("silent");
  }
  if (s.brightness < 0.08) {
    score -= 8;
    drivers.push("very dark frame");
  }
  return { score: clamp(score), drivers };
}

function secondsSinceCut(f: SecondFeatures[], i: number): number {
  for (let j = i; j >= 0; j--) if (f[j].cut) return i - j;
  return i + 1;
}

/** Weighted network activity (z-units) for a second. */
function neuralZ(tribe: TribeResult, i: number): number {
  let z = 0;
  for (const [id, w] of Object.entries(NETWORK_WEIGHTS) as [NetworkId, number][]) z += w * (tribe.networks[id]?.[i] ?? 0);
  return z;
}

const NETWORK_LABEL: Record<NetworkId, string> = {
  attention: "focused attention", salience: "surprise/emotion", social: "story & meaning", visual: "visual interest",
  motion: "on-screen motion", faces: "faces & people", language: "speech comprehension", auditory: "sound",
};

export function scoreSeconds(features: SecondFeatures[], tribe?: TribeResult): SecondScore[] {
  const hasTranscript = features.some((s) => s.speech > 0);
  return features.map((_, i) => {
    const fa = featureAttention(features, i, hasTranscript);
    if (!tribe) return { t: i, attention: Math.round(fa.score), features: Math.round(fa.score), drivers: fa.drivers };
    // within-video z-scores: 0 = this video's average response
    const neural = clamp(50 + 18 * neuralZ(tribe, i));
    const drivers = [...fa.drivers];
    const strongest = (Object.keys(NETWORK_WEIGHTS) as NetworkId[])
      .map((id) => [id, tribe.networks[id]?.[i] ?? 0] as const)
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0];
    if (strongest && Math.abs(strongest[1]) > 1) drivers.push(`${strongest[1] > 0 ? "high" : "low"} ${NETWORK_LABEL[strongest[0]]} (brain model)`);
    const attention = clamp(0.55 * neural + 0.45 * fa.score);
    return { t: i, attention: Math.round(attention), neural: Math.round(neural), features: Math.round(fa.score), drivers };
  });
}

// ---------------------------------------------------------------- retention simulation

interface PlatformModel {
  /** Per-second base drop-off probability in the hook window, early window and after. */
  hook: number;
  early: number;
  late: number;
  hookEnd: number;
  earlyEnd: number;
  /** How strongly attention changes drop-off. */
  sensitivity: number;
}

// Calibrated so that average content (attention ≈ 60) lands near commonly reported
// averages: ~60-70% of short-form viewers past 3s and ~30-40% completion on a 30s clip.
const NEUTRAL_ATTENTION = 60;
const MODELS: Record<PlatformId, PlatformModel> = {
  tiktok: { hook: 0.16, early: 0.045, late: 0.03, hookEnd: 3, earlyEnd: 10, sensitivity: 1.1 },
  reels: { hook: 0.15, early: 0.042, late: 0.028, hookEnd: 3, earlyEnd: 10, sensitivity: 1.0 },
  shorts: { hook: 0.15, early: 0.04, late: 0.026, hookEnd: 3, earlyEnd: 10, sensitivity: 1.0 },
  youtube: { hook: 0.02, early: 0.008, late: 0.004, hookEnd: 30, earlyEnd: 120, sensitivity: 0.8 },
  linkedin: { hook: 0.1, early: 0.035, late: 0.022, hookEnd: 3, earlyEnd: 15, sensitivity: 0.9 },
  x: { hook: 0.13, early: 0.042, late: 0.03, hookEnd: 3, earlyEnd: 10, sensitivity: 1.0 },
};

export function simulateRetention(platform: PlatformId, attention: number[], opts: { width?: number; height?: number } = {}): number[] {
  const m = MODELS[platform];
  const meta = PLATFORMS.find((p) => p.id === platform)!;
  const horizontal = (opts.width ?? 16) > (opts.height ?? 9);
  const formatMismatch = meta.vertical && horizontal;
  const out = [100];
  let r = 1;
  for (let t = 0; t < attention.length; t++) {
    let base = t < m.hookEnd ? m.hook : t < m.earlyEnd ? m.early : m.late;
    if (formatMismatch && t < m.hookEnd) base *= 1.25;
    if (t > meta.idealMaxSec) base *= 1.5;
    const h = Math.min(0.6, Math.max(0.0005, base * Math.exp((-m.sensitivity * (attention[t] - NEUTRAL_ATTENTION)) / 20)));
    r *= 1 - h;
    out.push(Math.round(r * 1000) / 10);
  }
  return out;
}

/**
 * "Excellent" reference values per platform for hook hold (at the end of the hook
 * window), average view % and completion %, plus the shortest length that suits it.
 * A platform score of 100 means every metric reaches its excellent value.
 */
const BENCHMARKS: Record<PlatformId, { hook: number; avgView: number; completion: number; minSec: number }> = {
  tiktok: { hook: 80, avgView: 75, completion: 55, minSec: 5 },
  reels: { hook: 80, avgView: 75, completion: 55, minSec: 5 },
  shorts: { hook: 80, avgView: 80, completion: 60, minSec: 5 },
  youtube: { hook: 75, avgView: 55, completion: 35, minSec: 60 },
  linkedin: { hook: 70, avgView: 60, completion: 40, minSec: 10 },
  x: { hook: 70, avgView: 65, completion: 45, minSec: 5 },
};

function platformPrediction(platform: PlatformId, attention: number[], dims: { width?: number; height?: number }): PlatformPrediction {
  const retention = simulateRetention(platform, attention, dims);
  const duration = attention.length;
  const bench = BENCHMARKS[platform];
  // area under the curve = expected seconds watched
  const avgViewSec = Math.round((retention.slice(1).reduce((a, b) => a + b, 0) / 100) * 10) / 10;
  const avgViewPct = duration ? Math.round((avgViewSec / duration) * 1000) / 10 : 0;
  const completionPct = retention[retention.length - 1];
  const hookIdx = Math.min(MODELS[platform].hookEnd, retention.length - 1);
  const hookHoldPct = retention[Math.min(3, retention.length - 1)];
  const ratio = (v: number, ref: number) => Math.min(1, v / ref);
  let score = 100 * (0.4 * ratio(retention[hookIdx], bench.hook) + 0.35 * ratio(avgViewPct, bench.avgView) + 0.25 * ratio(completionPct, bench.completion));
  const tooShort = duration < bench.minSec;
  if (tooShort) score *= 0.7;
  score = Math.round(clamp(score, 0, 98));
  const verdict = tooShort
    ? `Short for ${PLATFORMS.find((p) => p.id === platform)?.name} (under ${bench.minSec}s) — ${platform === "youtube" ? "post it as a Short instead" : "add more substance"}`
    : score >= 80 ? "Strong fit — likely to hold viewers well"
    : score >= 60 ? "Solid — a tighter hook or pacing would lift it"
    : score >= 40 ? "Mixed — expect many viewers to drop early"
    : "Weak fit — rework the opening and pacing for this platform";
  return { platform, retention, avgViewSec, avgViewPct, completionPct, hookHoldPct, score, verdict };
}

// ---------------------------------------------------------------- moments & suggestions

function smooth(xs: number[], radius = 1): number[] {
  return xs.map((_, i) => mean(xs.slice(Math.max(0, i - radius), i + radius + 1)));
}

export function findMoments(seconds: SecondScore[]): Moment[] {
  const a = smooth(seconds.map((s) => s.attention));
  const m = mean(a);
  const d = sd(a) || 1;
  const moments: Moment[] = [];
  const pick = (kind: "peak" | "dip") => {
    const order = a.map((v, i) => ({ v, i })).sort((x, y) => (kind === "peak" ? y.v - x.v : x.v - y.v));
    const taken: number[] = [];
    for (const { v, i } of order) {
      if (taken.length >= 3) break;
      if (kind === "peak" ? v < m + 0.4 * d : v > m - 0.4 * d) break;
      if (taken.some((j) => Math.abs(j - i) < 4)) continue;
      taken.push(i);
      // explain peaks with what's working and dips with what's missing
      const negative = (d: string) => /^(no |low |dead|silent|very dark)/.test(d);
      const reasons = seconds[i].drivers.filter((d) => (kind === "peak" ? !negative(d) : negative(d)));
      const drivers = (reasons.length ? reasons : kind === "dip" ? ["below this video's average"] : []).slice(0, 2).join(", ");
      moments.push({
        start: Math.max(0, i - 1), end: Math.min(seconds.length, i + 2), kind, attention: Math.round(v),
        label: kind === "peak" ? `Strong moment${drivers ? ` — ${drivers}` : ""}` : `Attention dip${drivers ? ` — ${drivers}` : ""}`,
      });
    }
  };
  pick("peak");
  pick("dip");
  return moments.sort((x, y) => x.start - y.start);
}

const FILLERS = new Set(["um", "uh", "uhm", "erm", "er", "ah", "hmm"]);

let sugSeq = 0;
const sug = (s: Omit<Suggestion, "id">): Suggestion => ({ id: `s${++sugSeq}`, ...s });

/** Change in average view % on the first short-form platform if attention in [start,end) were raised to `to`. */
function impactOf(platform: PlatformId, attention: number[], start: number, end: number, to: number, dims: { width?: number; height?: number }): number {
  const base = platformPrediction(platform, attention, dims).avgViewPct;
  const better = attention.map((a, i) => (i >= start && i < end ? Math.max(a, to) : a));
  return Math.round((platformPrediction(platform, better, dims).avgViewPct - base) * 10) / 10;
}

export function buildSuggestions(features: SecondFeatures[], seconds: SecondScore[], platforms: PlatformId[], dims: { width?: number; height?: number }, tribe?: TribeResult): Suggestion[] {
  sugSeq = 0;
  const out: Suggestion[] = [];
  const att = seconds.map((s) => s.attention);
  const n = features.length;
  const ref: PlatformId = platforms.find((p) => p !== "youtube") ?? platforms[0] ?? "tiktok";
  const shortForm = platforms.some((p) => PLATFORMS.find((x) => x.id === p)?.vertical);
  const hasSpeech = features.some((f) => f.speech > 0);

  // hook
  const hook = mean(att.slice(0, 3));
  if (hook < 62) {
    const firstWord = features.findIndex((f) => f.speech > 0);
    const firstCut = features.findIndex((f, i) => i > 0 && f.cut);
    const tips: string[] = [];
    if (hasSpeech && firstWord > 1) tips.push(`the first word lands at ${firstWord}s — start talking immediately`);
    if (firstCut === -1 || firstCut > 3) tips.push("nothing changes on screen in the first 3s — open on motion, a bold visual or a quick cut");
    if (features.slice(0, 3).every((f) => f.motion < 0.12)) tips.push("the opening frames are static");
    tips.push("put the payoff or a question on screen as text in the first second");
    out.push(sug({
      kind: "hook", severity: hook < 45 ? "high" : "medium", title: "Strengthen the first 3 seconds",
      detail: `Hook strength is ${Math.round(hook)}/100. ${tips.join("; ")}.`, start: 0, end: Math.min(3, n),
      impact: `≈ +${impactOf(ref, att, 0, 3, 80, dims)}% avg. view on ${PLATFORMS.find((p) => p.id === ref)?.name}`,
    }));
  }

  // dead air runs
  for (let i = 0; i < n; ) {
    if (features[i].silent) {
      let j = i;
      while (j < n && features[j].silent) j++;
      if (j - i >= 2 && i > 0) {
        out.push(sug({
          kind: "dead-air", severity: j - i >= 3 ? "high" : "medium", title: `Remove ${j - i}s of silence`, start: i, end: j,
          detail: `No audio from ${mmss(i)} to ${mmss(j)}. Cut it (EditCut: AI › Remove Silences) or add music/voice-over.`,
          impact: `≈ +${impactOf(ref, att, i, j, 70, dims)}% avg. view`,
        }));
      }
      i = j;
    } else i++;
  }

  // stale stretches (no cut, little motion)
  for (let i = 0; i < n; ) {
    if (!features[i].cut && features[i].motion < 0.12) {
      let j = i;
      while (j < n && !features[j].cut && features[j].motion < 0.12) j++;
      const limit = shortForm ? 5 : 9;
      if (j - i >= limit) {
        out.push(sug({
          kind: "pacing", severity: j - i >= limit * 2 ? "high" : "medium", title: `Add visual change at ${mmss(i)}–${mmss(j)}`, start: i, end: j,
          detail: `${j - i}s without a cut or noticeable movement. Add a cut, punch-in zoom, B-roll or on-screen text every ${shortForm ? "2–4" : "5–8"}s.`,
          impact: `≈ +${impactOf(ref, att, i, j, 68, dims)}% avg. view`,
        }));
      }
      i = j;
    } else i++;
  }

  // biggest dips not already covered
  const moments = findMoments(seconds).filter((m) => m.kind === "dip");
  for (const m of moments) {
    if (out.some((s) => s.start !== undefined && s.end !== undefined && m.start < s.end && m.end > s.start)) continue;
    out.push(sug({
      kind: "visual", severity: "medium", title: `Attention dips around ${mmss(m.start)}`, start: m.start, end: m.end,
      detail: `${m.label}. Tighten this part, cut to the next point sooner, or add a pattern interrupt (zoom, sound effect, graphic).`,
      impact: `≈ +${impactOf(ref, att, m.start, m.end, mean(att) + 10, dims)}% avg. view`,
    }));
  }

  // audio level
  const audible = features.filter((f) => !f.silent).map((f) => f.loudness);
  if (audible.length) {
    const lvl = mean(audible);
    if (lvl < -30) out.push(sug({ kind: "audio", severity: "medium", title: "Audio is quiet", detail: `Average level ${lvl.toFixed(0)} dBFS. Normalize to about -14 LUFS (Export › Effects › Loudness Normalization) so it isn't skipped on phones.` }));
    if (Math.max(...audible) > -2) out.push(sug({ kind: "audio", severity: "low", title: "Audio peaks near clipping", detail: "Some seconds peak close to 0 dBFS. Add a limiter (Effects › Hard Limiter at -1 dB)." }));
  }

  // filler words (from the transcript)
  const fillers = features.flatMap((f) => (f.text ?? "").split(/\s+/).map((w) => ({ t: f.t, w: w.toLowerCase().replace(/[^a-z']/g, "") }))).filter((x) => FILLERS.has(x.w));
  if (fillers.length) {
    out.push(sug({
      kind: "pacing", severity: fillers.length >= 3 ? "medium" : "low", title: `Cut ${fillers.length} filler word${fillers.length > 1 ? "s" : ""}`,
      start: fillers[0].t, end: fillers[0].t + 1,
      detail: `"${[...new Set(fillers.map((f) => f.w))].join('", "')}" at ${fillers.map((f) => mmss(f.t)).join(", ")}. EditCut can remove them automatically (AI › Remove Filler Words).`,
    }));
  }

  // captions
  if (hasSpeech) out.push(sug({ kind: "captions", severity: shortForm ? "high" : "low", title: "Burn in captions", detail: "Most social video starts muted. Add captions (Text panel › Create captions, Social style) so the message lands without sound." }));

  // length & format per platform
  for (const p of platforms) {
    const meta = PLATFORMS.find((x) => x.id === p)!;
    if (n > meta.idealMaxSec) out.push(sug({ kind: "length", severity: "medium", title: `Too long for ${meta.name}`, detail: `${n}s vs. ~${meta.idealMaxSec}s that works best. Cut a shorter version focused on the strongest moments.` }));
  }
  const horizontal = (dims.width ?? 16) > (dims.height ?? 9);
  const verticalTargets = platforms.filter((p) => PLATFORMS.find((x) => x.id === p)?.vertical);
  if (horizontal && verticalTargets.length) {
    out.push(sug({ kind: "format", severity: "high", title: "Reframe to vertical 9:16", detail: `This video is horizontal, but ${verticalTargets.map((p) => PLATFORMS.find((x) => x.id === p)?.name).join(", ")} ${verticalTargets.length > 1 ? "are" : "is"} vertical-first. Use Sequence › Auto Reframe (or ask Claude: "make it vertical for TikTok").` }));
  }

  // brain-model specific
  if (tribe) {
    const vis = mean(tribe.networks.visual ?? []);
    const lang = tribe.networks.language ?? [];
    const visual = tribe.networks.visual ?? [];
    const talkyLowVisual = lang.filter((z, i) => z > 0.8 && (visual[i] ?? 0) < -0.5).length;
    if (talkyLowVisual >= Math.max(3, n * 0.15)) out.push(sug({ kind: "visual", severity: "medium", title: "Support the talking with visuals", detail: `For ${talkyLowVisual}s the brain model predicts strong speech processing but weak visual response. Add B-roll, examples or text overlays during explanations.` }));
    const sal = tribe.networks.salience ?? [];
    const lowSal = sal.length ? sal.filter((z) => z < -0.3).length / sal.length : 0;
    if (lowSal > 0.5) out.push(sug({ kind: "story", severity: "low", title: "Add moments of surprise", detail: "Predicted salience-network response is below this video's average for most of its length. A reveal, contrast or unexpected beat creates attention peaks." }));
    void vis;
  }

  const rank = { high: 0, medium: 1, low: 2 } as const;
  return out.sort((a, b) => rank[a.severity] - rank[b.severity] || (a.start ?? 0) - (b.start ?? 0));
}

// ---------------------------------------------------------------- overall

export function scoreReport(features: SecondFeatures[], platformsWanted: PlatformId[], dims: { width?: number; height?: number }, tribe?: TribeResult): Pick<PredictionReport, "seconds" | "overall" | "platforms" | "bestPlatform" | "moments" | "suggestions"> {
  const seconds = scoreSeconds(features, tribe);
  const att = seconds.map((s) => s.attention);
  const n = features.length || 1;
  const platformIds = platformsWanted.length ? platformsWanted : (PLATFORMS.map((p) => p.id) as PlatformId[]);
  const platforms = platformIds.map((p) => platformPrediction(p, att, dims));
  const bestPlatform = [...platforms].sort((a, b) => b.score - a.score)[0]?.platform ?? "tiktok";

  const hook = clamp(mean(att.slice(0, 3)));
  const cuts = features.filter((f) => f.cut).length;
  const shotLen = n / Math.max(1, cuts + 1);
  const deadAir = features.filter((f) => f.silent && f.motion < 0.15).length / n;
  const pacing = clamp(100 - Math.max(0, shotLen - 3) * 6 - deadAir * 120 + Math.min(15, mean(features.map((f) => f.motion)) * 40));
  const audible = features.filter((f) => !f.silent);
  const lvl = audible.length ? mean(audible.map((f) => f.loudness)) : -70;
  const clarity = clamp((audible.length / n) * 60 + (lvl > -30 && lvl < -6 ? 40 : lvl > -40 ? 20 : 0));
  const neural = tribe ? clamp(mean(seconds.map((s) => s.neural ?? 50)) + 25 * (mean(seconds.slice(0, 3).map((s) => (s.neural ?? 50) - 50)) / 50)) : undefined;
  const score = Math.round(0.3 * hook + 0.3 * mean(att) + 0.2 * pacing + 0.2 * clarity);

  return {
    seconds,
    overall: { score, hook: Math.round(hook), pacing: Math.round(pacing), clarity: Math.round(clarity), neural: neural === undefined ? undefined : Math.round(neural) },
    platforms,
    bestPlatform,
    moments: findMoments(seconds),
    suggestions: buildSuggestions(features, seconds, platformIds, dims, tribe),
  };
}
