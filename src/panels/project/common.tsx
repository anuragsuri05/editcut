// Shared bits for the Project, Media Browser, Info panels and Import mode:
// item icons, thumbnail sprite with hover scrub, mini waveform, formatters.
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { AudioLines, Clapperboard, Folder, FolderOpen, Image as ImageIcon, Film, AlertTriangle, Loader2 } from "lucide-react";
import type { MediaAsset, Project, ProjectItem, Sequence } from "@shared/types";
import { LABEL_COLORS } from "@shared/types";
import { formatTimecode } from "@shared/time";
import { sequenceDuration } from "@shared/ops";
import { useMediaProgress } from "../../projectIO";
import "./project.css";

// ---------------------------------------------------------------- formatting

export function fmtBytes(n?: number): string {
  if (!n) return "—";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n < 10 && i ? 1 : 0)} ${u[i]}`;
}

export function fmtFps(fps?: number): string {
  if (!fps) return "";
  return `${Number.isInteger(fps) ? fps.toFixed(2) : fps.toFixed(3).replace(/0$/, "")} fps`;
}

export function channelName(ch?: number): string {
  if (!ch) return "";
  return ch === 1 ? "Mono" : ch === 2 ? "Stereo" : ch === 6 ? "5.1" : `${ch} ch`;
}

/** Premiere "Video Info" column: "1920 x 1080 (1.0)". */
export function videoInfo(a: MediaAsset): string {
  if (!a.hasVideo || !a.width) return "";
  return `${a.width} x ${a.height} (1.0)`;
}

/** Premiere "Audio Info" column: "48000 Hz - Stereo". */
export function audioInfo(a: MediaAsset): string {
  if (!a.hasAudio) return "";
  return [a.sampleRate ? `${a.sampleRate} Hz` : "", channelName(a.audioChannels)].filter(Boolean).join(" - ");
}

/** Timebase used to display media timecode (stills/audio use the active sequence rate). */
export function mediaFps(a: MediaAsset, fallback = 30): number {
  return a.kind === "video" && a.fps ? a.fps : fallback;
}

export function tc(t: number, fps: number): string {
  return formatTimecode(t, fps);
}

/** Row data for a project item, shared by list view, icon view and Info panel. */
export interface ItemInfo {
  item: ProjectItem;
  asset?: MediaAsset;
  seq?: Sequence;
  kind: "bin" | "sequence" | "video" | "audio" | "image";
  duration: number;
  fps?: number;
  videoInfo: string;
  audioInfo: string;
  mediaType: string;
}

export function itemInfo(p: Project, item: ProjectItem): ItemInfo {
  if (item.type === "media") {
    const a = p.media[item.id];
    if (a)
      return {
        item, asset: a, kind: a.kind, duration: a.duration, fps: a.kind === "video" ? a.fps : undefined,
        videoInfo: videoInfo(a), audioInfo: audioInfo(a),
        mediaType: a.kind === "image" ? "Still Image" : a.kind === "audio" ? "Audio" : a.hasAudio ? "Movie" : "Video",
      };
  }
  if (item.type === "sequence") {
    const s = p.sequences[item.id];
    if (s)
      return {
        item, seq: s, kind: "sequence", duration: sequenceDuration(s), fps: s.settings.fps,
        videoInfo: `${s.settings.width} x ${s.settings.height} (${s.settings.pixelAspect.toFixed(1)})`,
        audioInfo: `${s.settings.sampleRate} Hz - Stereo`, mediaType: "Sequence",
      };
  }
  return { item, kind: item.type === "bin" ? "bin" : "video", duration: 0, videoInfo: "", audioInfo: "", mediaType: item.type === "bin" ? "Bin" : "Missing" };
}

// ---------------------------------------------------------------- icons

export function ItemIcon(props: { info: ItemInfo; open?: boolean; size?: number }) {
  const s = props.size ?? 14;
  const k = props.info.kind;
  if (k === "bin") return props.open ? <FolderOpen size={s} className="pi-icon bin" /> : <Folder size={s} className="pi-icon bin" />;
  if (k === "sequence") return <Clapperboard size={s} className="pi-icon seq" />;
  if (k === "audio") return <AudioLines size={s} className="pi-icon audio" />;
  if (k === "image") return <ImageIcon size={s} className="pi-icon image" />;
  return <Film size={s} className="pi-icon video" />;
}

export function LabelChip(props: { label?: ProjectItem["label"]; style?: CSSProperties }) {
  return <span className="label-chip" style={{ background: props.label ? LABEL_COLORS[props.label] : "transparent", ...props.style }} />;
}

/** Import pipeline state badge: spinner with stage progress, or error. */
export function StatusBadge(props: { asset?: MediaAsset; compact?: boolean }) {
  const prog = useMediaProgress((s) => (props.asset ? s.byId[props.asset.id] : undefined));
  const a = props.asset;
  if (!a) return null;
  if (a.status === "error")
    return (
      <span className="status-badge error" title={a.error ?? "Error"}>
        <AlertTriangle size={12} />
        {props.compact ? null : <span>{a.error === "Media offline" ? "Offline" : "Error"}</span>}
      </span>
    );
  if (a.status === "importing")
    return (
      <span className="status-badge importing" title={prog ? `${prog.stage} ${Math.round(prog.progress * 100)}%` : "Importing…"}>
        <Loader2 size={12} className="spin" />
        {props.compact ? null : <span>{prog ? `${prog.stage === "proxy" ? "Proxy" : "Importing"} ${Math.round(prog.progress * 100)}%` : "Importing…"}</span>}
      </span>
    );
  if (prog?.stage === "proxy")
    return (
      <span className="status-badge proxy" title="Creating proxy">
        <Loader2 size={12} className="spin" />
        {props.compact ? null : <span>Proxy {Math.round(prog.progress * 100)}%</span>}
      </span>
    );
  return null;
}

// ---------------------------------------------------------------- thumbnails

/**
 * Poster/scrub thumbnail from the asset's sprite strip. With scrub=true,
 * moving the mouse across it scrubs through the media (Premiere hover scrub)
 * and onScrub reports the source time.
 */
export function SpriteThumb(props: { asset: MediaAsset; width: number; scrub?: boolean; posterTime?: number; onScrub?: (t: number | null) => void }) {
  const { asset: a, width } = props;
  const th = a.thumbs;
  const [frac, setFrac] = useState<number | null>(null);
  const height = th ? Math.round((width * th.height) / th.width) : Math.round((width * 9) / 16);
  if (!th) {
    return (
      <div className="sprite-thumb placeholder" style={{ width, height: Math.round((width * 9) / 16) }}>
        {a.kind === "audio" ? <MiniWave asset={a} width={width} height={Math.round((width * 9) / 16)} /> : <Film size={20} />}
      </div>
    );
  }
  const poster = props.posterTime !== undefined && a.duration ? props.posterTime / a.duration : 0;
  const f = frac ?? poster;
  const idx = Math.min(th.count - 1, Math.max(0, Math.floor(f * th.count)));
  return (
    <div
      className="sprite-thumb"
      style={{
        width, height,
        backgroundImage: `url(${th.url})`,
        backgroundSize: `${width * th.count}px ${height}px`,
        backgroundPosition: `${-idx * width}px 0`,
      }}
      onMouseMove={
        props.scrub
          ? (e) => {
              const r = e.currentTarget.getBoundingClientRect();
              const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
              setFrac(x);
              props.onScrub?.(x * a.duration);
            }
          : undefined
      }
      onMouseLeave={
        props.scrub
          ? () => {
              setFrac(null);
              props.onScrub?.(null);
            }
          : undefined
      }
    >
      {props.scrub && frac !== null ? <div className="scrub-line" style={{ left: `${frac * 100}%` }} /> : null}
    </div>
  );
}

// ---------------------------------------------------------------- waveform

const peakCache = new Map<string, Promise<number[]>>();

function loadPeaks(url: string): Promise<number[]> {
  let p = peakCache.get(url);
  if (!p) {
    p = fetch(url)
      .then((r) => r.json())
      .then((j: { peaks: number[] }) => j.peaks)
      .catch(() => []);
    peakCache.set(url, p);
  }
  return p;
}

/** Compact waveform drawn from the asset's peaks JSON. */
export function MiniWave(props: { asset: MediaAsset; width: number; height: number; color?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const url = props.asset.waveformUrl;
  useEffect(() => {
    const cv = ref.current;
    if (!cv || !url) return;
    let alive = true;
    void loadPeaks(url).then((peaks) => {
      if (!alive || !peaks.length) return;
      const dpr = window.devicePixelRatio || 1;
      cv.width = props.width * dpr;
      cv.height = props.height * dpr;
      const g = cv.getContext("2d")!;
      g.scale(dpr, dpr);
      g.fillStyle = props.color ?? "#3fae4a";
      const mid = props.height / 2;
      const per = peaks.length / props.width;
      for (let x = 0; x < props.width; x++) {
        let m = 0;
        for (let i = Math.floor(x * per); i < Math.floor((x + 1) * per) && i < peaks.length; i++) m = Math.max(m, peaks[i]);
        const h = Math.max(1, m * props.height * 0.9);
        g.fillRect(x, mid - h / 2, 1, h);
      }
    });
    return () => {
      alive = false;
    };
  }, [url, props.width, props.height, props.color]);
  if (!url) return <AudioLines size={22} className="pi-icon audio" />;
  return <canvas ref={ref} style={{ width: props.width, height: props.height }} />;
}
