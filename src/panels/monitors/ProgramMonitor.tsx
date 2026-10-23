// Program Monitor — plays the active sequence through the WebGL engine.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Sequence } from "@shared/types";
import { formatTimecode } from "@shared/time";
import { sequenceDuration, editPoints } from "@shared/ops";
import { useActiveSequence, useEditor } from "../../store/store";
import { usePlayback } from "../../store/playback";
import { getProgramRenderer, renderSequenceFrame, setProgramView, transport } from "../../engine";
import { showContextMenu, type ContextMenuItem } from "../../ui/kit";
import { runCommand } from "../../commands/registry";
import { DEFAULT_PROGRAM_BUTTONS, useMonitorUI, type Zoom } from "./monitorStore";
import { ButtonBar, Icon, MiniRuler, RulersOverlay, SafeMarginsOverlay, TimecodeField, useElementSize, ZOOM_OPTIONS, type BtnDef } from "./parts";
import { TransformOverlay } from "./TransformOverlay";
import {
  goToEdit, openExportFrame, programAddMarker, programClear, programGoTo, programGoToMarker, programLiftExtract, programMarkClip,
  programSetIn, programSetOut,
} from "./actions";

const ed = () => useEditor.getState();

function fitSize(zoom: Zoom, vw: number, vh: number, w: number, h: number): { w: number; h: number } {
  if (vw <= 0 || vh <= 0) return { w: 0, h: 0 };
  const s = zoom === "fit" ? Math.min(vw / w, vh / h) : zoom / 100;
  return { w: Math.max(1, Math.floor(w * s)), h: Math.max(1, Math.floor(h * s)) };
}

export function useProgramButtons(): Record<string, BtnDef> {
  const playing = usePlayback((s) => s.playing === "program");
  const loop = useEditor((s) => s.loopPlayback);
  const proxies = useEditor((s) => s.proxiesEnabled);
  const safe = useEditor((s) => s.showSafeMargins);
  const cmp = useMonitorUI((s) => s.comparison.on);
  const fxMute = useMonitorUI((s) => s.fxMute);
  const multi = useMonitorUI((s) => s.multiCamera);
  const m = useMonitorUI.getState;
  return {
    addMarker: { id: "addMarker", label: "Add Marker", icon: Icon.addMarker, run: programAddMarker, shortcut: "M" },
    markIn: { id: "markIn", label: "Mark In", icon: Icon.markIn, run: programSetIn, shortcut: "I" },
    markOut: { id: "markOut", label: "Mark Out", icon: Icon.markOut, run: programSetOut, shortcut: "O" },
    markClip: { id: "markClip", label: "Mark Clip", icon: Icon.markClip, run: programMarkClip, shortcut: "X" },
    clearIn: { id: "clearIn", label: "Clear In", icon: Icon.clearIn, run: () => programClear("in") },
    clearOut: { id: "clearOut", label: "Clear Out", icon: Icon.clearOut, run: () => programClear("out") },
    clearInOut: { id: "clearInOut", label: "Clear In and Out", icon: Icon.clearInOut, run: () => programClear("both") },
    goToIn: { id: "goToIn", label: "Go to In", icon: Icon.goToIn, run: () => programGoTo("in"), shortcut: "Shift+I" },
    goToOut: { id: "goToOut", label: "Go to Out", icon: Icon.goToOut, run: () => programGoTo("out"), shortcut: "Shift+O" },
    stepBack: { id: "stepBack", label: "Step Back 1 Frame", icon: Icon.stepBack, run: () => transport.step("program", -1), cmd: "play.stepBack" },
    play: { id: "play", label: playing ? "Stop" : "Play", icon: playing ? Icon.stop : Icon.play, run: () => transport.toggle("program"), cmd: "play.toggle" },
    stepForward: { id: "stepForward", label: "Step Forward 1 Frame", icon: Icon.stepForward, run: () => transport.step("program", 1), cmd: "play.stepForward" },
    prevEdit: { id: "prevEdit", label: "Go to Previous Edit Point", icon: Icon.prevEdit, run: () => goToEdit(-1), shortcut: "↑" },
    nextEdit: { id: "nextEdit", label: "Go to Next Edit Point", icon: Icon.nextEdit, run: () => goToEdit(1), shortcut: "↓" },
    prevMarker: { id: "prevMarker", label: "Go to Previous Marker", icon: Icon.prevMarker, run: () => programGoToMarker(-1) },
    nextMarker: { id: "nextMarker", label: "Go to Next Marker", icon: Icon.nextMarker, run: () => programGoToMarker(1) },
    playInOut: { id: "playInOut", label: "Play In to Out", icon: Icon.playInOut, run: () => transport.playInToOut("program"), cmd: "play.inToOut" },
    playAround: { id: "playAround", label: "Play Around", icon: Icon.playAround, run: () => transport.playAround("program"), cmd: "play.around" },
    loop: { id: "loop", label: "Loop Playback", icon: Icon.loop, run: () => ed().setUI({ loopPlayback: !loop }), active: loop, cmd: "play.loop" },
    shuttleLeft: { id: "shuttleLeft", label: "Shuttle Left", icon: Icon.shuttleLeft, run: () => transport.shuttle("program", -1), cmd: "play.shuttleLeft" },
    shuttleRight: { id: "shuttleRight", label: "Shuttle Right", icon: Icon.shuttleRight, run: () => transport.shuttle("program", 1), cmd: "play.shuttleRight" },
    lift: { id: "lift", label: "Lift", icon: Icon.lift, run: () => programLiftExtract("lift"), shortcut: ";" },
    extract: { id: "extract", label: "Extract", icon: Icon.extract, run: () => programLiftExtract("extract"), shortcut: "'" },
    exportFrame: { id: "exportFrame", label: "Export Frame", icon: Icon.exportFrame, run: () => openExportFrame("program"), cmd: "monitor.exportFrame" },
    comparison: { id: "comparison", label: "Comparison View", icon: Icon.comparison, run: () => runCommand("monitor.toggleComparison"), active: cmp },
    toggleProxies: { id: "toggleProxies", label: "Toggle Proxies", icon: Icon.proxies, run: () => ed().setUI({ proxiesEnabled: !proxies }), active: proxies },
    safeMargins: { id: "safeMargins", label: "Safe Margins", icon: Icon.safeMargins, run: () => ed().setUI({ showSafeMargins: !safe }), active: safe },
    fxMute: { id: "fxMute", label: "Global FX Mute", icon: Icon.fxMute, run: () => m().set({ fxMute: !fxMute }), active: fxMute },
    multiCamera: { id: "multiCamera", label: "Toggle Multi-Camera View", icon: Icon.multiCamera, run: () => { m().set({ multiCamera: !multi }); if (!multi) ed().toast("Multi-Camera view needs a multicam source sequence (not yet supported)"); }, active: multi, shortcut: "Shift+0" },
  };
}

