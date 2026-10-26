// Dev-only fixture: a realistic PredictionReport for a ~42s vertical talking-head
// video, so the Content Lab UI can be built and screenshotted without the server.
// Enabled with ?app=lab&fixture=1 (optionally &view=start|progress|report).
import type { NetworkId, PlatformId, PredictionReport, PredictJob, SecondFeatures, SecondScore, Suggestion, Moment, PlatformPrediction } from "@shared/predict";
import { NETWORKS, PLATFORMS } from "@shared/predict";
import type { PredictReportSummary, PredictStatus } from "../../api";

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const smooth = (a: number[], k = 1) => a.map((_, i) => {
  let s = 0, n = 0;
  for (let j = i - k; j <= i + k; j++) if (j >= 0 && j < a.length) { s += a[j]; n++; }
  return s / n;
});
const zscore = (a: number[]) => {
  const m = a.reduce((x, y) => x + y, 0) / a.length;
  const sd = Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length) || 1;
  return a.map((v) => +((v - m) / sd).toFixed(3));
};

const SCRIPT: string[] = [
  "Stop scrolling —", "this one habit", "doubled my", "focus in", "two weeks.", "", "So here's", "what happened.", "I used to", "check my phone",
  "like ninety times", "a day.", "", "", "Then I tried", "something", "kind of weird.", "I put my phone", "in a different", "room. That's it.",
  "", "", "Day one was", "awful, honestly.", "", "But by day four", "I finished", "a whole book.", "", "The trick is",
  "making the", "default harder,", "not relying", "on willpower.", "", "Try it", "for one week", "and tell me", "what changes.", "Follow for", "part two.", "",
];

