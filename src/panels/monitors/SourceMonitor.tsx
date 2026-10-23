// Source Monitor — views the asset in useEditor.sourceAssetId, marks In/Out,
// drags ranges to the timeline, Insert/Overwrite into the active sequence.
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { MediaAsset } from "@shared/types";
import { formatTimecode } from "@shared/time";
import { useEditor } from "../../store/store";
import { usePlayback } from "../../store/playback";
import { getSourcePlayer, transport } from "../../engine";
import { showContextMenu } from "../../ui/kit";
import { DEFAULT_SOURCE_BUTTONS, useMonitorUI } from "./monitorStore";
import { ButtonBar, Icon, MiniRuler, SafeMarginsOverlay, TimecodeField, useElementSize, type BtnDef } from "./parts";
import { monitorSettingsItems, ResolutionSelect, ZoomSelect } from "./ProgramMonitor";
import { openExportFrame, sourceAddMarker, sourceClear, sourceEdit, sourceGoToMarker, sourceSetIn, sourceSetOut } from "./actions";

const ed = () => useEditor.getState();

function useSourceButtons(asset: MediaAsset | null): Record<string, BtnDef> {
  const playing = usePlayback((s) => s.playing === "source");
  const loop = useEditor((s) => s.loopPlayback);
  const proxies = useEditor((s) => s.proxiesEnabled);
  const safe = useEditor((s) => s.showSafeMargins);
  const goIn = () => asset?.inPoint !== undefined && transport.goTo("source", asset.inPoint);
  const goOut = () => asset?.outPoint !== undefined && transport.goTo("source", asset.outPoint);
  return {
    addMarker: { id: "addMarker", label: "Add Marker", icon: Icon.addMarker, run: sourceAddMarker, cmd: "source.addMarker" },
    markIn: { id: "markIn", label: "Mark In", icon: Icon.markIn, run: () => sourceSetIn(), cmd: "source.markIn" },
    markOut: { id: "markOut", label: "Mark Out", icon: Icon.markOut, run: () => sourceSetOut(), cmd: "source.markOut" },
    clearIn: { id: "clearIn", label: "Clear In", icon: Icon.clearIn, run: () => sourceClear("in"), cmd: "source.clearIn" },
    clearOut: { id: "clearOut", label: "Clear Out", icon: Icon.clearOut, run: () => sourceClear("out"), cmd: "source.clearOut" },
    clearInOut: { id: "clearInOut", label: "Clear In and Out", icon: Icon.clearInOut, run: () => sourceClear("both"), cmd: "source.clearInOut" },
    goToIn: { id: "goToIn", label: "Go to In", icon: Icon.goToIn, run: goIn, cmd: "source.goToIn" },
    goToOut: { id: "goToOut", label: "Go to Out", icon: Icon.goToOut, run: goOut, cmd: "source.goToOut" },
    stepBack: { id: "stepBack", label: "Step Back 1 Frame", icon: Icon.stepBack, run: () => transport.step("source", -1), cmd: "play.stepBack" },
    play: { id: "play", label: playing ? "Stop" : "Play", icon: playing ? Icon.stop : Icon.play, run: () => transport.toggle("source"), cmd: "play.toggle" },
    stepForward: { id: "stepForward", label: "Step Forward 1 Frame", icon: Icon.stepForward, run: () => transport.step("source", 1), cmd: "play.stepForward" },
    insert: { id: "insert", label: "Insert", icon: Icon.insert, run: () => void sourceEdit("insert"), cmd: "monitor.insert" },
    overwrite: { id: "overwrite", label: "Overwrite", icon: Icon.overwrite, run: () => void sourceEdit("overwrite"), cmd: "monitor.overwrite" },
    exportFrame: { id: "exportFrame", label: "Export Frame", icon: Icon.exportFrame, run: () => openExportFrame("source"), cmd: "monitor.exportFrame" },
    prevMarker: { id: "prevMarker", label: "Go to Previous Marker", icon: Icon.prevMarker, run: () => sourceGoToMarker(-1), cmd: "source.prevMarker" },
    nextMarker: { id: "nextMarker", label: "Go to Next Marker", icon: Icon.nextMarker, run: () => sourceGoToMarker(1), cmd: "source.nextMarker" },
    playInOut: { id: "playInOut", label: "Play In to Out", icon: Icon.playInOut, run: () => transport.playInToOut("source"), cmd: "play.inToOut" },
    playAround: { id: "playAround", label: "Play Around", icon: Icon.playAround, run: () => transport.playAround("source"), cmd: "play.around" },
    loop: { id: "loop", label: "Loop Playback", icon: Icon.loop, run: () => ed().setUI({ loopPlayback: !loop }), active: loop, cmd: "play.loop" },
    shuttleLeft: { id: "shuttleLeft", label: "Shuttle Left", icon: Icon.shuttleLeft, run: () => transport.shuttle("source", -1), cmd: "play.shuttleLeft" },
    shuttleRight: { id: "shuttleRight", label: "Shuttle Right", icon: Icon.shuttleRight, run: () => transport.shuttle("source", 1), cmd: "play.shuttleRight" },
    safeMargins: { id: "safeMargins", label: "Safe Margins", icon: Icon.safeMargins, run: () => ed().setUI({ showSafeMargins: !safe }), active: safe },
    toggleProxies: { id: "toggleProxies", label: "Toggle Proxies", icon: Icon.proxies, run: () => ed().setUI({ proxiesEnabled: !proxies }), active: proxies },
  };
}

