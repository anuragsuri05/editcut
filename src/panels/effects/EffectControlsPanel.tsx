// Effect Controls (Premiere): property tree on the left, mini timeline with keyframes on the right.
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Clip, Effect, Keyframe, Mask, Project, Sequence, Transition } from "@shared/types";
import { EFFECT_MAP, TRANSITION_MAP } from "@shared/effects";
import { evalParam, isAnimated, setParamAt } from "@shared/params";
import { formatTimecode, snapToFrame } from "@shared/time";
import { setClipSpeed, getClip, transitionSpan } from "@shared/ops";
import { uid } from "@shared/factory";
import { useEditor, useActiveSequence, getActiveSequence } from "../../store/store";
import { usePlayback } from "../../store/playback";
import { Checkbox, ColorInput, HotNumber, Select, showContextMenu, type ContextMenuItem } from "../../ui/kit";
import { live, commit, commitSeq, liveSeq } from "./liveEdit";
import {
  addEffectToClips, deleteSelectedKeyframes, formatDb, formatRotation, getParam, gotoKeyframe, isAudio, isVisual,
  kfKey, keyframeTimes, localTime, paramDefault, parseKfKey, parseRotation, resetParams, selectedClips,
  setSelectedInterp, toggleAnim, toggleKeyframeAtPlayhead, updateEffect,
} from "./model";
import { useEc } from "./ecState";
import { applyPreset, cloneEffects, EFFECT_MIME, PRESET_MIME } from "./presets";
import { BlendModeSelect, EllipseMaskIcon, KeyframeGlyph, KeyframeNav, PenMaskIcon, RectMaskIcon, ResetButton, Stopwatch } from "./widgets";
import "./effects.css";

// ---------------------------------------------------------------- lane geometry
interface Lane {
  s: number; // view start (sequence seconds)
  e: number; // view end
  w: number; // lane width px
  fps: number;
  x: (t: number) => number;
  t: (x: number) => number;
}
const LaneCtx = createContext<Lane>({ s: 0, e: 1, w: 1, fps: 30, x: () => 0, t: () => 0 });
const DepthCtx = createContext(0);

const KF_EPS = 1 / 240;

// ---------------------------------------------------------------- panel
export default function EffectControlsPanel() {
  const seq = useActiveSequence();
  const selection = useEditor((s) => s.selection);
  const clips = useMemo(() => selectedClips(seq, selection.clipIds), [seq, selection.clipIds]);
  const transition = seq && selection.transitionId ? seq.transitions.find((t) => t.id === selection.transitionId) : undefined;

  const [dragOver, setDragOver] = useState(false);
  const onDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes(EFFECT_MIME) || e.dataTransfer.types.includes(PRESET_MIME)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      setDragOver(true);
    }
  };
  const onDrop = (e: React.DragEvent) => {
    setDragOver(false);
    const ids = useEditor.getState().selection.clipIds;
    const fx = e.dataTransfer.getData(EFFECT_MIME);
    const pr = e.dataTransfer.getData(PRESET_MIME);
    if (fx) {
      e.preventDefault();
      addEffectToClips(fx, ids);
    } else if (pr) {
      e.preventDefault();
      applyPreset(pr, ids);
    }
  };

  const frameProps = {
    className: "ec" + (dragOver ? " drag-over" : ""),
    onDragOver,
    onDragLeave: () => setDragOver(false),
    onDrop,
  };

  if (!seq) return <div {...frameProps}><div className="panel-empty">(no sequence)</div></div>;
  if (transition) return <div {...frameProps}><TransitionControls seq={seq} tr={transition} /></div>;
  if (!clips.length) return <div {...frameProps}><div className="panel-empty">(no clip selected)</div></div>;

  const vClip = clips.find((c) => isVisual(seq, c));
  let aClip = clips.find((c) => isAudio(seq, c));
  if (vClip && aClip && vClip.linkId !== aClip.linkId) aClip = undefined; // only show linked audio alongside video
  const primary = vClip ?? aClip ?? clips[0];
  return (
    <div {...frameProps}>
      <ClipControls seq={seq} primary={primary} vClip={vClip} aClip={aClip} multi={clips.length} />
    </div>
  );
}

// ---------------------------------------------------------------- clip view
function ClipControls(props: { seq: Sequence; primary: Clip; vClip?: Clip; aClip?: Clip; multi: number }) {
  const { seq, primary, vClip, aClip } = props;
  const fps = seq.settings.fps;
  const { pinToClip, showTimeline, split, set } = useEc();
  const seqEnd = Math.max(...seq.clips.map((c) => c.start + c.duration), 1);
  const baseS = pinToClip ? primary.start : 0;
  const baseE = pinToClip ? primary.start + primary.duration : seqEnd;
  const [zoom, setZoom] = useState<{ key: string; s: number; e: number } | null>(null);
  const viewKey = `${primary.id}|${pinToClip}|${baseS}|${baseE}`;
  const view = zoom && zoom.key === viewKey ? zoom : { key: viewKey, s: baseS, e: Math.max(baseE, baseS + 1 / fps) };

  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const leftW = showTimeline ? Math.round(width * split) : width;
  const laneW = Math.max(40, width - leftW - 12); // 12 = stable scrollbar gutter
  const lane: Lane = useMemo(() => {
    const span = view.e - view.s;
    return { s: view.s, e: view.e, w: laneW, fps, x: (t) => ((t - view.s) / span) * laneW, t: (x) => view.s + (x / laneW) * span };
  }, [view.s, view.e, laneW, fps]);

  const time = usePlayback((s) => s.time);
  const bodyRef = useRef<HTMLDivElement>(null);
  const marquee = useMarquee(bodyRef);

  const onWheel = (e: React.WheelEvent) => {
    if (!showTimeline || !(e.altKey || e.ctrlKey || e.metaKey)) return;
    const r = wrapRef.current!.getBoundingClientRect();
    const x = e.clientX - r.left - leftW;
    if (x < 0) return;
    e.preventDefault();
    const at = lane.t(x);
    const k = e.deltaY > 0 ? 1.2 : 1 / 1.2;
    const s = at - (at - view.s) * k, en = at + (view.e - at) * k;
    setZoom({ key: viewKey, s: Math.max(baseS - 2, s), e: Math.min(baseE + 2, Math.max(en, s + 2 / fps)) });
  };

  const menu = (e: React.MouseEvent) =>
    showContextMenu(e, [
      { label: "Pin to Clip", checked: pinToClip, onClick: () => set({ pinToClip: !pinToClip }) },
      { label: "Show Timeline View", checked: showTimeline, onClick: () => set({ showTimeline: !showTimeline }) },
      { label: "Zoom to Fit", onClick: () => setZoom(null) },
      { separator: true },
      { label: "Paste", disabled: !useEc.getState().clipboard.length, onClick: pasteEffects },
      { label: "Remove Effects", onClick: () => removeAllEffects([primary.id, ...(aClip && aClip !== primary ? [aClip.id] : [])]) },
    ]);

  const clipName = primary.name;
  return (
    <LaneCtx.Provider value={lane}>
      <div className="ec-wrap" ref={wrapRef} onWheel={onWheel} style={{ ["--ec-left" as string]: `${leftW}px` }}>
        <div className="ec-head">
          <div className="ec-left ec-title" onContextMenu={menu}>
            <span className="ec-src">Source · {clipName}</span>
            <span className="ec-arrow">▸</span>
            <span className="ec-seqname">{seq.name} · {clipName}</span>
            {props.multi > 1 ? <span className="ec-multi">{props.multi} selected</span> : null}
            <span className="spacer" />
            <button className="ec-menu-btn" title="Panel menu" onClick={(e) => menu(e)}>≡</button>
          </div>
          {showTimeline ? <Ruler clip={primary} onScrub={(t) => usePlayback.getState().setTime(t)} /> : null}
        </div>
        <div className="ec-body" ref={bodyRef} onPointerDown={marquee.onPointerDown} onContextMenu={(e) => { if (e.target === e.currentTarget) menu(e); }}>
          {vClip ? <VideoSection seq={seq} clip={vClip} time={time} /> : null}
          {aClip ? <AudioSection seq={seq} clip={aClip} time={time} /> : null}
          <div className="ec-fill" />
        </div>
        {showTimeline ? (
          <>
            <div className="ec-overlay" style={{ left: leftW }}>
              <ClipShade clip={primary} />
              {time >= lane.s && time <= lane.e ? <div className="ec-playhead" style={{ left: lane.x(time) }} /> : null}
            </div>
            <SplitHandle left={leftW} width={width} />
          </>
        ) : null}
        {marquee.rect ? <div className="ec-marquee" style={marquee.rect} /> : null}
        <div className="ec-foot">
          <span className="ec-tc">{formatTimecode(time, fps)}</span>
          <span className="spacer" />
          {showTimeline ? (
            <>
              <button className="ec-foot-btn" title="Zoom out (Alt+wheel)" onClick={() => setZoom({ key: viewKey, s: view.s - (view.e - view.s) * 0.25, e: view.e + (view.e - view.s) * 0.25 })}>−</button>
              <button className="ec-foot-btn" title="Zoom in (Alt+wheel)" onClick={() => { const c = (view.s + view.e) / 2, h = (view.e - view.s) / 3; setZoom({ key: viewKey, s: c - h, e: c + h }); }}>+</button>
              <button className="ec-foot-btn" title="Zoom to fit" onClick={() => setZoom(null)}>⤢</button>
            </>
          ) : null}
        </div>
      </div>
    </LaneCtx.Provider>
  );
}