export function monitorSettingsItems(which: "program" | "source"): ContextMenuItem[] {
  const s = ed();
  const m = useMonitorUI.getState();
  const res = (r: 1 | 0.5 | 0.25, label: string): ContextMenuItem => ({ label, checked: s.playbackResolution === r, onClick: () => s.setUI({ playbackResolution: r }) });
  const items: ContextMenuItem[] = [
    { label: "Composite Video", checked: true },
    { separator: true },
    ...(which === "program"
      ? [
          { label: "Multi-Camera", checked: m.multiCamera, onClick: () => { m.set({ multiCamera: !m.multiCamera }); ed().toast("Multi-Camera view needs a multicam source sequence (not yet supported)"); } },
          { label: "Comparison View", checked: m.comparison.on, onClick: () => runCommand("monitor.toggleComparison") },
          { separator: true },
        ]
      : [{ label: "Audio Waveform", checked: m.sourceWaveform, onClick: () => m.set({ sourceWaveform: !m.sourceWaveform }) }, { separator: true }]),
    { label: "Playback Resolution", submenu: [res(1, "Full"), res(0.5, "1/2"), res(0.25, "1/4")] },
    { separator: true },
    { label: "Show Dropped Frame Indicator", checked: m.showDroppedFrames, onClick: () => m.set({ showDroppedFrames: !m.showDroppedFrames }) },
    { label: "Time Ruler Numbers", checked: m.timeRulerNumbers, onClick: () => m.set({ timeRulerNumbers: !m.timeRulerNumbers }) },
    { separator: true },
    { label: "Safe Margins", checked: s.showSafeMargins, onClick: () => s.setUI({ showSafeMargins: !s.showSafeMargins }) },
    { label: "Transparency Grid", checked: m.transparencyGrid, onClick: () => m.set({ transparencyGrid: !m.transparencyGrid }) },
    ...(which === "program"
      ? [
          { label: "Show Rulers", checked: m.showRulers, onClick: () => m.set({ showRulers: !m.showRulers }) },
          { label: "Show Guides", checked: m.showGuides, onClick: () => m.set({ showGuides: !m.showGuides }) },
          { label: "Global FX Mute", checked: m.fxMute, onClick: () => m.set({ fxMute: !m.fxMute }) },
        ]
      : []),
    { separator: true },
    { label: "Loop", checked: s.loopPlayback, onClick: () => s.setUI({ loopPlayback: !s.loopPlayback }) },
    { label: "Enable Proxies", checked: s.proxiesEnabled, onClick: () => s.setUI({ proxiesEnabled: !s.proxiesEnabled }) },
  ];
  return items;
}

