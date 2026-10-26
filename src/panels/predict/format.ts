// Formatting + color helpers for the Content Lab.
import type { NetworkId, PlatformId, PredictionReport } from "@shared/predict";
import { NETWORKS, PLATFORMS } from "@shared/predict";

export const fmtTime = (s: number) => {
  const t = Math.max(0, Math.floor(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};
export const fmtRange = (a?: number, b?: number) => (a === undefined ? "" : b === undefined || b - a <= 1 ? fmtTime(a) : `${fmtTime(a)}–${fmtTime(b)}`);
export const fmtDuration = (s: number) => {
  const r = Math.round(s);
  if (r < 60) return `${r}s`;
  if (r < 3600) return r % 60 ? `${Math.floor(r / 60)}m ${r % 60}s` : `${r / 60} min`;
  return `${Math.floor(r / 3600)}h ${Math.round((r % 3600) / 60)}m`;
};
export const fmtDate = (ms: number) => {
  const d = new Date(ms);
  const diff = Date.now() - ms;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)} h ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
};

export const platformMeta = (id: PlatformId | string) => PLATFORMS.find((p) => p.id === id);
export const platformName = (id: PlatformId | string) => platformMeta(id)?.name ?? id;
export const networkMeta = (id: NetworkId) => NETWORKS.find((n) => n.id === id)!;

/** Categorical slots (dataviz reference palette, dark steps; validated on #1e1e1e). Fixed per platform, never by rank. */
export const PLATFORM_COLOR: Record<PlatformId, string> = {
  tiktok: "#3987e5",
  reels: "#d95926",
  shorts: "#199e70",
  youtube: "#c98500",
  linkedin: "#d55181",
  x: "#008300",
};

export const NEURAL_COLOR = "#9085e9";

/** Status bands for 0..100 scores. Always shown with a label, never color alone. */
export function band(score: number): { key: "good" | "warning" | "serious" | "critical"; label: string; color: string } {
  if (score >= 75) return { key: "good", label: "Strong", color: "#0ca30c" };
  if (score >= 58) return { key: "warning", label: "Solid", color: "#fab219" };
  if (score >= 40) return { key: "serious", label: "Needs work", color: "#ec835a" };
  return { key: "critical", label: "Weak", color: "#d03b3b" };
}

function lerpHex(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return "#" + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, "0")).join("");
}
function ramp(stops: string[], t: number): string {
  const x = Math.min(1, Math.max(0, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  return lerpHex(stops[i], stops[i + 1], x - i);
}

/** Sequential (one hue, blue) for attention 0..100 on a dark surface: low recedes toward the surface. */
const SEQ = ["#1d2632", "#184f95", "#2a78d6", "#5598e7", "#9ec5f4"];
export const seqColor = (v: number) => ramp(SEQ, (v - 15) / 75); // domain 15..90 (scores rarely leave it)

/** Diverging blue <-> gray <-> red for z-scored network activation. */
const DIV = ["#3987e5", "#2c4a70", "#383835", "#7a3a3a", "#e66767"];
export const divColor = (z: number) => ramp(DIV, (Math.max(-2.5, Math.min(2.5, z)) + 2.5) / 5);

/** Notes about format fit for a platform, from the report's measured dimensions and length. */
export function fitNotes(rep: PredictionReport, id: PlatformId): { ok: boolean; text: string }[] {
  const p = platformMeta(id);
  if (!p) return [];
  const out: { ok: boolean; text: string }[] = [];
  if (rep.width && rep.height) {
    const vertical = rep.height > rep.width * 1.1;
    const square = Math.abs(rep.height - rep.width) <= rep.width * 0.1;
    const shape = vertical ? "Vertical" : square ? "Square" : "Horizontal";
    if (p.vertical) out.push(vertical ? { ok: true, text: `${shape} ${rep.width}×${rep.height} fits full screen` } : { ok: false, text: `${shape} video will be letterboxed; reframe to 9:16` });
    else out.push(!vertical ? { ok: true, text: `${shape} ${rep.width}×${rep.height} fits the player` } : { ok: false, text: "Vertical video is pillarboxed in this feed" });
  }
  if (rep.durationSec > p.idealMaxSec) out.push({ ok: false, text: `${fmtDuration(rep.durationSec)} is over the ~${fmtDuration(p.idealMaxSec)} sweet spot` });
  else out.push({ ok: true, text: `${fmtDuration(rep.durationSec)} is within the ~${fmtDuration(p.idealMaxSec)} sweet spot` });
  return out;
}

/** Plain-text summary for clipboard sharing. */
export function summaryText(rep: PredictionReport): string {
  const lines = [
    `EditCut Content Lab: ${rep.fileName} (${fmtDuration(rep.durationSec)})`,
    `Content score ${rep.overall.score}/100 (${band(rep.overall.score).label}) · Hook ${rep.overall.hook} · Pacing ${rep.overall.pacing} · Clarity ${rep.overall.clarity}${rep.overall.neural !== undefined ? ` · Neural ${rep.overall.neural}` : ""}`,
    `Best platform: ${platformName(rep.bestPlatform)}`,
    "",
    "Predicted per platform (EditCut estimates, not platform analytics):",
    ...rep.platforms.map((p) => `- ${platformName(p.platform)}: ${Math.round(p.score)}/100 · hook hold ${Math.round(p.hookHoldPct)}% · avg view ${Math.round(p.avgViewPct)}% · completion ${Math.round(p.completionPct)}%`),
    "",
    "Top suggestions:",
    ...rep.suggestions.slice(0, 5).map((s) => `- [${s.severity}] ${s.title}${s.start !== undefined ? ` (${fmtRange(s.start, s.end)})` : ""}${s.impact ? ` — ${s.impact}` : ""}`),
  ];
  if (rep.tribe) lines.push("", `Brain response predicted by ${rep.tribe.model}${rep.tribe.mock ? " (MOCK data)" : ""}.`);
  return lines.join("\n");
}
