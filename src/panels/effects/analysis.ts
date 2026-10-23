// Lightweight media analysis for inspector "Auto" buttons:
// - frame statistics (Lumetri Auto tone / white balance) from the server's frame JPEG
// - loudness estimate (Essential Sound Auto-Match) from the asset's waveform peaks
import type { Clip, Project } from "@shared/types";
import { sourceTimeAt } from "@shared/ops";
import { api } from "../../api";

export interface FrameStats {
  /** Luma percentiles 0..1 */
  p01: number;
  p50: number;
  p99: number;
  mean: number;
  /** Mean RGB of mid-tone pixels (for gray-world white balance). */
  avg: [number, number, number];
  /** Mean saturation 0..1 */
  sat: number;
}

/** Sample the source frame shown at timeline time t. Null for generators / failures. */
export async function sampleFrame(project: Project, clip: Clip, t: number): Promise<FrameStats | null> {
  if (!clip.assetId) return null;
  const asset = project.media[clip.assetId];
  if (!asset || !asset.hasVideo) return null;
  const src = sourceTimeAt(clip, t);
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = asset.kind === "image" ? asset.url : api.frameUrl(asset.id, src, 160);
  try {
    await img.decode();
  } catch {
    return null;
  }
  const w = Math.min(160, img.naturalWidth || 160), h = Math.max(1, Math.round((w * (img.naturalHeight || 90)) / (img.naturalWidth || 160)));
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, w, h);
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, w, h).data;
  } catch {
    return null;
  }
  const hist = new Array(256).fill(0);
  let n = 0, sum = 0, sat = 0;
  const acc = [0, 0, 0];
  let accN = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const y = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
    hist[y]++;
    n++;
    sum += y;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    sat += mx ? (mx - mn) / mx : 0;
    if (y > 40 && y < 220) {
      acc[0] += r; acc[1] += g; acc[2] += b; accN++;
    }
  }
  const pct = (p: number) => {
    let c = 0;
    for (let i = 0; i < 256; i++) {
      c += hist[i];
      if (c >= p * n) return i / 255;
    }
    return 1;
  };
  return {
    p01: pct(0.01), p50: pct(0.5), p99: pct(0.99), mean: sum / n / 255,
    avg: accN ? [acc[0] / accN / 255, acc[1] / accN / 255, acc[2] / accN / 255] : [0.5, 0.5, 0.5],
    sat: sat / n,
  };
}

/** Auto tone like Lumetri "Auto": exposure/contrast/whites/blacks/saturation (not white balance). */
export function autoTone(s: FrameStats): Record<string, number> {
  const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
  const exposure = clamp(Math.log2(0.42 / Math.max(0.02, s.p50)), -2, 2);
  const range = s.p99 - s.p01;
  const contrast = clamp((0.85 - range) * 60, -30, 40);
  const whites = clamp((0.97 - s.p99) * 120, -40, 40);
  const blacks = clamp((0.03 - s.p01) * 160, -40, 30);
  const saturation = clamp(100 + (0.32 - s.sat) * 60, 90, 125);
  const r = (v: number) => Math.round(v * 10) / 10;
  return { exposure: r(exposure), contrast: r(contrast), whites: r(whites), blacks: r(blacks), highlights: 0, shadows: r(clamp((0.35 - s.p50) * 60, -20, 30)), saturation: r(saturation) };
}

/** Gray-world white balance: Temperature/Tint that neutralize the average mid-tone color. */
export function autoWhiteBalance(s: FrameStats): { temperature: number; tint: number } {
  const [r, g, b] = s.avg;
  const clamp = (v: number) => Math.max(-100, Math.min(100, Math.round(v)));
  // warm cast (r > b) -> negative temperature; green cast (g > avg(r,b)) -> positive tint (toward magenta)
  return { temperature: clamp(((b - r) / Math.max(0.05, (r + b) / 2)) * 120), tint: clamp(((g - (r + b) / 2) / Math.max(0.05, g)) * 150) };
}

// ---------------------------------------------------------------- loudness

const peakCache = new Map<string, Promise<{ peaksPerSecond: number; peaks: number[] } | null>>();

export function loadPeaks(url: string) {
  if (!peakCache.has(url))
    peakCache.set(url, fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null));
  return peakCache.get(url)!;
}

/**
 * Approximate integrated loudness (LUFS-ish) of the part of the source a clip plays, from the
 * waveform peak envelope. Peaks overstate RMS by ~ the crest factor, so we subtract a typical
 * speech/music crest (~9 dB) and gate out near-silence like BS.1770's absolute gate.
 */
export async function estimateLoudness(project: Project, clip: Clip): Promise<number | null> {
  const asset = clip.assetId ? project.media[clip.assetId] : undefined;
  if (!asset?.waveformUrl) return null;
  const wf = await loadPeaks(asset.waveformUrl);
  if (!wf || !wf.peaks?.length) return null;
  const a = Math.floor(clip.sourceIn * wf.peaksPerSecond);
  const b = Math.min(wf.peaks.length, Math.ceil((clip.sourceIn + clip.duration * clip.speed) * wf.peaksPerSecond));
  let sum = 0, n = 0;
  for (let i = a; i < b; i++) {
    const p = wf.peaks[i];
    if (p < 0.003) continue; // -50 dBFS gate
    sum += p * p;
    n++;
  }
  if (!n) return null;
  const rmsDb = 10 * Math.log10(sum / n);
  return rmsDb - 9;
}

export const LOUDNESS_TARGETS: Record<string, number> = { Dialogue: -23, Music: -25, SFX: -21, Ambience: -30 };
