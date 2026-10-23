// Source Monitor player: one media element for the asset loaded in the Source
// Monitor, synced to usePlayback.sourceTime.
import { usePlayback } from "../store/playback";
import { useEditor } from "../store/store";
import { mediaUrl } from "./media";

export class SourcePlayer {
  readonly el: HTMLVideoElement;
  private url = "";
  private lastSeekAt = 0;
  /** Bumped on seeked/loadeddata so the UI can redraw (e.g. canvas readers). */
  frameSeq = 0;

  constructor() {
    const el = document.createElement("video");
    el.playsInline = true;
    el.preload = "auto";
    el.crossOrigin = "anonymous";
    el.className = "source-video";
    const bump = () => this.frameSeq++;
    el.addEventListener("seeked", bump);
    el.addEventListener("loadeddata", bump);
    this.el = el;
  }

  sync(): void {
    const ed = useEditor.getState();
    const asset = ed.sourceAssetId ? ed.project.media[ed.sourceAssetId] : undefined;
    const el = this.el;
    if (!asset || asset.kind === "image" || asset.status === "error") {
      if (!el.paused) el.pause();
      if (this.url) {
        el.removeAttribute("src");
        el.load();
        this.url = "";
      }
      return;
    }
    const url = mediaUrl(asset);
    if (url !== this.url) {
      el.src = url;
      this.url = url;
    }
    const pb = usePlayback.getState();
    const t = pb.sourceTime;
    const frame = 1 / (asset.fps || 30);
    const playing = pb.playing === "source" && !pb.scrubbing && pb.rate > 0 && pb.rate <= 16;
    if (playing) {
      const pr = Math.max(0.0625, Math.min(16, pb.rate));
      if (Math.abs(el.playbackRate - pr) > 1e-3) el.playbackRate = pr;
      const now = performance.now();
      if (Math.abs(el.currentTime - t) > Math.max(0.25, 0.1 * pr) && !el.seeking && now - this.lastSeekAt > 400) {
        el.currentTime = t;
        this.lastSeekAt = now;
      }
      if (el.paused) void el.play().catch(() => {});
    } else {
      if (!el.paused) el.pause();
      if (!el.seeking && Math.abs(el.currentTime - (t + 0.001)) > frame * 0.5) el.currentTime = t + 0.001;
    }
  }
}
