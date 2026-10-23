// One clip on the timeline: label color, thumbnails / waveform, name, fx badge,
// speed, sync offsets, markers and the keyframe rubber band.
import { memo, useEffect, useRef, type CSSProperties } from "react";
import type { Clip, MediaAsset, Param, TrackKind } from "@shared/types";
import { LABEL_COLORS } from "@shared/types";
import { evalParam } from "@shared/params";
import { getClip } from "@shared/ops";
import { formatTimecode } from "@shared/time";
import { produce } from "immer";
import { editor, getActiveSequence } from "../../store/store";
import { showContextMenu } from "../../ui/kit";
import { beginDrag, lanesLeft, onClipPointerDown, timeAt, type ClipZone } from "./interact";
import { tl } from "./state";
import { usePeaks, type Peaks } from "./waveform";
import { CURSORS } from "./cursors";
import { MARKER_COLORS } from "./dialogs";

export interface ClipViewProps {
  clip: Clip;
  kind: TrackKind;
  height: number;
  pps: number;
  selected: boolean;
  asset?: MediaAsset;
  offline: boolean;
  nestedMissing: boolean;
  syncOffset?: number;
  duplicate: boolean;
  fps: number;
  /** Visible time window (quantized) for culling thumbnails/waveform tiles. */
  vt0: number;
  vt1: number;
  showThumbs: boolean;
  showWave: boolean;
  showKeyframes: boolean;
  showMarkers: boolean;
  showNames: boolean;
  showFx: boolean;
  tool: string;
  onContextMenu: (e: React.MouseEvent, clip: Clip) => void;
  onDoubleClick: (clip: Clip) => void;
}

const NAME_H = 15;

function labelColor(c: Clip, kind: TrackKind): string {
  if (c.label) return LABEL_COLORS[c.label];
  return kind === "audio" ? LABEL_COLORS.forest : LABEL_COLORS.iris;
}

function zoneAt(e: React.PointerEvent | React.MouseEvent, w: number): ClipZone {
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const x = e.clientX - r.left;
  const edge = Math.min(8, Math.max(3, w / 4));
  if (x <= edge) return "in";
  if (x >= r.width - edge) return "out";
  return "body";
}

function cursorFor(tool: string, zone: ClipZone, e: { metaKey: boolean; ctrlKey: boolean; altKey: boolean; shiftKey: boolean }): string {
  const mod = navigator.platform.includes("Mac") ? e.metaKey : e.ctrlKey;
  switch (tool) {
    case "select":
      if (zone === "body") return "default";
      return mod ? (zone === "in" ? CURSORS.rippleIn : CURSORS.rippleOut) : zone === "in" ? CURSORS.trimIn : CURSORS.trimOut;
    case "ripple":
      return zone === "body" ? "default" : zone === "in" ? CURSORS.rippleIn : CURSORS.rippleOut;
    case "roll":
      return zone === "body" ? "default" : CURSORS.roll;
    case "rateStretch":
      return zone === "body" ? "default" : CURSORS.rate;
    case "razor":
      return CURSORS.razor;
    case "slip":
      return CURSORS.slip;
    case "slide":
      return CURSORS.slide;
    case "pen":
      return CURSORS.pen;
    case "hand":
      return CURSORS.hand;
    case "zoom":
      return e.altKey ? CURSORS.zoomOut : CURSORS.zoomIn;
    case "type":
      return CURSORS.type;
    case "trackForward":
      return CURSORS.trackForward;
    case "trackBackward":
      return CURSORS.trackBackward;
  }
  return "default";
}