export function ZoomSelect(props: { value: Zoom; onChange: (z: Zoom) => void }) {
  return (
    <select className="mon-select" value={String(props.value)} title="Select Zoom Level" onChange={(e) => props.onChange(e.target.value === "fit" ? "fit" : Number(e.target.value))}>
      {ZOOM_OPTIONS.map((z) => (
        <option key={z} value={String(z)}>{z === "fit" ? "Fit" : `${z}%`}</option>
      ))}
    </select>
  );
}

export function ResolutionSelect() {
  const res = useEditor((s) => s.playbackResolution);
  return (
    <select className="mon-select" value={String(res)} title="Select Playback Resolution" onChange={(e) => ed().setUI({ playbackResolution: Number(e.target.value) as 1 | 0.5 | 0.25 })}>
      <option value="1">Full</option>
      <option value="0.5">1/2</option>
      <option value="0.25">1/4</option>
    </select>
  );
}

function DroppedFrameLight() {
  const dropped = usePlayback((s) => s.droppedFrames);
  const show = useMonitorUI((s) => s.showDroppedFrames);
  if (!show) return null;
  return <span className={"dropped-light" + (dropped > 0 ? " warn" : "")} title={`Dropped frames: ${dropped}`} />;
}

/** Canvas host for the engine's GL canvas. */
function ProgramCanvas(props: { w: number; h: number }) {
  const host = useRef<HTMLDivElement>(null);
  const grid = useMonitorUI((s) => s.transparencyGrid);
  const fxMute = useMonitorUI((s) => s.fxMute);
  const renderer = useMemo(() => getProgramRenderer(), []);
  const [unsupported, setUnsupported] = useState(false);
  useLayoutEffect(() => {
    const el = host.current;
    if (!el) return;
    if (!renderer.supported) setUnsupported(true);
    el.appendChild(renderer.canvas);
    return () => {
      if (renderer.canvas.parentElement === el) el.removeChild(renderer.canvas);
      setProgramView(null);
    };
  }, [renderer]);
  useEffect(() => {
    const dpr = window.devicePixelRatio || 1;
    if (props.w > 0 && props.h > 0) setProgramView({ width: Math.round(props.w * dpr), height: Math.round(props.h * dpr), transparencyGrid: grid, bypassEffects: fxMute, gridCell: 8 * dpr });
  }, [props.w, props.h, grid, fxMute]);
  return (
    <div ref={host} className="program-canvas-host" style={{ width: props.w, height: props.h }}>
      {unsupported ? <div className="mon-msg">WebGL2 is not available — playback preview disabled.</div> : null}
    </div>
  );
}