function SplitHandle(props: { left: number; width: number }) {
  const set = useEc((s) => s.set);
  return (
    <div
      className="ec-split"
      style={{ left: props.left - 3 }}
      onPointerDown={(e) => {
        (e.target as Element).setPointerCapture(e.pointerId);
        const x0 = e.clientX, l0 = props.left;
        const move = (ev: PointerEvent) => set({ split: Math.min(0.85, Math.max(0.25, (l0 + ev.clientX - x0) / props.width)) });
        const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
      }}
    />
  );
}

function ClipShade({ clip }: { clip: Clip }) {
  const lane = useContext(LaneCtx);
  const a = lane.x(clip.start), b = lane.x(clip.start + clip.duration);
  return (
    <>
      {a > 0 ? <div className="ec-outside" style={{ left: 0, width: Math.min(a, lane.w) }} /> : null}
      {b < lane.w ? <div className="ec-outside" style={{ left: Math.max(0, b), right: 0 }} /> : null}
    </>
  );
}

function Ruler(props: { clip: Clip; onScrub: (t: number) => void }) {
  const lane = useContext(LaneCtx);
  const span = lane.e - lane.s;
  const steps = [1 / lane.fps, 2 / lane.fps, 5 / lane.fps, 10 / lane.fps, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];
  const step = steps.find((s) => (s / span) * lane.w >= 70) ?? 600;
  const ticks: number[] = [];
  for (let t = Math.ceil(lane.s / step) * step; t <= lane.e + 1e-9; t += step) ticks.push(t);
  const scrub = (e: React.PointerEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    props.onScrub(snapToFrame(Math.max(0, lane.t(e.clientX - r.left)), lane.fps));
  };
  const a = lane.x(props.clip.start), b = lane.x(props.clip.start + props.clip.duration);
  return (
    <div
      className="ec-ruler"
      onPointerDown={(e) => { (e.target as Element).setPointerCapture(e.pointerId); scrub(e); }}
      onPointerMove={(e) => { if (e.buttons & 1) scrub(e); }}
    >
      {ticks.map((t) => (
        <span key={t.toFixed(4)} className="ec-tick" style={{ left: lane.x(t) }}>
          {formatTimecode(t, lane.fps).slice(3)}
        </span>
      ))}
      <div className="ec-clipbar" style={{ left: Math.max(0, a), width: Math.max(2, Math.min(lane.w, b) - Math.max(0, a)) }}>
        {props.clip.name}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- marquee selection of keyframes
function useMarquee(bodyRef: React.RefObject<HTMLDivElement | null>) {
  const [rect, setRect] = useState<React.CSSProperties | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (e.button !== 0 || !target.closest(".ec-lane") || target.closest(".ec-kf")) return;
    const wrap = bodyRef.current?.parentElement;
    if (!wrap) return;
    const wr = wrap.getBoundingClientRect();
    const x0 = e.clientX, y0 = e.clientY;
    const additive = e.shiftKey;
    let moved = false;
    const move = (ev: PointerEvent) => {
      if (Math.abs(ev.clientX - x0) + Math.abs(ev.clientY - y0) > 3) moved = true;
      if (!moved) return;
      setRect({ left: Math.min(x0, ev.clientX) - wr.left, top: Math.min(y0, ev.clientY) - wr.top, width: Math.abs(ev.clientX - x0), height: Math.abs(ev.clientY - y0) });
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setRect(null);
      const st = useEditor.getState();
      if (!moved) {
        if (!additive) st.select({ keyframes: [] });
        return;
      }
      const l = Math.min(x0, ev.clientX), r = Math.max(x0, ev.clientX), t = Math.min(y0, ev.clientY), b = Math.max(y0, ev.clientY);
      const keys = new Set(additive ? st.selection.keyframes : []);
      bodyRef.current?.querySelectorAll<HTMLElement>(".ec-kf").forEach((el) => {
        const br = el.getBoundingClientRect();
        if (br.right >= l && br.left <= r && br.bottom >= t && br.top <= b) for (const k of (el.dataset.keys ?? "").split(",")) if (k) keys.add(k);
      });
      st.select({ keyframes: [...keys] });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  return { rect, onPointerDown };
}

// ---------------------------------------------------------------- generic rows
function Row(props: { left: ReactNode; lane?: ReactNode; className?: string; onContextMenu?: (e: React.MouseEvent) => void; draggable?: boolean; onDragStart?: (e: React.DragEvent) => void; onDragOver?: (e: React.DragEvent) => void; onDrop?: (e: React.DragEvent) => void; onClick?: () => void }) {
  const depth = useContext(DepthCtx);
  const showTimeline = useEc((s) => s.showTimeline);
  return (
    <div
      className={"ec-row " + (props.className ?? "")}
      onContextMenu={props.onContextMenu}
      draggable={props.draggable}
      onDragStart={props.onDragStart}
      onDragOver={props.onDragOver}
      onDrop={props.onDrop}
      onClick={props.onClick}
    >
      <div className="ec-left" style={{ paddingLeft: 6 + depth * 14 }}>{props.left}</div>
      {showTimeline ? <div className="ec-lane">{props.lane}</div> : null}
    </div>
  );
}

function Group(props: {
  title: ReactNode; children: ReactNode; defaultOpen?: boolean; fx?: { on: boolean; toggle: () => void }; onReset?: () => void;
  right?: ReactNode; summary?: { clip: Clip; paths: string[] }; className?: string; rowProps?: Partial<Parameters<typeof Row>[0]>;
}) {
  const [open, setOpen] = useState(props.defaultOpen ?? true);
  const depth = useContext(DepthCtx);
  return (
    <>
      <Row
        className={"ec-group " + (props.className ?? "")}
        {...props.rowProps}
        left={
          <>
            <span className={"twirl" + (open ? " open" : "")} onClick={() => setOpen(!open)}>▸</span>
            {props.fx ? (
              <span className={"fx-toggle" + (props.fx.on ? " on" : "")} title="Toggle the effect on or off" onClick={(e) => { e.stopPropagation(); props.fx!.toggle(); }}>fx</span>
            ) : <span className="fx-toggle ghost">fx</span>}
            <span className="ec-group-title" onClick={() => setOpen(!open)}>{props.title}</span>
            <span className="spacer" />
            {props.right}
            {props.onReset ? <ResetButton title="Reset" onClick={props.onReset} /> : null}
          </>
        }
        lane={!open && props.summary ? <SummaryDiamonds {...props.summary} /> : null}
      />
      {open ? <DepthCtx.Provider value={depth + 1}>{props.children}</DepthCtx.Provider> : null}
    </>
  );
}

function SummaryDiamonds({ clip, paths }: { clip: Clip; paths: string[] }) {
  const lane = useContext(LaneCtx);
  return (
    <>
      {keyframeTimes(clip, paths).map((t) => (
        <span key={t} className="ec-kf summary" style={{ left: lane.x(clip.start + t) - 4 }}><KeyframeGlyph interp="linear" size={8} /></span>
      ))}
    </>
  );
}

// ---------------------------------------------------------------- animatable param row
interface Item {
  path: string;
  min?: number;
  max?: number;
  step?: number;
  decimals?: number;
  unit?: string;
  format?: (v: number) => string;
  parse?: (s: string) => number | null;
  disabled?: boolean;
  label?: string;
}

function ParamRow(props: { clip: Clip; label: string; items: Item[]; time: number; disabled?: boolean; noAnim?: boolean; slider?: { min: number; max: number } }) {
  const { clip, items, time } = props;
  const paths = items.map((i) => i.path);
  const [graph, setGraph] = useState(false);
  const animated = paths.some((p) => isAnimated(getParam(clip, p)));
  const lt = localTime(clip, time);
  const ts = keyframeTimes(clip, paths);
  const onKey = ts.some((t) => Math.abs(t - lt) < KF_EPS * 4);
  const label = `${props.label}`;

  const write = (path: string, v: number, final: boolean) => {
    const fn = (seq: Sequence) => {
      const c = seq.clips.find((x) => x.id === clip.id);
      if (!c) return;
      const t = localTime(c, usePlayback.getState().time);
      const p = getParam(c, path);
      if (p) setParamAt(p, t, v);
      // keep vector params' keyframes in sync (Position X/Y share keyframes like Premiere)
      for (const other of paths) {
        if (other === path) continue;
        const q = getParam(c, other);
        if (q && isAnimated(q) && p && isAnimated(p)) setParamAt(q, t, evalParam(q, t));
      }
    };
    if (final) commitSeq(`Change ${label}`, fn);
    else liveSeq(fn);
  };

  return (
    <>
      <Row
        className={props.disabled ? "disabled" : ""}
        left={
          <>
            {props.noAnim ? <span className="twirl-space" /> : <span className={"twirl small" + (graph ? " open" : "")} title="Show value graph" onClick={() => setGraph(!graph)}>▸</span>}
            {props.noAnim ? <span className="ec-stopwatch-space" /> : <Stopwatch on={animated} disabled={props.disabled} onClick={() => toggleAnim(clip.id, paths, `Toggle Animation ${label}`)} />}
            <span className="ec-label" title={label}>{label}</span>
            <span className="ec-values">
              {items.map((it) => {
                const v = evalParam(getParam(clip, it.path), lt, paramDefault(clip, it.path));
                return (
                  <HotNumber
                    key={it.path}
                    value={v}
                    min={it.min}
                    max={it.max}
                    step={it.step ?? 1}
                    decimals={it.decimals}
                    unit={it.unit}
                    format={it.format}
                    parse={it.parse}
                    disabled={props.disabled || it.disabled}
                    title={it.label}
                    onChange={(nv) => write(it.path, nv, false)}
                    onCommit={(nv) => write(it.path, nv, true)}
                  />
                );
              })}
            </span>
            <span className="spacer" />
            {animated ? (
              <KeyframeNav
                onKey={onKey}
                hasPrev={ts.some((t) => t < lt - KF_EPS)}
                hasNext={ts.some((t) => t > lt + KF_EPS)}
                onPrev={() => gotoKeyframe(clip, paths, -1)}
                onNext={() => gotoKeyframe(clip, paths, 1)}
                onToggle={() => toggleKeyframeAtPlayhead(clip.id, paths)}
              />
            ) : null}
            <ResetButton disabled={props.disabled} onClick={() => resetParams(clip.id, paths, `Reset ${label}`)} />
          </>
        }
        lane={<KeyframeLane clip={clip} paths={paths} />}
      />
      {graph ? <GraphRow clip={clip} path={paths[0]} /> : null}
    </>
  );
}

// ---------------------------------------------------------------- keyframe lane (diamonds, drag, menu)
interface Diamond { t: number; keys: string[]; interp: Keyframe["interp"] }

function diamondsFor(clip: Clip, paths: string[]): Diamond[] {
  const out: Diamond[] = [];
  for (const path of paths) {
    (getParam(clip, path)?.keyframes ?? []).forEach((k, i) => {
      const d = out.find((x) => Math.abs(x.t - k.t) < KF_EPS);
      if (d) d.keys.push(kfKey(clip.id, path, i));
      else out.push({ t: k.t, keys: [kfKey(clip.id, path, i)], interp: k.interp });
    });
  }
  return out;
}

function KeyframeLane({ clip, paths }: { clip: Clip; paths: string[] }) {
  const lane = useContext(LaneCtx);
  const selected = useEditor((s) => s.selection.keyframes);
  const selSet = useMemo(() => new Set(selected), [selected]);
  const diamonds = diamondsFor(clip, paths);
  return (
    <>
      {diamonds.map((d) => {
        const x = lane.x(clip.start + d.t);
        if (x < -6 || x > lane.w + 6) return null;
        const isSel = d.keys.every((k) => selSet.has(k));
        return (
          <span
            key={d.keys[0]}
            className={"ec-kf" + (isSel ? " selected" : "")}
            data-keys={d.keys.join(",")}
            style={{ left: x - 5 }}
            title={`${formatTimecode(clip.start + d.t, lane.fps)} · ${d.interp}`}
            onPointerDown={(e) => startKeyframeDrag(e, clip, d, lane)}
            onContextMenu={(e) => keyframeMenu(e, d)}
            onDoubleClick={() => usePlayback.getState().setTime(clip.start + d.t)}
          >
            <KeyframeGlyph interp={d.interp} selected={isSel} />
          </span>
        );
      })}
    </>
  );
}

function startKeyframeDrag(e: React.PointerEvent, clip: Clip, d: Diamond, lane: Lane) {
  if (e.button !== 0) return;
  e.stopPropagation();
  const st = useEditor.getState();
  let sel = new Set(st.selection.keyframes);
  const allSel = d.keys.every((k) => sel.has(k));
  if (e.shiftKey || e.metaKey || e.ctrlKey) {
    if (allSel) d.keys.forEach((k) => sel.delete(k));
    else d.keys.forEach((k) => sel.add(k));
  } else if (!allSel) sel = new Set(d.keys);
  st.select({ keyframes: [...sel], transitionId: null });
  if (e.shiftKey && allSel) return;

  const before = st.project;
  const seqId = before.activeSequenceId;
  const x0 = e.clientX;
  const secPerPx = (lane.e - lane.s) / lane.w;
  const selected = [...sel].map(parseKfKey);
  let moved = false;
  let lastDt = 0;
  const playhead = usePlayback.getState().time;

  const move = (ev: PointerEvent) => {
    let dt = (ev.clientX - x0) * secPerPx;
    if (!moved && Math.abs(ev.clientX - x0) < 3) return;
    moved = true;
    // snap: frame grid always, plus playhead when Shift is held (Premiere: shift-drag snaps)
    const anchorAbs = clip.start + d.t + dt;
    if (ev.shiftKey && Math.abs(anchorAbs - playhead) < 6 * secPerPx) dt = playhead - clip.start - d.t;
    dt = Math.round(dt * lane.fps) / lane.fps;
    if (dt === lastDt) return;
    lastDt = dt;
    const newKeys: string[] = [];
    live((proj: Project) => {
      const seq = seqId ? proj.sequences[seqId] : undefined;
      const seqBefore = seqId ? before.sequences[seqId] : undefined;
      if (!seq || !seqBefore) return;
      const groups = new Map<string, { clipId: string; path: string; idx: Set<number> }>();
      for (const s of selected) {
        const k = s.clipId + "|" + s.path;
        if (!groups.has(k)) groups.set(k, { clipId: s.clipId, path: s.path, idx: new Set() });
        groups.get(k)!.idx.add(s.index);
      }
      for (const g of groups.values()) {
        const cb = getClip(seqBefore, g.clipId);
        const c = getClip(seq, g.clipId);
        const pb = cb && getParam(cb, g.path);
        const p = c && getParam(c, g.path);
        if (!pb?.keyframes || !p || !c) continue;
        const tagged = pb.keyframes.map((k, i) => ({ k: { ...k, t: g.idx.has(i) ? Math.min(c.duration, Math.max(0, k.t + dt)) : k.t }, sel: g.idx.has(i) }));
        tagged.sort((a, b) => a.k.t - b.k.t);
        p.keyframes = tagged.map((x) => x.k);
        tagged.forEach((x, i) => x.sel && newKeys.push(kfKey(g.clipId, g.path, i)));
      }
    });
    useEditor.getState().select({ keyframes: newKeys });
  };
  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    if (moved && lastDt !== 0) commit("Move Keyframes");
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}

const INTERPS: { value: Keyframe["interp"]; label: string }[] = [
  { value: "linear", label: "Linear" },
  { value: "bezier", label: "Bezier" },
  { value: "hold", label: "Hold" },
  { value: "easeIn", label: "Ease In" },
  { value: "easeOut", label: "Ease Out" },
  { value: "easeInOut", label: "Ease In-Out" },
];

function keyframeMenu(e: React.MouseEvent, d: Diamond) {
  e.stopPropagation();
  const st = useEditor.getState();
  let keys = st.selection.keyframes;
  if (!d.keys.every((k) => keys.includes(k))) {
    keys = d.keys;
    st.select({ keyframes: keys });
  }
  const items: ContextMenuItem[] = [
    { label: "Temporal Interpolation", submenu: INTERPS.map((i) => ({ label: i.label, checked: d.interp === i.value, onClick: () => setSelectedInterp(i.value, keys) })) },
    ...INTERPS.map((i) => ({ label: i.label, checked: d.interp === i.value, onClick: () => setSelectedInterp(i.value, keys) })),
    { separator: true },
    { label: "Delete", shortcut: "⌦", onClick: () => deleteSelectedKeyframes() },
  ];
  showContextMenu(e, items);
}

// ---------------------------------------------------------------- value / velocity graph
function GraphRow({ clip, path }: { clip: Clip; path: string }) {
  const lane = useContext(LaneCtx);
  const p = getParam(clip, path);
  const H = 64;
  const a = Math.max(lane.s, clip.start), b = Math.min(lane.e, clip.start + clip.duration);
  const N = Math.max(2, Math.floor(lane.w / 3));
  const vals: { x: number; v: number }[] = [];
  for (let i = 0; i <= N; i++) {
    const t = a + ((b - a) * i) / N;
    vals.push({ x: lane.x(t), v: evalParam(p, t - clip.start, paramDefault(clip, path)) });
  }
  const vel = vals.slice(1).map((s, i) => ({ x: s.x, v: (s.v - vals[i].v) / ((b - a) / N || 1) }));
  const range = (arr: { v: number }[]) => {
    let lo = Math.min(...arr.map((s) => s.v)), hi = Math.max(...arr.map((s) => s.v));
    if (hi - lo < 1e-6) { lo -= 1; hi += 1; }
    return [lo, hi] as const;
  };
  const [lo, hi] = range(vals);
  const [vlo, vhi] = vel.length ? range(vel) : [0, 1];
  const y = (v: number, l: number, h: number) => H - 6 - ((v - l) / (h - l)) * (H - 12);
  return (
    <Row
      className="ec-graph-row"
      left={
        <div className="ec-graph-legend">
          <span>{hi.toFixed(1)}</span>
          <span className="muted">Value <span className="vel-key">— Velocity</span></span>
          <span>{lo.toFixed(1)}</span>
        </div>
      }
      lane={
        <svg width={lane.w} height={H} className="ec-graph">
          <polyline fill="none" stroke="#5b6b7d" strokeWidth="1" strokeDasharray="2 2" points={vel.map((s) => `${s.x},${y(s.v, vlo, vhi)}`).join(" ")} />
          <polyline fill="none" stroke="#2d8ceb" strokeWidth="1.5" points={vals.map((s) => `${s.x},${y(s.v, lo, hi)}`).join(" ")} />
          {(p?.keyframes ?? []).map((k, i) => (
            <circle key={i} cx={lane.x(clip.start + k.t)} cy={y(k.v, lo, hi)} r={3} fill="#fff" />
          ))}
        </svg>
      }
    />
  );
}

// ---------------------------------------------------------------- Video section
function VideoSection({ seq, clip, time }: { seq: Sequence; clip: Clip; time: number }) {
  const m = clip.motion!;
  void seq;
  const motionPaths = ["positionX", "positionY", "scale", "scaleWidth", "rotation", "anchorX", "anchorY", "cropLeft", "cropTop", "cropRight", "cropBottom"].map((k) => "motion." + k);
  const [antiFlicker, setAntiFlicker] = useState(0);
  const videoFx = clip.effects.filter((e) => EFFECT_MAP[e.type]?.kind !== "audio");
  return (
    <>
      <Row className="ec-cat" left={<span>Video</span>} />
      <Group
        title="Motion"
        summary={{ clip, paths: motionPaths }}
        onReset={() => resetParams(clip.id, motionPaths, "Reset Motion")}
        right={<span className="ec-hint" title="Motion is applied after effects, like Premiere">◰</span>}
      >
        <ParamRow clip={clip} time={time} label="Position" items={[{ path: "motion.positionX", decimals: 1, label: "X" }, { path: "motion.positionY", decimals: 1, label: "Y" }]} />
        <ParamRow clip={clip} time={time} label={m.uniformScale ? "Scale" : "Scale Height"} items={[{ path: "motion.scale", min: 0, max: 10000, decimals: 1, step: 0.5 }]} />
        <ParamRow clip={clip} time={time} label="Scale Width" disabled={m.uniformScale} items={[{ path: "motion.scaleWidth", min: 0, max: 10000, decimals: 1, step: 0.5 }]} />
        <Row
          left={
            <>
              <span className="twirl-space" /><span className="ec-stopwatch-space" />
              <Checkbox
                checked={m.uniformScale}
                label="Uniform Scale"
                onChange={(v) =>
                  useEditor.getState().applySeq("Uniform Scale", (s) => {
                    const c = getClip(s, clip.id);
                    if (c?.motion) {
                      c.motion.uniformScale = v;
                      if (!v) c.motion.scaleWidth = JSON.parse(JSON.stringify(c.motion.scale));
                    }
                  })
                }
              />
            </>
          }
        />
        <ParamRow clip={clip} time={time} label="Rotation" items={[{ path: "motion.rotation", step: 0.5, format: formatRotation, parse: parseRotation }]} />
        <ParamRow clip={clip} time={time} label="Anchor Point" items={[{ path: "motion.anchorX", decimals: 1, label: "X" }, { path: "motion.anchorY", decimals: 1, label: "Y" }]} />
        <Row
          left={
            <>
              <span className="twirl-space" /><Stopwatch on={false} disabled onClick={() => {}} />
              <span className="ec-label">Anti-flicker Filter</span>
              <span className="ec-values"><HotNumber value={antiFlicker} min={0} max={1} step={0.01} decimals={2} onChange={setAntiFlicker} title="Cosmetic: not rendered" /></span>
            </>
          }
        />
        <ParamRow clip={clip} time={time} label="Crop Left" items={[{ path: "motion.cropLeft", min: 0, max: 100, step: 0.2, decimals: 1, unit: "%" }]} />
        <ParamRow clip={clip} time={time} label="Crop Top" items={[{ path: "motion.cropTop", min: 0, max: 100, step: 0.2, decimals: 1, unit: "%" }]} />
        <ParamRow clip={clip} time={time} label="Crop Right" items={[{ path: "motion.cropRight", min: 0, max: 100, step: 0.2, decimals: 1, unit: "%" }]} />
        <ParamRow clip={clip} time={time} label="Crop Bottom" items={[{ path: "motion.cropBottom", min: 0, max: 100, step: 0.2, decimals: 1, unit: "%" }]} />
      </Group>
      <OpacityGroup seq={seq} clip={clip} time={time} />
      <Group title="Time Remapping" defaultOpen={false}>
        <Row
          left={
            <>
              <span className="twirl-space" /><Stopwatch on={false} disabled onClick={() => {}} />
              <span className="ec-label">Speed</span>
              <span className="ec-values">
                <HotNumber
                  value={clip.speed * 100}
                  min={1}
                  max={10000}
                  step={1}
                  decimals={2}
                  unit="%"
                  onChange={(v) => liveSeq((s, p) => setClipSpeed(p, s, clip.id, v / 100))}
                  onCommit={(v) => commitSeq("Speed", (s, p) => setClipSpeed(p, s, clip.id, v / 100))}
                />
              </span>
              <span className="spacer" />
              <span className="ec-hint">{clip.reversed ? "reversed" : ""}</span>
            </>
          }
        />
      </Group>
      {videoFx.map((fx, i) => (
        <EffectGroup key={fx.id} seq={seq} clip={clip} fx={fx} time={time} index={i} />
      ))}
    </>
  );
}

// ---------------------------------------------------------------- Opacity + masks
function OpacityGroup({ clip, time }: { seq: Sequence; clip: Clip; time: number }) {
  const addMask = (shape: Mask["shape"]) => {
    const pts =
      shape === "polygon"
        ? Array.from({ length: 6 }, (_, i) => ({ x: 0.5 + 0.22 * Math.cos((i * Math.PI) / 3), y: 0.5 + 0.22 * Math.sin((i * Math.PI) / 3) }))
        : [{ x: 0.3, y: 0.3 }, { x: 0.7, y: 0.3 }, { x: 0.7, y: 0.7 }, { x: 0.3, y: 0.7 }];
    useEditor.getState().applySeq(`Create ${shape} Mask`, (s) => {
      getClip(s, clip.id)?.masks.push({ id: uid("msk_"), shape, points: pts, feather: 10, expansion: 0, opacity: 100, inverted: false });
    });
  };
  return (
    <Group
      title="Opacity"
      summary={{ clip, paths: ["opacity.opacity"] }}
      onReset={() => {
        resetParams(clip.id, ["opacity.opacity"], "Reset Opacity");
        useEditor.getState().applySeq("Blend Mode", (s) => { const c = getClip(s, clip.id); if (c?.opacity) c.opacity.blendMode = "normal"; });
      }}
    >
      <Row
        left={
          <span className="ec-maskbtns">
            <button title="Create ellipse mask" onClick={() => addMask("ellipse")}><EllipseMaskIcon /></button>
            <button title="Create 4-point polygon mask" onClick={() => addMask("rectangle")}><RectMaskIcon /></button>
            <button title="Free draw bezier (creates an editable polygon mask)" onClick={() => addMask("polygon")}><PenMaskIcon /></button>
          </span>
        }
      />
      {clip.masks.map((mk, i) => (
        <MaskGroup key={mk.id} clip={clip} mask={mk} index={i} />
      ))}
      <ParamRow clip={clip} time={time} label="Opacity" items={[{ path: "opacity.opacity", min: 0, max: 100, step: 0.5, decimals: 1, unit: "%" }]} />
      <Row
        left={
          <>
            <span className="twirl-space" /><span className="ec-stopwatch-space" />
            <span className="ec-label">Blend Mode</span>
            <BlendModeSelect
              value={clip.opacity?.blendMode ?? "normal"}
              onChange={(v) => useEditor.getState().applySeq("Blend Mode", (s) => { const c = getClip(s, clip.id); if (c?.opacity) c.opacity.blendMode = v; })}
            />
          </>
        }
      />
    </Group>
  );
}

function MaskGroup({ clip, mask, index }: { clip: Clip; mask: Mask; index: number }) {
  const edit = (label: string, fn: (m: Mask) => void, final: boolean) => {
    const f = (s: Sequence) => {
      const m = getClip(s, clip.id)?.masks.find((x) => x.id === mask.id);
      if (m) fn(m);
    };
    if (final) commitSeq(label, f);
    else liveSeq(f);
  };
  const num = (label: string, key: "feather" | "expansion" | "opacity", min: number, max: number, unit?: string) => (
    <Row
      left={
        <>
          <span className="twirl-space" /><Stopwatch on={false} disabled onClick={() => {}} />
          <span className="ec-label">{label}</span>
          <span className="ec-values">
            <HotNumber value={mask[key]} min={min} max={max} step={key === "opacity" ? 0.5 : 1} decimals={1} unit={unit} onChange={(v) => edit(label, (m) => { m[key] = v; }, false)} onCommit={(v) => edit(label, (m) => { m[key] = v; }, true)} />
          </span>
        </>
      }
    />
  );
  const stub = () => useEditor.getState().toast("Mask tracking is not available yet");
  const remove = () => useEditor.getState().applySeq("Delete Mask", (s) => { const c = getClip(s, clip.id); if (c) c.masks = c.masks.filter((m) => m.id !== mask.id); });
  return (
    <Group
      title={<span>Mask ({index + 1}) <span className="muted">{mask.shape}</span></span>}
      className="ec-mask"
      right={<button className="ec-reset" title="Delete mask" onClick={remove}>✕</button>}
      rowProps={{ onContextMenu: (e) => showContextMenu(e, [{ label: "Delete Mask", onClick: remove }]) }}
    >
      <Row
        left={
          <>
            <span className="twirl-space" /><Stopwatch on={false} disabled onClick={() => {}} />
            <span className="ec-label">Mask Path</span>
            <span className="ec-track">
              <button title="Track selected mask backward 1 frame" onClick={stub}>◀|</button>
              <button title="Track selected mask backward" onClick={stub}>◀</button>
              <button title="Track selected mask forward" onClick={stub}>▶</button>
              <button title="Track selected mask forward 1 frame" onClick={stub}>|▶</button>
            </span>
          </>
        }
      />
      {num("Mask Feather", "feather", 0, 1000)}
      {num("Mask Opacity", "opacity", 0, 100, "%")}
      {num("Mask Expansion", "expansion", -1000, 1000)}
      <Row
        left={
          <>
            <span className="twirl-space" /><span className="ec-stopwatch-space" />
            <Checkbox checked={mask.inverted} label="Inverted" onChange={(v) => edit("Invert Mask", (m) => { m.inverted = v; }, true)} />
          </>
        }
      />
    </Group>
  );
}

// ---------------------------------------------------------------- applied effects
const REORDER_MIME = "application/x-editcut-fxreorder";

function EffectGroup({ clip, fx, time }: { seq: Sequence; clip: Clip; fx: Effect; time: number; index: number }) {
  const def = EFFECT_MAP[fx.type];
  const selectedFx = useEc((s) => s.selectedFx);
  const isSel = selectedFx?.fxId === fx.id;
  if (!def) return <Row left={<span className="muted">Unknown effect “{fx.type}”</span>} />;
  const paths = def.params.map((p) => `fx.${fx.id}.${p.key}`);
  const opt = (key: string) => fx.options?.[key];
  const setOpt = (key: string, v: string | boolean, label: string) =>
    updateEffect(clip.id, fx.id, label, (e) => { e.options = { ...(e.options ?? {}), [key]: v }; });

  const menu = (e: React.MouseEvent) => {
    useEc.getState().set({ selectedFx: { clipId: clip.id, fxId: fx.id } });
    showContextMenu(e, [
      { label: "Cut", onClick: () => { copyEffect(clip, fx); removeEffect(clip.id, fx.id, "Cut Effect"); } },
      { label: "Copy", onClick: () => copyEffect(clip, fx) },
      { label: "Paste", disabled: !useEc.getState().clipboard.length, onClick: pasteEffects },
      { label: "Clear", onClick: () => removeEffect(clip.id, fx.id) },
      { separator: true },
      { label: "Effect Enabled", checked: fx.enabled, onClick: () => updateEffect(clip.id, fx.id, "Toggle Effect", (x) => { x.enabled = !x.enabled; }) },
      { label: "Move Up", onClick: () => moveEffect(clip.id, fx.id, -1) },
      { label: "Move Down", onClick: () => moveEffect(clip.id, fx.id, 1) },
      { label: "Reset", onClick: () => resetEffect(clip.id, fx) },
      { separator: true },
      { label: "Save Preset…", onClick: () => useEditor.getState().openDialog("effects.savePreset", { clipId: clip.id, effectIds: [fx.id] }) },
    ]);
  };
  return (
    <Group
      key={fx.id}
      className={(isSel ? "selected " : "") + (fx.enabled ? "" : "fx-off")}
      title={def.name}
      fx={{ on: fx.enabled, toggle: () => updateEffect(clip.id, fx.id, fx.enabled ? "Disable Effect" : "Enable Effect", (x) => { x.enabled = !x.enabled; }) }}
      onReset={() => resetEffect(clip.id, fx)}
      summary={{ clip, paths }}
      right={def.category === "Lumetri" ? <span className="ec-hint">Lumetri panel →</span> : null}
      rowProps={{
        onContextMenu: menu,
        onClick: () => useEc.getState().set({ selectedFx: { clipId: clip.id, fxId: fx.id } }),
        draggable: true,
        onDragStart: (e) => { e.dataTransfer.setData(REORDER_MIME, `${clip.id}|${fx.id}`); e.dataTransfer.effectAllowed = "move"; },
        onDragOver: (e) => { if (e.dataTransfer.types.includes(REORDER_MIME)) { e.preventDefault(); e.stopPropagation(); } },
        onDrop: (e) => {
          const raw = e.dataTransfer.getData(REORDER_MIME);
          if (!raw) return;
          e.preventDefault();
          e.stopPropagation();
          const [cid, fid] = raw.split("|");
          if (cid !== clip.id || fid === fx.id) return;
          useEditor.getState().applySeq("Reorder Effects", (s) => {
            const c = getClip(s, clip.id);
            if (!c) return;
            const from = c.effects.findIndex((x) => x.id === fid);
            if (from < 0) return;
            const [moved] = c.effects.splice(from, 1);
            const to = c.effects.findIndex((x) => x.id === fx.id);
            c.effects.splice(to, 0, moved);
          });
        },
      }}
    >
      {def.params.map((p) => (
        <ParamRow
          key={p.key}
          clip={clip}
          time={time}
          label={p.label}
          disabled={!fx.enabled}
          items={[{ path: `fx.${fx.id}.${p.key}`, min: p.min, max: p.max, step: p.step ?? Math.max(0.01, (p.max - p.min) / 400), decimals: p.step && p.step >= 1 ? 0 : (p.max - p.min) <= 20 ? 2 : 1, unit: p.unit }]}
        />
      ))}
      {(def.options ?? []).map((o) => (
        <Row
          key={o.key}
          left={
            <>
              <span className="twirl-space" /><span className="ec-stopwatch-space" />
              {o.type === "boolean" ? (
                <Checkbox checked={opt(o.key) !== undefined ? !!opt(o.key) : !!o.default} label={o.label} onChange={(v) => setOpt(o.key, v, o.label)} />
              ) : (
                <>
                  <span className="ec-label">{o.label}</span>
                  {o.type === "color" ? (
                    <ColorInput
                      value={String(opt(o.key) ?? o.default)}
                      onChange={(v) => live((d) => { const c = d.activeSequenceId ? getClip(d.sequences[d.activeSequenceId], clip.id) : undefined; const e = c?.effects.find((x) => x.id === fx.id); if (e) e.options = { ...(e.options ?? {}), [o.key]: v }; })}
                      onCommit={(v) => commit(o.label, (d) => { const c = d.activeSequenceId ? getClip(d.sequences[d.activeSequenceId], clip.id) : undefined; const e = c?.effects.find((x) => x.id === fx.id); if (e) e.options = { ...(e.options ?? {}), [o.key]: v }; })}
                    />
                  ) : (
                    <Select value={String(opt(o.key) ?? o.default)} options={o.choices ?? []} onChange={(v) => setOpt(o.key, v, o.label)} style={{ maxWidth: 160 }} />
                  )}
                </>
              )}
            </>
          }
        />
      ))}
      {def.params.length === 0 && !(def.options ?? []).length ? <Row left={<span className="muted ec-noparams">No adjustable parameters</span>} /> : null}
    </Group>
  );
}

function copyEffect(clip: Clip, fx: Effect) {
  useEc.getState().set({ clipboard: [JSON.parse(JSON.stringify(fx)) as Effect] });
  useEditor.getState().toast(`Copied ${EFFECT_MAP[fx.type]?.name ?? fx.type}`);
  void clip;
}

export function pasteEffects(): void {
  const fxs = useEc.getState().clipboard;
  const st = useEditor.getState();
  const seq = getActiveSequence();
  if (!fxs.length || !seq) return;
  const clips = selectedClips(seq, st.selection.clipIds);
  let n = 0;
  st.applySeq("Paste Effects", (s) => {
    for (const c of clips) {
      const target = getClip(s, c.id);
      if (!target) continue;
      const ok = fxs.filter((f) => (EFFECT_MAP[f.type]?.kind === "audio" ? isAudio(s, target) : isVisual(s, target)));
      target.effects.push(...cloneEffects(ok));
      n += ok.length;
    }
  });
  if (!n) st.toast("Nothing to paste onto this selection", "error");
}

export function removeEffect(clipId: string, fxId: string, label = "Clear Effect"): void {
  useEditor.getState().applySeq(label, (s) => {
    const c = getClip(s, clipId);
    if (c) c.effects = c.effects.filter((e) => e.id !== fxId);
  });
  if (useEc.getState().selectedFx?.fxId === fxId) useEc.getState().set({ selectedFx: null });
}

function removeAllEffects(clipIds: string[]) {
  useEditor.getState().applySeq("Remove Effects", (s) => {
    for (const id of clipIds) {
      const c = getClip(s, id);
      if (c) c.effects = [];
    }
  });
}

function moveEffect(clipId: string, fxId: string, dir: -1 | 1) {
  useEditor.getState().applySeq("Reorder Effects", (s) => {
    const c = getClip(s, clipId);
    if (!c) return;
    const i = c.effects.findIndex((e) => e.id === fxId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= c.effects.length) return;
    [c.effects[i], c.effects[j]] = [c.effects[j], c.effects[i]];
  });
}

function resetEffect(clipId: string, fx: Effect) {
  const def = EFFECT_MAP[fx.type];
  if (!def) return;
  updateEffect(clipId, fx.id, `Reset ${def.name}`, (e) => {
    for (const p of def.params) e.params[p.key] = { value: p.default };
    const keep = Object.fromEntries(Object.entries(e.options ?? {}).filter(([k]) => !(def.options ?? []).some((o) => o.key === k)));
    e.options = { ...keep, ...Object.fromEntries((def.options ?? []).map((o) => [o.key, o.default])) };
  });
}

// ---------------------------------------------------------------- Audio section
function AudioSection({ clip, time }: { seq: Sequence; clip: Clip; time: number }) {
  const [bypass, setBypass] = useState(false);
  const [chanBypass, setChanBypass] = useState(false);
  const audioFx = clip.effects.filter((e) => EFFECT_MAP[e.type]?.kind === "audio");
  if (!clip.audio) return null;
  return (
    <>
      <Row className="ec-cat" left={<span>Audio</span>} />
      <Group title="Volume" summary={{ clip, paths: ["audio.volumeDb"] }} onReset={() => resetParams(clip.id, ["audio.volumeDb"], "Reset Volume")}>
        <Row left={<><span className="twirl-space" /><span className="ec-stopwatch-space" /><Checkbox checked={bypass} label="Bypass" onChange={setBypass} /><span className="ec-hint" title="Cosmetic in EditCut">&nbsp;</span></>} />
        <ParamRow clip={clip} time={time} label="Level" disabled={bypass} items={[{ path: "audio.volumeDb", min: -96, max: 15, step: 0.1, decimals: 1, unit: "dB", format: formatDb, parse: (s) => (s.includes("∞") ? -96 : parseFloat(s)) }]} />
        <Row
          left={
            <>
              <span className="twirl-space" /><span className="ec-stopwatch-space" />
              <Checkbox checked={clip.audio.muted} label="Mute" onChange={(v) => useEditor.getState().applySeq(v ? "Mute Clip" : "Unmute Clip", (s) => { const c = getClip(s, clip.id); if (c?.audio) c.audio.muted = v; })} />
            </>
          }
        />
      </Group>
      <Group title="Channel Volume" defaultOpen={false}>
        <Row left={<><span className="twirl-space" /><span className="ec-stopwatch-space" /><Checkbox checked={chanBypass} label="Bypass" onChange={setChanBypass} /></>} />
        {["Left", "Right"].map((ch) => (
          <Row key={ch} left={<><span className="twirl-space" /><Stopwatch on={false} disabled onClick={() => {}} /><span className="ec-label">{ch}</span><span className="ec-values"><HotNumber value={0} disabled unit="dB" decimals={1} onChange={() => {}} title="Per-channel volume is not available yet" /></span></>} />
        ))}
      </Group>
      <Group title="Panner" summary={{ clip, paths: ["audio.pan"] }} onReset={() => resetParams(clip.id, ["audio.pan"], "Reset Balance")}>
        <ParamRow clip={clip} time={time} label="Balance" items={[{ path: "audio.pan", min: -100, max: 100, step: 0.5, decimals: 1 }]} />
      </Group>
      {audioFx.map((fx, i) => (
        <EffectGroup key={fx.id} seq={getActiveSequence()!} clip={clip} fx={fx} time={time} index={i} />
      ))}
    </>
  );
}

// ---------------------------------------------------------------- Transition settings
const cosmeticTr = new Map<string, { reverse: boolean; border: number; borderColor: string; showSources: boolean; aa: string; start: number; end: number }>();

function TransitionControls({ seq, tr }: { seq: Sequence; tr: Transition }) {
  const def = TRANSITION_MAP[tr.type];
  const fps = seq.settings.fps;
  const [, force] = useState(0);
  const cos = cosmeticTr.get(tr.id) ?? { reverse: false, border: 0, borderColor: "#000000", showSources: false, aa: "Off", start: 0, end: 100 };
  const setCos = (p: Partial<typeof cos>) => { cosmeticTr.set(tr.id, { ...cos, ...p }); force((n) => n + 1); };
  const A = tr.clipAId ? getClip(seq, tr.clipAId) : undefined;
  const B = tr.clipBId ? getClip(seq, tr.clipBId) : undefined;
  const [s0, s1] = transitionSpan(tr);
  const setTr = (label: string, fn: (t: Transition) => void, final = true) => {
    const f = (s: Sequence) => { const t = s.transitions.find((x) => x.id === tr.id); if (t) fn(t); };
    if (final) commitSeq(label, f);
    else liveSeq(f);
  };
  const isWipe = def && ["Wipe", "Iris"].includes(def.category);
  const lo = Math.min(s0, A?.start ?? s0) - 0.2, hi = Math.max(s1, B ? B.start + B.duration : s1) + 0.2;
  const X = (t: number) => `${((t - lo) / (hi - lo)) * 100}%`;
  const time = usePlayback((s) => s.time);
  return (
    <div className="ec-transition">
      <div className="ec-tr-head">
        <div className={"ec-tr-thumb" + (cos.showSources ? " sources" : "")}>
          <div className="ab a">A</div>
          <div className="ab b">B</div>
        </div>
        <div>
          <div className="ec-tr-name">{def?.name ?? tr.type}</div>
          <div className="muted">{def?.category} transition · {def?.kind}</div>
          <div className="muted">{A ? `A: ${A.name}` : "A: (none)"} &nbsp; {B ? `B: ${B.name}` : "B: (none)"}</div>
        </div>
      </div>
      <div className="form-grid ec-tr-form">
        <label>Duration</label>
        <span>
          <HotNumber
            value={tr.duration}
            min={1 / fps}
            max={30}
            step={1 / fps}
            format={(v) => formatTimecode(v, fps)}
            parse={(s) => { const n = Number(s); return Number.isFinite(n) && !s.includes(":") ? n : null; }}
            onChange={(v) => setTr("Transition Duration", (t) => { t.duration = snapToFrame(v, fps); }, false)}
            onCommit={(v) => setTr("Transition Duration", (t) => { t.duration = snapToFrame(v, fps); })}
          />
          <span className="muted"> ({tr.duration.toFixed(2)}s)</span>
        </span>
        <label>Alignment</label>
        <Select
          value={tr.alignment}
          disabled={!(A && B)}
          options={[{ value: "center", label: "Center at Cut" }, { value: "start", label: "Start at Cut" }, { value: "end", label: "End at Cut" }]}
          onChange={(v) => setTr("Transition Alignment", (t) => { t.alignment = v; })}
        />
        <label>Start</label>
        <HotNumber value={cos.start} min={0} max={100} decimals={1} unit="%" onChange={(v) => setCos({ start: v })} title="Cosmetic" />
        <label>End</label>
        <HotNumber value={cos.end} min={0} max={100} decimals={1} unit="%" onChange={(v) => setCos({ end: v })} title="Cosmetic" />
        <label />
        <Checkbox checked={cos.showSources} label="Show Actual Sources" onChange={(v) => setCos({ showSources: v })} />
        {isWipe ? (
          <>
            <label>Border Width</label>
            <HotNumber value={cos.border} min={0} max={100} decimals={1} onChange={(v) => setCos({ border: v })} title="Cosmetic" />
            <label>Border Color</label>
            <ColorInput value={cos.borderColor} onChange={(v) => setCos({ borderColor: v })} />
          </>
        ) : null}
        <label />
        <Checkbox checked={cos.reverse} label="Reverse" onChange={(v) => setCos({ reverse: v })} />
        <label>Anti-aliasing Quality</label>
        <Select value={cos.aa} options={["Off", "Low", "Medium", "High"]} onChange={(v) => setCos({ aa: v })} />
      </div>
      <div className="ec-tr-timeline">
        {A ? <div className="ec-tr-clip a" style={{ left: X(A.start), width: `calc(${X(A.start + A.duration)} - ${X(A.start)})` }}>{A.name}</div> : null}
        <div className="ec-tr-span" style={{ left: X(s0), width: `calc(${X(s1)} - ${X(s0)})` }}>{def?.name}</div>
        {B ? <div className="ec-tr-clip b" style={{ left: X(B.start), width: `calc(${X(B.start + B.duration)} - ${X(B.start)})` }}>{B.name}</div> : null}
        <div className="ec-tr-cut" style={{ left: X(tr.at) }} />
        {time >= lo && time <= hi ? <div className="ec-playhead" style={{ left: X(time) }} /> : null}
      </div>
      <div className="muted ec-tr-note">Reverse, border, start/end and anti-aliasing are display-only in EditCut.</div>
    </div>
  );
}

// re-export for commands.ts
export { deleteSelectedKeyframes, removeAllEffects };