export const ClipView = memo(function ClipView(p: ClipViewProps) {
  const { clip, pps, height, kind } = p;
  const x = clip.start * pps;
  const w = Math.max(1, clip.duration * pps);
  const color = labelColor(clip, p.kind);
  const fxCount = clip.effects.length;
  const intrinsic = clip.speed !== 1 || clip.reversed || (clip.opacity && clip.opacity.opacity.value !== 100) || !!clip.opacity?.opacity.keyframes?.length || (clip.audio && (clip.audio.volumeDb.value !== 0 || !!clip.audio.volumeDb.keyframes?.length));
  const speedText = clip.speed !== 1 || clip.reversed ? ` [${clip.reversed ? "-" : ""}${+(clip.speed * 100).toFixed(2)}%]` : "";
  const style: CSSProperties = { left: x, width: w, height, ["--clip-color" as string]: color };
  const cls =
    "tl-clip " + kind +
    (p.selected ? " selected" : "") +
    (!clip.enabled ? " disabled" : "") +
    (p.offline || p.nestedMissing ? " offline" : "") +
    (clip.generator ? " generator" : "") +
    (clip.sequenceId ? " nested" : "") +
    (w < 18 ? " tiny" : "");
  const tall = height >= 34;
  const bodyTop = height >= 30 ? NAME_H : 0;
  return (
    <div
      className={cls}
      style={style}
      data-clip-id={clip.id}
      onPointerDown={(e) => onClipPointerDown(e, clip.id, zoneAt(e, w))}
      onPointerMove={(e) => {
        (e.currentTarget as HTMLElement).style.cursor = cursorFor(p.tool, zoneAt(e, w), e);
        if (p.tool === "razor") tl().set({ hoverCut: { time: timeAt(e.clientX), trackIds: e.shiftKey ? "all" : [clip.trackId] } });
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        p.onDoubleClick(clip);
      }}
      onContextMenu={(e) => p.onContextMenu(e, clip)}
      title={`${clip.name}\nStart ${formatTimecode(clip.start, p.fps)}  Duration ${formatTimecode(clip.duration, p.fps)}${speedText ? `\nSpeed ${speedText.trim()}` : ""}`}
    >
      {p.showThumbs && kind === "video" && tall && p.asset?.thumbs && !p.offline ? (
        <Thumbs clip={clip} asset={p.asset} pps={pps} top={bodyTop} h={height - bodyTop} vt0={p.vt0} vt1={p.vt1} />
      ) : null}
      {p.showWave && kind === "audio" && height >= 22 && p.asset?.waveformUrl && !p.offline ? (
        <Wave clip={clip} url={p.asset.waveformUrl} pps={pps} top={height >= 30 ? NAME_H : 0} h={height - (height >= 30 ? NAME_H : 0)} vt0={p.vt0} vt1={p.vt1} />
      ) : null}
      {p.duplicate ? <div className="tl-dup-stripe" /> : null}
      <div className="tl-clip-head">
        {p.showFx && w > 30 ? <span className={"tl-fx" + (fxCount ? " applied" : intrinsic ? " intrinsic" : "")}>fx</span> : null}
        {p.syncOffset !== undefined ? <span className="tl-sync">{(p.syncOffset > 0 ? "+" : "-") + Math.round(Math.abs(p.syncOffset) * p.fps)}</span> : null}
        {p.showNames ? (
          <span className="tl-clip-name">
            {p.offline ? "Media Offline — " : p.nestedMissing ? "Missing Sequence — " : ""}
            {clip.name}
            {speedText}
          </span>
        ) : null}
      </div>
      {p.showMarkers && clip.markers.length
        ? clip.markers.map((m) => (
            <div key={m.id} className="tl-clip-marker" style={{ left: m.time * pps, width: m.duration ? Math.max(2, m.duration * pps) : undefined, background: MARKER_COLORS[m.color] }} title={m.name || "Marker"} />
          ))
        : null}
      {p.showKeyframes && height >= 26 && (kind === "audio" ? clip.audio : clip.opacity) ? <RubberBand clip={clip} kind={kind} w={w} h={height} pps={pps} top={bodyTop} tool={p.tool} /> : null}
    </div>
  );
});

// ---------------------------------------------------------------- thumbnails

function Thumbs(props: { clip: Clip; asset: MediaAsset; pps: number; top: number; h: number; vt0: number; vt1: number }) {
  const { clip, asset, pps, h } = props;
  const th = asset.thumbs!;
  const fw = Math.max(8, (th.width * h) / th.height);
  const total = clip.duration * pps;
  const a = Math.max(0, (props.vt0 - clip.start) * pps);
  const b = Math.min(total, (props.vt1 - clip.start) * pps);
  if (b <= a) return null;
  const k0 = Math.floor(a / fw), k1 = Math.ceil(b / fw);
  const frames = [];
  for (let k = k0; k < k1 && k - k0 < 400; k++) {
    const local = Math.min(clip.duration, (k * fw + fw / 2) / pps);
    const src = clip.reversed ? clip.sourceIn + (clip.duration - local) * clip.speed : clip.sourceIn + local * clip.speed;
    const idx = Math.max(0, Math.min(th.count - 1, Math.floor(src / th.interval)));
    frames.push(
      <div key={k} className="tl-thumb" style={{
        left: k * fw, width: Math.min(fw, total - k * fw), height: h,
        backgroundImage: `url(${th.url})`, backgroundSize: `${th.count * fw}px ${h}px`, backgroundPosition: `${-idx * fw}px 0`,
      }} />,
    );
  }
  return <div className="tl-thumbs" style={{ top: props.top, height: h }}>{frames}</div>;
}