/** Reference frame for Comparison View (offline-rendered). */
function ReferenceCanvas(props: { seq: Sequence; w: number; h: number; time: number; bypassEffects: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const project = useEditor((s) => s.project);
  const playing = usePlayback((s) => s.playing !== null);
  useEffect(() => {
    if (playing || props.w <= 0) return;
    const c = canvas.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const id = setTimeout(() => {
      const w = Math.min(Math.round(props.w * dpr), props.seq.settings.width);
      void renderSequenceFrame(props.seq, props.time, c, { width: w, height: Math.round((w * props.seq.settings.height) / props.seq.settings.width), bypassEffects: props.bypassEffects, project });
    }, 60);
    return () => clearTimeout(id);
  }, [props.seq, props.time, props.w, props.h, props.bypassEffects, project, playing]);
  return <canvas ref={canvas} className="ref-canvas" style={{ width: props.w, height: props.h }} />;
}

function ComparisonBar() {
  const cmp = useMonitorUI((s) => s.comparison);
  const set = (p: Partial<typeof cmp>) => useMonitorUI.getState().set({ comparison: { ...cmp, ...p } });
  return (
    <div className="cmp-bar">
      <div className="seg">
        <button className={cmp.mode === "shot" ? "on" : ""} onClick={() => set({ mode: "shot" })} title="Shot comparison: reference is another frame of the sequence">Shot</button>
        <button className={cmp.mode === "frame" ? "on" : ""} onClick={() => set({ mode: "frame" })} title="Frame comparison: current frame before / after effects">Frame</button>
      </div>
      <div className="seg">
        <button className={cmp.layout === "side" ? "on" : ""} onClick={() => set({ layout: "side" })} title="Side by Side">▯▯</button>
        <button className={cmp.layout === "vertical" ? "on" : ""} onClick={() => set({ layout: "vertical" })} title="Vertical Split">◧</button>
        <button className={cmp.layout === "horizontal" ? "on" : ""} onClick={() => set({ layout: "horizontal" })} title="Horizontal Split">⬒</button>
      </div>
      <button className="cmp-btn" onClick={() => set({ swap: !cmp.swap })} title="Swap Sides">⇄</button>
      <span className="spacer" />
      <button className="cmp-btn done" onClick={() => set({ on: false })}>Done</button>
    </div>
  );
}

export default function ProgramMonitor() {
  const seq = useActiveSequence();
  const time = usePlayback((s) => s.time);
  const zoom = useMonitorUI((s) => s.programZoom);
  const buttonsIds = useMonitorUI((s) => s.programButtons);
  const numbers = useMonitorUI((s) => s.timeRulerNumbers);
  const cmp = useMonitorUI((s) => s.comparison);
  const showRulers = useMonitorUI((s) => s.showRulers);
  const safe = useEditor((s) => s.showSafeMargins);
  const [vpRef, vp] = useElementSize<HTMLDivElement>();
  const buttons = useProgramButtons();
  const [showTransport, setShowTransport] = useState(true);

  const fps = seq?.settings.fps ?? 30;
  const dur = seq ? sequenceDuration(seq) : 0;
  const hasIO = seq?.inPoint !== undefined && seq?.outPoint !== undefined;
  const shownDur = hasIO ? seq!.outPoint! - seq!.inPoint! : dur;
  const seqW = seq?.settings.width ?? 1920, seqH = seq?.settings.height ?? 1080;

  const panes = cmp.on && cmp.layout === "side" ? 2 : 1;
  const disp = fitSize(zoom, (vp.w - (panes - 1) * 8) / panes - 4, vp.h - 4, seqW, seqH);
  const refTime = cmp.mode === "frame" ? time : cmp.refTime;
  const setCmp = (p: Partial<typeof cmp>) => useMonitorUI.getState().set({ comparison: { ...cmp, ...p } });

  const focus = () => ed().focusedMonitor !== "program" && ed().setUI({ focusedMonitor: "program" });
  const settingsMenu = (e: React.MouseEvent) =>
    showContextMenu(e, [
      ...monitorSettingsItems("program"),
      { separator: true },
      { label: "Show Transport Controls", checked: showTransport, onClick: () => setShowTransport(!showTransport) },
    ]);

  const stageContent = seq ? (
    <>
      <ProgramCanvas w={disp.w} h={disp.h} />
      {cmp.on && cmp.layout !== "side" ? (
        <div className="split-ref" style={{ clipPath: splitClip(cmp.layout, cmp.split, cmp.swap) }}>
          <ReferenceCanvas seq={seq} w={disp.w} h={disp.h} time={refTime} bypassEffects={cmp.mode === "frame"} />
        </div>
      ) : null}
      {cmp.on && cmp.layout !== "side" ? <SplitDivider layout={cmp.layout} split={cmp.split} onChange={(split) => setCmp({ split })} /> : null}
      {safe ? <SafeMarginsOverlay /> : null}
      {showRulers ? <RulersOverlay /> : null}
      {!cmp.on ? <TransformOverlay seq={seq} width={disp.w} height={disp.h} /> : null}
    </>
  ) : null;

  const refPane = seq && cmp.on && cmp.layout === "side" ? (
    <div className="cmp-pane">
      <div className="monitor-stage" style={{ width: disp.w, height: disp.h }}>
        <ReferenceCanvas seq={seq} w={disp.w} h={disp.h} time={refTime} bypassEffects={cmp.mode === "frame"} />
        {safe ? <SafeMarginsOverlay /> : null}
      </div>
      <div className="cmp-label">
        {cmp.mode === "shot" ? (
          <>
            <button className="mb" title="Previous edit" onClick={() => setCmp({ refTime: prevNextEdit(seq, cmp.refTime, -1) })}>{Icon.prevEdit}</button>
            <TimecodeField time={cmp.refTime} fps={fps} max={dur} onChange={(t) => setCmp({ refTime: t })} />
            <button className="mb" title="Next edit" onClick={() => setCmp({ refTime: prevNextEdit(seq, cmp.refTime, 1) })}>{Icon.nextEdit}</button>
          </>
        ) : (
          <span className="muted">Reference (effects off)</span>
        )}
      </div>
    </div>
  ) : null;

  return (
    <div className="monitor program-monitor" onPointerDownCapture={focus} onContextMenu={(e) => { if ((e.target as HTMLElement).closest(".monitor-viewport")) settingsMenu(e); }}>
      {cmp.on ? <ComparisonBar /> : null}
      <div ref={vpRef} className={"monitor-viewport" + (zoom === "fit" ? "" : " zoomed")}>
        {!seq ? (
          <div className="mon-msg">No sequence open. Create one with File › New › Sequence, or drop media on the Timeline.</div>
        ) : (
          <div className={"monitor-panes" + (panes === 2 ? " two" : "") + (cmp.swap ? " swapped" : "")}>
            {refPane}
            <div className={panes === 2 ? "cmp-pane" : "single-pane"}>
              <div className="monitor-stage" style={{ width: disp.w, height: disp.h }}>{stageContent}</div>
              {panes === 2 ? <div className="cmp-label"><span className="muted">Current</span></div> : null}
            </div>
          </div>
        )}
      </div>
      <div className="monitor-infobar">
        <TimecodeField time={time} fps={fps} max={dur} onChange={(t) => transport.goTo("program", t)} onScrubStart={() => usePlayback.getState().set({ scrubbing: true })} onScrubEnd={() => usePlayback.getState().set({ scrubbing: false })} title="Playhead Position" />
        <DroppedFrameLight />
        <ZoomSelect value={zoom} onChange={(z) => useMonitorUI.getState().set({ programZoom: z })} />
        <span className="spacer" />
        <ResolutionSelect />
        <button className="mb" title="Settings" onClick={settingsMenu}>{Icon.wrench}</button>
        <span className="tc dim" title={hasIO ? "In/Out Duration" : "Sequence Duration"}>{formatTimecode(shownDur, fps)}</span>
      </div>
      <MiniRuler
        duration={dur}
        time={time}
        fps={fps}
        inPoint={seq?.inPoint}
        outPoint={seq?.outPoint}
        markers={seq?.markers}
        numbers={numbers}
        onSeek={(t) => transport.setTime("program", t)}
        onScrub={(on) => {
          if (on && usePlayback.getState().playing) transport.stop();
          usePlayback.getState().set({ scrubbing: on });
        }}
        refTime={cmp.on && cmp.mode === "shot" ? cmp.refTime : undefined}
        onRefSeek={(t) => setCmp({ refTime: t })}
      />
      {showTransport ? (
        <ButtonBar buttons={buttons} ids={buttonsIds} defaults={DEFAULT_PROGRAM_BUTTONS} onChange={(ids) => useMonitorUI.getState().set({ programButtons: ids })} />
      ) : null}
    </div>
  );
}

function prevNextEdit(seq: Sequence, t: number, dir: 1 | -1): number {
  const pts = editPoints(seq);
  const v = dir > 0 ? pts.find((x) => x > t + 1e-4) : [...pts].reverse().find((x) => x < t - 1e-4);
  return v ?? t;
}

function splitClip(layout: "vertical" | "horizontal" | "side", split: number, swap: boolean): string {
  const pct = (n: number) => `${(n * 100).toFixed(2)}%`;
  if (layout === "vertical") return swap ? `inset(0 0 0 ${pct(split)})` : `inset(0 ${pct(1 - split)} 0 0)`;
  return swap ? `inset(${pct(split)} 0 0 0)` : `inset(0 0 ${pct(1 - split)} 0)`;
}

function SplitDivider(props: { layout: "vertical" | "horizontal"; split: number; onChange: (v: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const vertical = props.layout === "vertical";
  return (
    <div
      ref={ref}
      className={"split-divider " + (vertical ? "v" : "h")}
      style={vertical ? { left: `${props.split * 100}%` } : { top: `${props.split * 100}%` }}
      onPointerDown={(e) => {
        e.stopPropagation();
        try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* synthetic */ }
      }}
      onPointerMove={(e) => {
        if (!(e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) return;
        const stage = ref.current?.parentElement?.getBoundingClientRect();
        if (!stage) return;
        const v = vertical ? (e.clientX - stage.left) / stage.width : (e.clientY - stage.top) / stage.height;
        props.onChange(Math.max(0.02, Math.min(0.98, v)));
      }}
    />
  );
}
