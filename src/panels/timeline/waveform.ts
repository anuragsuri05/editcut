// Waveform peaks cache: fetches { peaksPerSecond, peaks } JSON once per URL.
import { useEffect, useState } from "react";

export interface Peaks {
  peaksPerSecond: number;
  peaks: number[];
}

const cache = new Map<string, Peaks | null>();
const pending = new Map<string, Promise<Peaks | null>>();

export function getPeaks(url: string | undefined): Peaks | null | undefined {
  return url ? cache.get(url) : undefined;
}

export function loadPeaks(url: string): Promise<Peaks | null> {
  if (cache.has(url)) return Promise.resolve(cache.get(url)!);
  let p = pending.get(url);
  if (!p) {
    p = fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: unknown) => {
        const o = j as Partial<Peaks> | null;
        const v = o && Array.isArray(o.peaks) && typeof o.peaksPerSecond === "number" ? (o as Peaks) : null;
        cache.set(url, v);
        pending.delete(url);
        return v;
      })
      .catch(() => {
        cache.set(url, null);
        pending.delete(url);
        return null;
      });
    pending.set(url, p);
  }
  return p;
}

export function usePeaks(url: string | undefined): Peaks | null {
  const [, force] = useState(0);
  const v = url ? cache.get(url) : null;
  useEffect(() => {
    if (!url || cache.has(url)) return;
    let alive = true;
    loadPeaks(url).then(() => alive && force((n) => n + 1));
    return () => {
      alive = false;
    };
  }, [url]);
  return v ?? null;
}

/** Max peak (0..1) of a source range. */
export function peakInRange(p: Peaks, from: number, to: number): number {
  const a = Math.max(0, Math.floor(from * p.peaksPerSecond));
  const b = Math.min(p.peaks.length, Math.ceil(to * p.peaksPerSecond));
  let m = 0;
  for (let i = a; i < b; i++) if (p.peaks[i] > m) m = p.peaks[i];
  return m;
}