/** Paint a believable thumbnail sprite (one 9:16 frame per second) to a data URL. */
function makeSprite(count: number, w: number, h: number): string {
  if (typeof document === "undefined") return "";
  const c = document.createElement("canvas");
  c.width = w * count;
  c.height = h;
  const ctx = c.getContext("2d")!;
  const scenes = [
    { from: 0, bg: ["#3b2f4a", "#1b1726"], skin: "#d9a07c", shirt: "#e2574c" },
    { from: 6, bg: ["#2f3e4a", "#151d24"], skin: "#d9a07c", shirt: "#e2574c" },
    { from: 14, bg: ["#5a4a30", "#2a2012"], skin: "#c98e6a", shirt: "#3d7bd9" },
    { from: 22, bg: ["#28332a", "#121812"], skin: "#d9a07c", shirt: "#e2574c" },
    { from: 29, bg: ["#3d3550", "#1a1626"], skin: "#d9a07c", shirt: "#f0c040" },
    { from: 35, bg: ["#4a2f35", "#24161a"], skin: "#d9a07c", shirt: "#e2574c" },
  ];
  for (let i = 0; i < count; i++) {
    const sc = [...scenes].reverse().find((s) => i >= s.from)!;
    const x = i * w;
    const g = ctx.createLinearGradient(x, 0, x, h);
    g.addColorStop(0, sc.bg[0]);
    g.addColorStop(1, sc.bg[1]);
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, w, h);
    // window light
    ctx.fillStyle = "rgba(255,240,200,0.08)";
    ctx.fillRect(x + w * 0.62, h * 0.08, w * 0.3, h * 0.36);
    const sway = Math.sin(i * 0.9) * w * 0.04;
    const zoom = sc.from === 14 || sc.from === 29 ? 1.25 : 1;
    // body
    ctx.fillStyle = sc.shirt;
    ctx.beginPath();
    ctx.ellipse(x + w / 2 + sway, h * (0.98 - 0.02 * zoom), w * 0.42 * zoom, h * 0.26 * zoom, 0, Math.PI, 0);
    ctx.fill();
    // head
    ctx.fillStyle = sc.skin;
    ctx.beginPath();
    ctx.ellipse(x + w / 2 + sway, h * (0.5 - 0.04 * (zoom - 1)), w * 0.17 * zoom, h * 0.115 * zoom, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2a1c14";
    ctx.beginPath();
    ctx.ellipse(x + w / 2 + sway, h * (0.43 - 0.04 * (zoom - 1)), w * 0.18 * zoom, h * 0.06 * zoom, 0, Math.PI, 0);
    ctx.fill();
    // caption bar on speaking seconds
    if (SCRIPT[i]) {
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(x + w * 0.1, h * 0.7, w * 0.8, h * 0.07);
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${Math.round(h * 0.04)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(SCRIPT[i].toUpperCase().slice(0, 14), x + w / 2, h * 0.75, w * 0.76);
    }
  }
  return c.toDataURL("image/jpeg", 0.8);
}

export function makeFixtureReport(id = "fixture-1"): PredictionReport {
  const r = rng(42);
  const N = 42;
  const cuts = new Set([6, 14, 22, 29, 35]);
  const features: SecondFeatures[] = SCRIPT.slice(0, N).map((text, t) => {
    const words = text ? text.split(/\s+/).length : 0;
    const silent = !text && t !== 12 && t !== 21;
    return {
      t,
      cut: cuts.has(t),
      motion: +clamp((cuts.has(t) ? 0.55 : 0.12) + r() * 0.18 + (t < 3 ? 0.2 : 0), 0, 1).toFixed(3),
      brightness: +(0.35 + r() * 0.15).toFixed(3),
      loudness: silent ? -58 - r() * 8 : +(-20 - r() * 6).toFixed(1),
      speech: words,
      silent,
      text: text || undefined,
    };
  });

  // TRIBE-like network signals: smooth, correlated with content events.
  const base = (fn: (t: number) => number, noise = 0.35) => zscore(smooth(features.map((f) => fn(f.t) + (r() - 0.5) * noise), 1));
  const lang = (t: number) => features[t].speech * 0.6;
  const networks = {
    visual: base((t) => 1 + features[t].motion * 2 + (cuts.has(t) ? 1 : 0)),
    motion: base((t) => features[t].motion * 3),
    faces: base((t) => (t >= 14 && t < 22 ? 0.4 : 1.4) + (t >= 29 && t < 35 ? 0.5 : 0)),
    auditory: base((t) => (features[t].silent ? 0 : 1.2) + features[t].speech * 0.2),
    language: base(lang),
    attention: base((t) => (t < 4 ? 2.2 : 0) + (t >= 25 && t < 28 ? 1.6 : 0) + (t >= 29 && t < 34 ? 1.2 : 0) + lang(t) * 0.5 - (t >= 11 && t < 14 ? 1.2 : 0) - (t >= 19 && t < 22 ? 1.4 : 0)),
    salience: base((t) => (t < 3 ? 2.4 : 0) + (cuts.has(t) ? 1.2 : 0) + (t >= 25 && t < 28 ? 1.4 : 0) - (features[t].silent ? 0.8 : 0)),
    social: base((t) => (t >= 7 && t < 11 ? 1.5 : 0) + (t >= 29 && t < 35 ? 1.8 : 0) + (t >= 35 ? 1 : 0)),
  } as Record<NetworkId, number[]>;
  const global = zscore(features.map((_, t) => NETWORKS.reduce((s, n) => s + Math.abs(networks[n.id][t]), 0) / NETWORKS.length));

  const seconds: SecondScore[] = features.map((f, t) => {
    const neuralRaw = 0.35 * networks.attention[t] + 0.3 * networks.salience[t] + 0.2 * networks.social[t] + 0.15 * networks.language[t];
    const neural = Math.round(clamp(58 + neuralRaw * 18, 4, 98));
    const feat = Math.round(clamp(50 + f.motion * 30 + f.speech * 4 - (f.silent ? 28 : 0) + (f.cut ? 6 : 0) - (t > 8 && !f.cut && f.motion < 0.2 ? 6 : 0), 3, 97));
    const attention = Math.round(clamp(neural * 0.6 + feat * 0.4 - Math.max(0, t - 30) * 0.4, 2, 99));
    const drivers: string[] = [];
    if (t < 3) drivers.push("Direct-address hook");
    if (f.cut) drivers.push("Scene cut");
    if (f.silent) drivers.push("Dead air");
    if (f.speech >= 3) drivers.push("Dense speech");
    if (networks.salience[t] > 1) drivers.push("High salience response");
    if (networks.attention[t] < -0.8) drivers.push("Attention network drops");
    if (networks.social[t] > 1) drivers.push("Story / self-relevance");
    if (!f.cut && f.motion < 0.18 && t > 6) drivers.push("Static framing");
    return { t, attention, neural, features: feat, drivers: drivers.slice(0, 3) };
  });

  const plat = (p: PlatformId, decay: number, hookPenalty: number, score: number, verdict: string): PlatformPrediction => {
    const ret: number[] = [100];
    for (let t = 1; t < N; t++) {
      const a = seconds[t].attention;
      const drop = (t <= 3 ? hookPenalty : decay) * (1 + (55 - a) / 60) + (features[t].silent ? 0.9 : 0);
      ret.push(+Math.max(2, ret[t - 1] - Math.max(0.15, drop)).toFixed(1));
    }
    const avgViewSec = +(ret.reduce((s, v) => s + v / 100, 0)).toFixed(1);
    return {
      platform: p,
      retention: ret,
      avgViewSec,
      avgViewPct: Math.round((avgViewSec / N) * 100),
      completionPct: Math.round(ret[N - 1]),
      hookHoldPct: Math.round(ret[3]),
      score,
      verdict,
    };
  };
  const platforms = [
    plat("tiktok", 1.15, 6.5, 74, "Strong hook; trim the two dead-air gaps to keep the mid-video dip from leaking viewers."),
    plat("reels", 1.0, 5.6, 77, "Best fit: vertical framing, on-screen captions and a 42s runtime suit Reels well."),
    plat("shorts", 1.25, 6.8, 69, "Good, but Shorts viewers swipe faster through slow middles; tighten 0:11–0:22."),
    plat("youtube", 1.6, 9.5, 41, "Vertical 9:16 will be pillarboxed in the long-form player; post as a Short instead."),
    plat("linkedin", 0.95, 7.2, 63, "Self-improvement angle travels on LinkedIn; add a text hook in the first frame."),
    plat("x", 1.35, 8.4, 52, "Autoplays muted on X: without burned-in captions for the hook most viewers will scroll."),
  ];

  const moments: Moment[] = [
    { start: 0, end: 3, kind: "peak", attention: seconds[1].attention, label: "Pattern-interrupt hook (“Stop scrolling”)" },
    { start: 25, end: 28, kind: "peak", attention: seconds[26].attention, label: "Payoff: “finished a whole book”" },
    { start: 29, end: 34, kind: "peak", attention: seconds[31].attention, label: "The insight: make the default harder" },
    { start: 11, end: 14, kind: "dip", attention: seconds[12].attention, label: "Pause after the setup, static shot" },
    { start: 19, end: 22, kind: "dip", attention: seconds[20].attention, label: "Two seconds of dead air before day one" },
    { start: 40, end: 42, kind: "dip", attention: seconds[41].attention, label: "Silent tail after the CTA" },
  ];

  const suggestions: Suggestion[] = [
    { id: "s1", kind: "dead-air", severity: "high", title: "Cut the dead air at 0:20–0:22", detail: "Two silent seconds right before the story turns. The model predicts the steepest retention drop of the video here. Trim it or cover it with a B-roll insert of the phone in the other room.", start: 20, end: 22, impact: "+5% completion" },
    { id: "s2", kind: "pacing", severity: "high", title: "Tighten the setup (0:11–0:14)", detail: "The shot holds static for 3 seconds after “ninety times a day” with no new information. Punch in 115% or cut straight to “Then I tried…”.", start: 11, end: 14, impact: "+4% avg view" },
    { id: "s3", kind: "captions", severity: "medium", title: "Burn in captions for the hook", detail: "On X and LinkedIn most viewers start muted. The first sentence carries the hook, so it needs to be readable on screen in the first second.", start: 0, end: 3, impact: "+8% hook hold on X" },
    { id: "s4", kind: "hook", severity: "medium", title: "Show the result in the first frame", detail: "“Doubled my focus” is strong but abstract. Flash the finished book (0:26) as a 0.5s cold open before “Stop scrolling”.", start: 0, end: 1, impact: "+3% hook hold" },
    { id: "s5", kind: "length", severity: "low", title: "Drop the silent tail", detail: "The last 1–2 seconds after “part two” are silent. End on the CTA so the loop restarts sooner on TikTok and Reels.", start: 40, end: 42, impact: "Better loop rate" },
    { id: "s6", kind: "format", severity: "low", title: "Post a 16:9 cut for YouTube long-form, or skip it", detail: "This is a 9:16 video. In the YouTube long-form player it is pillarboxed and competes poorly. Publish it as a Short.", impact: "Platform fit" },
  ];

  const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  return {
    id,
    createdAt: Date.now() - 1000 * 60 * 14,
    fileName: "phone-in-other-room_v3.mp4",
    durationSec: N,
    width: 1080,
    height: 1920,
    thumbs: { url: makeSprite(N, 54, 96), count: N, width: 54, height: 96, interval: 1 },
    videoUrl: "/files/fixture/none.mp4",
    engine: { tribe: "used", mock: true, claude: "used" },
    features,
    tribe: { tr: 1, networks, global, modalities: ["video", "audio"], model: "facebook/tribev2", device: "mps", mock: true, elapsedSec: 71.4 },
    seconds,
    overall: {
      score: 71,
      hook: 84,
      pacing: 62,
      clarity: 78,
      neural: Math.round(mean(seconds.map((s) => s.neural ?? 0))),
    },
    platforms,
    bestPlatform: "reels",
    moments,
    suggestions,
    coaching: `## What's working
Your **first three seconds** do the heavy lifting: a direct pattern-interrupt (“Stop scrolling”) followed by a specific, believable promise (“doubled my focus in two weeks”). The predicted attention and salience response peaks right there, which is exactly where you want it.

## Where viewers leave
1. **0:11–0:14** — after the setup the shot sits static with no new information. This is the first leak.
2. **0:20–0:22** — two seconds of silence before the story turn. This is the single biggest drop in the predicted curve.
3. The silent tail at the end costs you loop replays on TikTok and Reels.

## Three edits for v4
- Cut the 0:20 pause and land “Day one was awful” on the previous beat.
- Punch in on “ninety times a day” so the static stretch has motion.
- Burn in captions for the first sentence; the hook needs to work muted.

Post it to **Instagram Reels** first. Your goal was *“grow a productivity audience”*, and the payoff at 0:26 (“I finished a whole book”) is concrete enough to drive saves there.`,
    transcript: SCRIPT.filter(Boolean).join(" "),
  };
}

export const FIXTURE_STATUS: PredictStatus = {
  tribe: { configured: true, url: "http://gpu-box.local:8765", reachable: true, model: "facebook/tribev2", device: "mps", mock: true, modalities: ["video", "audio", "text"] },
  claude: "claudeCode",
  whisper: true,
};

export function fixtureHistory(): PredictReportSummary[] {
  const now = Date.now();
  return [
    { id: "fixture-1", fileName: "phone-in-other-room_v3.mp4", createdAt: now - 1000 * 60 * 14, durationSec: 42, score: 71, bestPlatform: "reels", tribe: "used" },
    { id: "fixture-2", fileName: "phone-in-other-room_v2.mp4", createdAt: now - 1000 * 60 * 60 * 5, durationSec: 51, score: 58, bestPlatform: "tiktok", tribe: "used" },
    { id: "fixture-3", fileName: "desk-setup-tour.mov", createdAt: now - 1000 * 60 * 60 * 26, durationSec: 184, score: 46, bestPlatform: "youtube", tribe: "unavailable" },
    { id: "fixture-4", fileName: "morning-routine-hook-test.mp4", createdAt: now - 1000 * 60 * 60 * 24 * 4, durationSec: 23, score: 83, bestPlatform: "shorts", tribe: "used" },
  ];
}

export function fixtureJob(): PredictJob {
  return { id: "fixture-job", fileName: "phone-in-other-room_v3.mp4", status: "running", stage: "TRIBE v2 brain response (frame 18 of 42)", progress: 0.56, createdAt: Date.now() - 40_000 };
}

export const ALL_PLATFORM_IDS = PLATFORMS.map((p) => p.id);
