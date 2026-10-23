// Keeps pooled <video> elements in step with the transport: playing at
// clip.speed × shuttle rate with drift correction while playing, precise seeks
// while paused/scrubbing/reversing, and preloading of upcoming clips.
import type { Clip, MediaAsset, Project, Sequence } from "@shared/types";
import { MediaPool, mediaUrl } from "./media";
import { clipPlayRange, sourceTimeUnclamped, visualTracks } from "./timing";

export interface VideoNeed {
  key: string;
  clip: Clip;
  asset: MediaAsset;
  active: boolean;
  target: number;
  rateMul: number;
}

/** Video clips needed around time t (recursing into nested sequences). Keys match the renderer's pool keys. */
export function collectVideoNeeds(project: Project, seq: Sequence, t: number, lookahead: number, out: VideoNeed[] = [], prefix = "", rateMul = 1, depth = 0, images?: Set<string>): VideoNeed[] {
  if (depth > 4) return out;
  for (const track of visualTracks(seq)) {
    if (track.muted) continue;
    for (const clip of seq.clips) {
      if (clip.trackId !== track.id || !clip.enabled) continue;
      if (clip.sequenceId) {
        const nested = project.sequences[clip.sequenceId];
        if (!nested || nested.id === seq.id) continue;
        const [s, e] = clipPlayRange(seq, clip);
        if (t < s - lookahead || t >= e) continue;
        const tn = sourceTimeUnclamped(clip, Math.max(t, s));
        collectVideoNeeds(project, nested, tn, t < s ? 0 : lookahead, out, prefix + clip.id + "/", rateMul * clip.speed * (clip.reversed ? -1 : 1), depth + 1, images);
        continue;
      }
      if (!clip.assetId) continue;
      const asset = project.media[clip.assetId];
      if (!asset || asset.status === "error") continue;
      const [s, e] = clipPlayRange(seq, clip);
      const active = t >= s && t < e;
      if (asset.kind === "image") {
        if (images && (active || (t < s && s - t <= lookahead))) images.add(asset.url);
        continue;
      }
      if (asset.kind !== "video" || !asset.hasVideo) continue;
      if (!active && !(t < s && s - t <= lookahead)) continue;
      out.push({ key: prefix + clip.id, clip, asset, active, target: sourceTimeUnclamped(clip, active ? t : s, asset.duration), rateMul });
    }
  }
  return out;
}

export function syncVideos(pool: MediaPool, needs: VideoNeed[], playing: boolean, rate: number, fps: number): Set<string> {
  const keys = new Set<string>();
  const now = performance.now();
  const frame = 1 / Math.max(1, fps);
  for (const n of needs) {
    const pv = pool.video(n.key, mediaUrl(n.asset));
    keys.add(n.key);
    const el = pv.el;
    if (!n.active) {
      if (!el.paused) el.pause();
      if (!el.seeking && Math.abs(el.currentTime - n.target) > 0.05) el.currentTime = n.target + 0.001;
      continue;
    }
    const eff = rate * n.clip.speed * n.rateMul * (n.clip.reversed ? -1 : 1);
    if (playing && eff > 0 && eff <= 16) {
      const pr = Math.max(0.0625, Math.min(16, eff));
      const drift = el.currentTime - n.target;
      if (Math.abs(drift) > Math.max(0.25, 0.1 * pr)) {
        if (!el.seeking && now - pv.lastSeekAt > 400) {
          el.currentTime = n.target + Math.min(0.15, 0.05 * pr);
          pv.lastSeekAt = now;
        }
        if (Math.abs(el.playbackRate - pr) > 1e-3) el.playbackRate = pr;
      } else if (Math.abs(drift) > frame) {
        // gentle rate correction for small drift (avoids seek stalls)
        const corr = Math.max(0.85, Math.min(1.15, 1 - drift * 1.5));
        el.playbackRate = Math.max(0.0625, Math.min(16, pr * corr));
      } else if (Math.abs(el.playbackRate - pr) > 1e-3) el.playbackRate = pr;
      if (el.paused) void el.play().catch(() => {});
    } else {
      // paused, scrubbing, reverse or extreme rates: step by seeking
      if (!el.paused) el.pause();
      if (!el.seeking && Math.abs(el.currentTime - (n.target + 0.001)) > 0.5 * frame) el.currentTime = n.target + 0.001;
    }
  }
  return keys;
}