// ---------------------------------------------------------------- waveform (canvas tiles)

const TILE = 1024;

function Wave(props: { clip: Clip; url: string; pps: number; top: number; h: number; vt0: number; vt1: number }) {
  const peaks = usePeaks(props.url);
  const { clip, pps } = props;
  if (!peaks) return null;
  const total = clip.duration * pps;
  const a = Math.max(0, (props.vt0 - clip.start) * pps);
  const b = Math.min(total, (props.vt1 - clip.start) * pps);
  if (b <= a) return null;
  const tiles = [];
  for (let i = Math.floor(a / TILE); i * TILE < b; i++) {
    tiles.push(<WaveTile key={i} index={i} width={Math.min(TILE, total - i * TILE)} peaks={peaks} clip={clip} pps={pps} h={props.h} />);
  }
  return <div className="tl-wave" style={{ top: props.top, height: props.h }}>{tiles}</div>;
}

const WaveTile = memo(function WaveTile(props: { index: number; width: number; peaks: Peaks; clip: Clip; pps: number; h: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { index, width, peaks, clip, pps, h } = props;
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    const W = Math.max(1, Math.ceil(width));
    cv.width = W * dpr;
    cv.height = Math.max(1, h * dpr);
    const g = cv.getContext("2d");
    if (!g) return;
    g.scale(dpr, dpr);
    g.clearRect(0, 0, W, h);
    g.fillStyle = "rgba(225,255,225,0.85)";
    const mid = h / 2;
    const pps2 = peaks.peaksPerSecond;
    const gain = Math.pow(10, (clip.audio?.volumeDb.value ?? 0) / 20);
    for (let x = 0; x < W; x++) {
      const l0 = (index * TILE + x) / pps, l1 = (index * TILE + x + 1) / pps;
      let s0 = clip.reversed ? clip.sourceIn + (clip.duration - l1) * clip.speed : clip.sourceIn + l0 * clip.speed;
      let s1 = clip.reversed ? clip.sourceIn + (clip.duration - l0) * clip.speed : clip.sourceIn + l1 * clip.speed;
      if (s1 < s0) [s0, s1] = [s1, s0];
      const i0 = Math.floor(s0 * pps2), i1 = Math.max(i0 + 1, Math.ceil(s1 * pps2));
      let m = 0;
      for (let i = i0; i < i1 && i < peaks.peaks.length; i++) if (peaks.peaks[i] > m) m = peaks.peaks[i];
      const v = Math.min(1, m * gain) * (mid - 1);
      if (v > 0.2) g.fillRect(x, mid - v, 1, v * 2);
    }
  }, [index, width, peaks, clip.sourceIn, clip.speed, clip.duration, clip.reversed, clip.audio?.volumeDb.value, pps, h]);
  return <canvas ref={ref} className="tl-wave-tile" style={{ left: index * TILE, width: Math.ceil(width), height: h }} />;
});

// ---------------------------------------------------------------- rubber band (volume / opacity keyframes)

type BandKind = "volume" | "opacity";
const PAD = 3;

export function bandNorm(kind: BandKind, v: number): number {
  if (kind === "opacity") return Math.min(1, Math.max(0, v / 100));
  const a = Math.pow(10, v / 20); // amplitude; +6 dB = 2.0 at the top
  return Math.min(1, Math.sqrt(Math.max(0, a / 2)));
}

export function bandValue(kind: BandKind, n: number): number {
  n = Math.min(1, Math.max(0, n));
  if (kind === "opacity") return Math.round(n * 1000) / 10;
  if (n <= 0.001) return -96;
  return Math.max(-96, Math.min(6, Math.round(20 * Math.log10(2 * n * n) * 10) / 10));
}