// ---------------------------------------------------------------- drag payload

function setDragPayload(e: React.DragEvent, asset: MediaAsset, video: boolean, audio: boolean) {
  const inP = asset.inPoint ?? 0;
  const outP = asset.outPoint ?? asset.duration;
  e.dataTransfer.setData("application/x-editcut-items", JSON.stringify([asset.id]));
  e.dataTransfer.setData("application/x-editcut-source-range", JSON.stringify({ assetId: asset.id, in: inP, out: outP, video, audio }));
  e.dataTransfer.setData("text/plain", asset.name);
  e.dataTransfer.effectAllowed = "copy";
}

// ---------------------------------------------------------------- waveform

const peaksCache = new Map<string, Promise<{ peaksPerSecond: number; peaks: number[] } | null>>();
function loadPeaks(url: string) {
  let p = peaksCache.get(url);
  if (!p) {
    p = fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    peaksCache.set(url, p);
  }
  return p;
}

function Waveform(props: { asset: MediaAsset; w: number; h: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const peaks = useRef<{ peaksPerSecond: number; peaks: number[] } | null>(null);
  const time = usePlayback((s) => s.sourceTime);
  const { asset } = props;
  const draw = () => {
    const c = canvas.current;
    if (!c || props.w <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(props.w * dpr);
    c.height = Math.round(props.h * dpr);
    const ctx = c.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#0d1a10";
    ctx.fillRect(0, 0, props.w, props.h);
    const dur = Math.max(asset.duration, 0.001);
    const x = (t: number) => (t / dur) * props.w;
    if (asset.inPoint !== undefined || asset.outPoint !== undefined) {
      ctx.fillStyle = "rgba(255,255,255,0.07)";
      ctx.fillRect(x(asset.inPoint ?? 0), 0, x(asset.outPoint ?? dur) - x(asset.inPoint ?? 0), props.h);
    }
    const mid = props.h / 2;
    ctx.fillStyle = "#3fae4a";
    const pk = peaks.current;
    if (pk && pk.peaks.length) {
      for (let px = 0; px < props.w; px++) {
        const i0 = Math.floor(((px / props.w) * dur) * pk.peaksPerSecond);
        const i1 = Math.max(i0 + 1, Math.floor((((px + 1) / props.w) * dur) * pk.peaksPerSecond));
        let m = 0;
        for (let i = i0; i < i1 && i < pk.peaks.length; i++) m = Math.max(m, pk.peaks[i]);
        const hh = Math.max(0.5, m * mid * 0.95);
        ctx.fillRect(px, mid - hh, 1, hh * 2);
      }
    } else {
      ctx.fillStyle = "#6b6b6b";
      ctx.font = "12px sans-serif";
      ctx.fillText(asset.waveformUrl ? "Loading waveform…" : "No waveform", 12, 20);
    }
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect(0, mid, props.w, 1);
    ctx.fillStyle = "#2d8ceb";
    ctx.fillRect(Math.round(x(time)), 0, 1.5, props.h);
  };
  useEffect(() => {
    let alive = true;
    peaks.current = null;
    if (asset.waveformUrl) void loadPeaks(asset.waveformUrl).then((p) => { if (alive) { peaks.current = p; draw(); } });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset.waveformUrl]);
  useEffect(draw);
  return (
    <canvas
      ref={canvas}
      className="source-waveform"
      style={{ width: props.w, height: props.h }}
      onPointerDown={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* synthetic */ }
        transport.goTo("source", ((e.clientX - r.left) / r.width) * asset.duration);
      }}
      onPointerMove={(e) => {
        if (!(e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) return;
        const r = e.currentTarget.getBoundingClientRect();
        transport.setTime("source", Math.max(0, ((e.clientX - r.left) / r.width) * asset.duration));
      }}
    />
  );
}

// ---------------------------------------------------------------- video host

function SourceVideo(props: { w: number; h: number }) {
  const host = useRef<HTMLDivElement>(null);
  const player = useMemo(() => getSourcePlayer(), []);
  useLayoutEffect(() => {
    const el = host.current;
    if (!el) return;
    el.appendChild(player.el);
    return () => {
      if (player.el.parentElement === el) el.removeChild(player.el);
    };
  }, [player]);
  return <div ref={host} className="source-video-host" style={{ width: props.w, height: props.h }} />;
}

function SourceHistoryMenu(props: { asset: MediaAsset | null }) {
  const history = useMonitorUI((s) => s.sourceHistory);
  const media = useEditor((s) => s.project.media);
  return (
    <button
      className="source-title"
      title="Recent clips"
      onClick={(e) => {
        const items = history.filter((id) => media[id]).map((id) => ({
          label: media[id].name,
          checked: id === props.asset?.id,
          onClick: () => ed().setUI({ sourceAssetId: id }),
        }));
        showContextMenu(e, [
          ...(items.length ? items : [{ label: "No recent clips", disabled: true }]),
          { separator: true },
          { label: "Close", disabled: !props.asset, onClick: () => { const h = useMonitorUI.getState().sourceHistory.filter((id) => id !== props.asset?.id); useMonitorUI.getState().set({ sourceHistory: h }); ed().setUI({ sourceAssetId: h[0] ?? null }); } },
          { label: "Close All", disabled: !history.length, onClick: () => { useMonitorUI.getState().set({ sourceHistory: [] }); ed().setUI({ sourceAssetId: null }); } },
        ]);
      }}
    >
      <span className="source-name">{props.asset ? props.asset.name : "(no clips)"}</span>
      <span className="caret">▾</span>
    </button>
  );
}

export default function SourceMonitor() {
  const assetId = useEditor((s) => s.sourceAssetId);
  const asset = useEditor((s) => (s.sourceAssetId ? s.project.media[s.sourceAssetId] ?? null : null));
  const time = usePlayback((s) => s.sourceTime);
  const zoom = useMonitorUI((s) => s.sourceZoom);
  const ids = useMonitorUI((s) => s.sourceButtons);
  const numbers = useMonitorUI((s) => s.timeRulerNumbers);
  const showWave = useMonitorUI((s) => s.sourceWaveform);
  const safe = useEditor((s) => s.showSafeMargins);
  const [vpRef, vp] = useElementSize<HTMLDivElement>();
  const buttons = useSourceButtons(asset);

  // new asset → park at its In point (or start)
  useEffect(() => {
    if (usePlayback.getState().playing === "source") transport.stop();
    const a = assetId ? ed().project.media[assetId] : null;
    usePlayback.getState().setSourceTime(a?.inPoint ?? 0);
  }, [assetId]);

  const fps = asset?.fps || 30;
  const dur = asset?.duration ?? 0;
  const aw = asset?.width || 1920, ah = asset?.height || 1080;
  const s = zoom === "fit" ? Math.min((vp.w - 4) / aw, (vp.h - 4) / ah) : zoom / 100;
  const disp = { w: Math.max(1, Math.floor(aw * s)), h: Math.max(1, Math.floor(ah * s)) };
  const audioOnly = !!asset && !asset.hasVideo && asset.kind !== "image";
  const inP = asset?.inPoint, outP = asset?.outPoint;
  const shownDur = (outP ?? dur) - (inP ?? 0);

  const focus = () => ed().focusedMonitor !== "source" && ed().setUI({ focusedMonitor: "source" });
  const settingsMenu = (e: React.MouseEvent) => showContextMenu(e, monitorSettingsItems("source"));

  return (
    <div className="monitor source-monitor" onPointerDownCapture={focus}>
      <div className="monitor-titlebar">
        <SourceHistoryMenu asset={asset} />
        {asset ? <span className="muted source-meta">{asset.width && asset.height ? `${asset.width}×${asset.height}` : ""}{asset.fps ? ` · ${asset.fps} fps` : ""}{asset.hasAudio ? ` · ${asset.audioChannels ?? 2}ch` : ""}</span> : null}
      </div>
      <div
        ref={vpRef}
        className={"monitor-viewport" + (zoom === "fit" ? "" : " zoomed")}
        onContextMenu={settingsMenu}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes("application/x-editcut-items")) e.preventDefault();
        }}
        onDrop={(e) => {
          // dropping a Project panel item loads it in the Source Monitor
          try {
            const raw = e.dataTransfer.getData("application/x-editcut-items");
            const list = JSON.parse(raw) as unknown;
            const first = Array.isArray(list) ? list[0] : (list as { ids?: string[] })?.ids?.[0];
            const id = typeof first === "string" ? first : (first as { id?: string })?.id;
            if (id && ed().project.media[id]) {
              e.preventDefault();
              ed().setUI({ sourceAssetId: id });
            }
          } catch {
            /* ignore */
          }
        }}
      >
        {!asset ? (
          <div className="mon-msg">Double-click a clip in the Project panel to open it here.</div>
        ) : audioOnly || showWave ? (
          <Waveform asset={asset} w={Math.max(1, vp.w - 8)} h={Math.max(1, vp.h - 8)} />
        ) : (
          <div className="monitor-stage" style={{ width: disp.w, height: disp.h }} draggable onDragStart={(e) => setDragPayload(e, asset, true, true)} title="Drag to the Timeline to edit">
            {asset.kind === "image" ? <img className="source-image" src={asset.url} draggable={false} alt="" /> : <SourceVideo w={disp.w} h={disp.h} />}
            {safe ? <SafeMarginsOverlay /> : null}
          </div>
        )}
        {asset ? (
          <div className="drag-handles">
            {asset.hasVideo ? (
              <span className="drag-handle" draggable title="Drag Video Only" onDragStart={(e) => setDragPayload(e, asset, true, false)}>{Icon.dragVideo}</span>
            ) : null}
            {asset.hasAudio ? (
              <span className="drag-handle" draggable title="Drag Audio Only" onDragStart={(e) => setDragPayload(e, asset, false, true)}>{Icon.dragAudio}</span>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="monitor-infobar">
        <TimecodeField time={time} fps={fps} max={dur} onChange={(t) => transport.goTo("source", t)} onScrubStart={() => usePlayback.getState().set({ scrubbing: true })} onScrubEnd={() => usePlayback.getState().set({ scrubbing: false })} title="Playhead Position" />
        <ZoomSelect value={zoom} onChange={(z) => useMonitorUI.getState().set({ sourceZoom: z })} />
        <span className="spacer" />
        <ResolutionSelect />
        <button className="mb" title="Settings" onClick={settingsMenu}>{Icon.wrench}</button>
        <span className="tc dim" title="In/Out Duration">{formatTimecode(Math.max(0, shownDur), fps)}</span>
      </div>
      <MiniRuler
        duration={dur}
        time={time}
        fps={fps}
        inPoint={inP}
        outPoint={outP}
        markers={asset?.markers}
        numbers={numbers}
        onSeek={(t) => transport.setTime("source", t)}
        onScrub={(on) => {
          if (on && usePlayback.getState().playing) transport.stop();
          usePlayback.getState().set({ scrubbing: on });
        }}
      />
      <ButtonBar buttons={buttons} ids={ids} defaults={DEFAULT_SOURCE_BUTTONS} onChange={(next) => useMonitorUI.getState().set({ sourceButtons: next })} />
    </div>
  );
}
