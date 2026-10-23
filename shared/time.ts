// Time helpers: frame snapping and timecode formatting.

export const EPS = 1e-6;

export function frameDuration(fps: number): number {
  return 1 / fps;
}

/** Snap seconds to the nearest frame boundary of the given fps. */
export function snapToFrame(t: number, fps: number): number {
  return Math.round(t * fps) / fps;
}

export function toFrames(t: number, fps: number): number {
  return Math.round(t * fps);
}

export function isDropFrame(fps: number): boolean {
  return Math.abs(fps - 29.97) < 0.01 || Math.abs(fps - 59.94) < 0.01;
}

/** Format seconds as HH:MM:SS:FF (non-drop) or HH;MM;SS;FF (drop-frame). */
export function formatTimecode(t: number, fps: number): string {
  const sign = t < 0 ? "-" : "";
  t = Math.abs(t);
  const nominal = Math.round(fps);
  let frames = Math.round(t * fps);
  const drop = isDropFrame(fps);
  if (drop) {
    // SMPTE drop-frame: skip frame numbers 0 and 1 (2 and 3 at 59.94) each minute except every 10th.
    const dropFrames = nominal === 60 ? 4 : 2;
    const framesPer10Min = Math.round(fps * 600);
    const framesPerMin = nominal * 60 - dropFrames;
    const d = Math.floor(frames / framesPer10Min);
    const m = frames % framesPer10Min;
    frames += dropFrames * 9 * d + (m > dropFrames ? dropFrames * Math.floor((m - dropFrames) / framesPerMin) : 0);
  }
  const ff = frames % nominal;
  const totalSec = Math.floor(frames / nominal);
  const ss = totalSec % 60;
  const mm = Math.floor(totalSec / 60) % 60;
  const hh = Math.floor(totalSec / 3600);
  const sep = drop ? ";" : ":";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${sign}${p(hh)}:${p(mm)}:${p(ss)}${sep}${p(ff)}`;
}

/** Parse "HH:MM:SS:FF", "MM:SS", "+15" (frames offset is handled by caller) or plain seconds. */
export function parseTimecode(s: string, fps: number): number | null {
  s = s.trim();
  if (!s) return null;
  if (/^\d+(\.\d+)?$/.test(s) && !s.includes(":")) {
    // Premiere treats a bare number as frames/timecode digits: "1500" => 00:00:15:00
    const digits = s.padStart(8, "0").slice(-8);
    const hh = +digits.slice(0, 2), mm = +digits.slice(2, 4), ss = +digits.slice(4, 6), ff = +digits.slice(6, 8);
    return hh * 3600 + mm * 60 + ss + ff / Math.round(fps);
  }
  const parts = s.split(/[:;.]/).map(Number);
  if (parts.some((n) => Number.isNaN(n))) return null;
  while (parts.length < 4) parts.unshift(0);
  const [hh, mm, ss, ff] = parts;
  return hh * 3600 + mm * 60 + ss + ff / Math.round(fps);
}

/** Short human duration, e.g. "1:23.4" */
export function formatDuration(t: number): string {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}