function bandParam(c: Clip, kind: TrackKind): Param | undefined {
  return kind === "audio" ? c.audio?.volumeDb : c.opacity?.opacity;
}

function editBand(c: Clip, kind: TrackKind, fn: (p: Param) => void): void {
  const prm = kind === "audio" ? c.audio?.volumeDb : c.opacity?.opacity;
  if (prm) fn(prm);
}

function RubberBand(props: { clip: Clip; kind: TrackKind; w: number; h: number; pps: number; top: number; tool: string }) {
  const { clip, kind, w, h, pps } = props;
  const bk: BandKind = kind === "audio" ? "volume" : "opacity";
  const prm = bandParam(clip, kind);
  if (!prm) return null;
  const top = Math.max(PAD, props.top);
  const span = h - top - PAD;
  const yOf = (v: number) => top + (1 - bandNorm(bk, v)) * span;
  const kfs = prm.keyframes ?? [];
  const pts = kfs.length ? [[0, evalParam(prm, 0)], ...kfs.map((k) => [k.t, k.v]), [clip.duration, evalParam(prm, clip.duration)]] : [[0, prm.value], [clip.duration, prm.value]];
  const d = pts.map(([t, v], i) => `${i ? "L" : "M"}${(t * pps).toFixed(1)},${yOf(v).toFixed(1)}`).join(" ");
  const label = (v: number) => (bk === "volume" ? `${v > 0 ? "+" : ""}${v.toFixed(1)} dB` : `Opacity ${v.toFixed(1)}%`);

  const valueAtY = (clientY: number, el: Element) => {
    const r = (el.closest(".tl-clip") as HTMLElement).getBoundingClientRect();
    return bandValue(bk, 1 - (clientY - r.top - top) / span);
  };

  const commitEdit = (label: string, fn: (c: Clip) => void, preview: boolean) => {
    const seq = getActiveSequence();
    if (!seq) return;
    if (preview) {
      tl().set({ preview: produce(seq, (d) => { const c = getClip(d as never, clip.id); if (c) fn(c); }) });
    } else {
      editor().applySeq(label, (s) => {
        const c = getClip(s, clip.id);
        if (c) fn(c);
      });
    }
  };

  const addKeyframeAt = (clientX: number, clientY: number | null, el: Element) => {
    const t = Math.min(clip.duration, Math.max(0, timeAt(clientX) - clip.start));
    const v = clientY === null ? evalParam(prm, t) : valueAtY(clientY, el);
    commitEdit("Add Keyframe", (c) => editBand(c, kind, (pp) => {
      const list = pp.keyframes ? [...pp.keyframes] : [];
      if (!list.length) {
        // first keyframe: Premiere keeps the current static value as the curve
        pp.value = evalParam(pp, t);
      }
      list.push({ t, v, interp: "linear" });
      list.sort((a, b) => a.t - b.t);
      pp.keyframes = list;
    }), false);
  };

  const onBandDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const mod = navigator.platform.includes("Mac") ? e.metaKey : e.ctrlKey;
    if (props.tool !== "select" && props.tool !== "pen") return;
    e.stopPropagation();
    if (mod || props.tool === "pen") {
      addKeyframeAt(e.clientX, props.tool === "pen" && !mod ? e.clientY : null, e.currentTarget);
      return;
    }
    // drag the line (whole clip when static, else the segment under the pointer)
    const t = timeAt(e.clientX) - clip.start;
    const segA = kfs.length ? kfs.filter((k) => k.t <= t).length - 1 : -1;
    const y0 = e.clientY;
    const el = e.currentTarget;
    const r = (el.closest(".tl-clip") as HTMLElement).getBoundingClientRect();
    void r;
    beginDrag(e, {
      cursor: CURSORS.band,
      threshold: 1,
      move: (ev) => {
        const dy = ev.clientY - y0;
        let shown = 0;
        commitEdit("", (c) => editBand(c, kind, (pp) => {
          const shift = (v: number) => bandValue(bk, bandNorm(bk, v) - dy / span);
          if (!pp.keyframes?.length) {
            pp.value = shift(prm.value);
            shown = pp.value;
          } else {
            const idx = [segA, segA + 1].filter((i) => i >= 0 && i < pp.keyframes!.length);
            for (const i of idx) pp.keyframes![i] = { ...pp.keyframes![i], v: shift(kfs[i].v) };
            shown = pp.keyframes![idx[0] ?? 0]?.v ?? 0;
          }
        }), true);
        tl().set({ tooltip: { x: ev.clientX, y: ev.clientY, text: label(shown) } });
      },
      up: (_ev, moved) => {
        const pv = tl().preview;
        tl().set({ preview: null, tooltip: null });
        if (!moved || !pv) return;
        editor().apply(bk === "volume" ? "Volume Level" : "Opacity", (d) => {
          d.sequences[pv.id] = pv;
        });
      },
    });
  };

  const onKfDown = (e: React.PointerEvent, i: number) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const k0 = kfs[i];
    const x0 = e.clientX, y0 = e.clientY;
    const lo = i > 0 ? kfs[i - 1].t : 0, hi = i < kfs.length - 1 ? kfs[i + 1].t : clip.duration;
    beginDrag(e, {
      cursor: "move",
      threshold: 1,
      move: (ev) => {
        const nt = Math.min(hi, Math.max(lo, k0.t + (ev.clientX - x0) / pps));
        const nv = bandValue(bk, bandNorm(bk, k0.v) - (ev.clientY - y0) / span);
        commitEdit("", (c) => editBand(c, kind, (pp) => {
          if (pp.keyframes?.[i]) pp.keyframes[i] = { ...pp.keyframes[i], t: ev.shiftKey ? k0.t : nt, v: nv };
        }), true);
        tl().set({ tooltip: { x: ev.clientX, y: ev.clientY, text: label(nv) } });
      },
      up: (_ev, moved) => {
        const pv = tl().preview;
        tl().set({ preview: null, tooltip: null });
        if (!moved || !pv) return;
        editor().apply("Move Keyframe", (d) => {
          d.sequences[pv.id] = pv;
        });
      },
    });
  };

  const onKfMenu = (e: React.MouseEvent, i: number) => {
    e.stopPropagation();
    showContextMenu(e, [
      { label: "Delete Keyframe", onClick: () => commitEdit("Delete Keyframe", (c) => editBand(c, kind, (pp) => {
        if (!pp.keyframes) return;
        const list = pp.keyframes.filter((_, j) => j !== i);
        if (!list.length) pp.value = kfs[i].v;
        pp.keyframes = list.length ? list : undefined;
      }), false) },
      { label: "Delete All Keyframes", onClick: () => commitEdit("Delete Keyframes", (c) => editBand(c, kind, (pp) => {
        pp.value = evalParam(pp, 0);
        pp.keyframes = undefined;
      }), false) },
      { separator: true },
      ...(["linear", "bezier", "hold", "easeIn", "easeOut"] as const).map((interp) => ({
        label: { linear: "Linear", bezier: "Bezier", hold: "Hold", easeIn: "Ease In", easeOut: "Ease Out" }[interp],
        checked: kfs[i].interp === interp,
        onClick: () => commitEdit("Keyframe Interpolation", (c) => editBand(c, kind, (pp) => {
          if (pp.keyframes?.[i]) pp.keyframes[i] = { ...pp.keyframes[i], interp };
        }), false),
      })),
    ]);
  };

  void lanesLeft;
  return (
    <svg className={"tl-band" + (props.tool === "pen" ? " pen" : "")} width={w} height={h} style={{ width: w, height: h }}>
      {props.tool === "pen" ? (
        <rect x={0} y={top} width={w} height={span} fill="transparent" style={{ pointerEvents: "all", cursor: CURSORS.penAdd }}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            addKeyframeAt(e.clientX, e.clientY, e.currentTarget);
          }} />
      ) : null}
      <path d={d} className="tl-band-hit" onPointerDown={onBandDown} />
      <path d={d} className="tl-band-line" />
      {kfs.map((k, i) => (
        <rect key={i} className="tl-kf" x={k.t * pps - 3.5} y={yOf(k.v) - 3.5} width={7} height={7} transform={`rotate(45 ${k.t * pps} ${yOf(k.v)})`}
          onPointerDown={(e) => onKfDown(e, i)} onContextMenu={(e) => onKfMenu(e, i)}>
          <title>{`${formatTimecode(clip.start + k.t, 30)}  ${label(k.v)}`}</title>
        </rect>
      ))}
    </svg>
  );
}
