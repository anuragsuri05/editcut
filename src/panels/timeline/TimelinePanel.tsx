// Timeline panel (Premiere-style): sequence tabs, playhead timecode + toolbar,
// time ruler, track headers, clip lanes (video stacked upward, audio downward),
// overlay (playhead/snap/razor/drop), zoom scroll bar.
import { useEffect, useMemo, useRef, useState } from "react";
import { Bookmark, Captions, Layers, Link, Magnet, Wrench, X } from "lucide-react";
import type { Clip, ID, Sequence, Track, Transition } from "@shared/types";
import { addTrack, clipsOnTrack, sourceTimeAt, tracksOfKind } from "@shared/ops";
import { formatTimecode } from "@shared/time";
import { runCommand } from "../../commands/registry";
import { IconButton, showContextMenu, type ContextMenuItem } from "../../ui/kit";
import { editor, useEditor } from "../../store/store";
import { playback, usePlayback } from "../../store/playback";
import { activateSequence, openSequenceTab } from "./editing";
import { onDragLeave, onDragOver, onDrop, setTimelineRoot, timeAt } from "./interact";
import { clipContextMenu } from "./menus";
import { duplicateFrameClips, syncOffsets, throughEdits } from "./ops-extra";
import { setDisplay, tl, useTimeline } from "./state";
import { MixHeader, TrackHeader } from "./TrackHeader";
import { TrackLane } from "./TrackLane";
import { Ruler } from "./Ruler";
import { FloatingLayer, Overlay } from "./Overlay";
import { ZoomBar } from "./ZoomBar";
import { parseTimeInput } from "./dialogs";
import { HEADER_WIDTH, maxPps, MIN_PPS, zoomToFit } from "./view";
import "./timeline.css";

const RULER_H = 36;

// ---------------------------------------------------------------- timecode display

function PlayheadTimecode({ fps }: { fps: number }) {
  const t = usePlayback((s) => s.time);
  const [text, setText] = useState<string | null>(null);
  if (text !== null)
    return (
      <input
        className="tl-timecode editing"
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={() => setText(null)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") {
            const v = parseTimeInput(text, playback().time, fps);
            if (v !== null) playback().setTime(Math.max(0, v));
            setText(null);
          } else if (e.key === "Escape") setText(null);
        }}
      />
    );
  return (
    <div className="tl-timecode" title="Playhead Position — click to type a timecode, or +/- offsets (e.g. +15 frames)" onClick={() => setText(formatTimecode(t, fps))}>
      {formatTimecode(t, fps)}
    </div>
  );
}

// ---------------------------------------------------------------- toolbar

function Toolbar() {
  const snapping = useEditor((s) => s.snapping);
  const linked = useEditor((s) => s.linkedSelection);
  const nest = useTimeline((s) => s.nestSequences);
  const display = useTimeline((s) => s.display);
  const showCaptions = useTimeline((s) => s.showCaptions);
  const wrench = (e: React.MouseEvent) => {
    const t = (label: string, key: keyof typeof display): ContextMenuItem => ({ label, checked: display[key], onClick: () => setDisplay({ [key]: !display[key] }) });
    showContextMenu(e, [
      t("Show Video Thumbnails", "thumbnails"), t("Show Video Keyframes", "keyframes"), t("Show Video Names", "clipNames"), { separator: true },
      t("Show Audio Waveforms", "waveforms"), t("Show Audio Keyframes", "keyframes"), { separator: true },
      t("Show Clip Markers", "clipMarkers"), t("Show Duplicate Frame Markers", "duplicateFrames"), t("Show Through Edits", "throughEdits"), t("Show Effect Badges", "fxBadges"), { separator: true },
      { label: "Minimize All Tracks", onClick: () => runCommand("sequence.minimizeAllTracks") },
      { label: "Expand All Tracks", onClick: () => runCommand("sequence.expandAllTracks") },
    ]);
  };
  const captions = (e: React.MouseEvent) => {
    showContextMenu(e, [
      { label: "Show Caption Tracks", checked: showCaptions, onClick: () => tl().set({ showCaptions: !showCaptions }) },
      { label: "Add New Caption Track", onClick: () => {
        editor().applySeq("Add Caption Track", (s) => void addTrack(s, "caption"));
        tl().set({ showCaptions: true });
      } },
    ]);
  };
  return (
    <div className="tl-toolbar">
      <IconButton size={22} active={nest} title="Insert and overwrite sequences as nests or individual clips" onClick={() => tl().set({ nestSequences: !nest })}><Layers size={14} /></IconButton>
      <IconButton size={22} active={snapping} title="Snap in Timeline (S)" onClick={() => runCommand("sequence.snapping")}><Magnet size={14} /></IconButton>
      <IconButton size={22} active={linked} title="Linked Selection" onClick={() => runCommand("sequence.linkedSelection")}><Link size={14} /></IconButton>
      <IconButton size={22} title="Add Marker (M)" onClick={() => runCommand("markers.addMarker")}><Bookmark size={14} /></IconButton>
      <IconButton size={22} title="Timeline Display Settings" onClick={wrench}><Wrench size={14} /></IconButton>
      <IconButton size={22} active={showCaptions} title="Caption track options" onClick={captions}><Captions size={14} /></IconButton>
    </div>
  );
}

// ---------------------------------------------------------------- tabs

function SequenceTabs() {
  const project = useEditor((s) => s.project);
  const open = useTimeline((s) => s.openSeqIds);
  const active = project.activeSequenceId;
  useEffect(() => {
    if (active) openSequenceTab(active);
  }, [active]);
  useEffect(() => {
    const cur = tl().openSeqIds;
    const valid = cur.filter((id) => project.sequences[id]);
    if (active && project.sequences[active] && !valid.includes(active)) valid.push(active);
    if (valid.length !== cur.length || valid.some((id, i) => id !== cur[i])) tl().set({ openSeqIds: valid });
  }, [project.sequences, open, active]);
  const ids = open.filter((id) => project.sequences[id]);
  if (!ids.length) return <div className="tl-tabs" />;
  return (
    <div className="tl-tabs">
      {ids.map((id) => (
        <div key={id} className={"tl-tab" + (id === active ? " active" : "")} onClick={() => activateSequence(id)}
          onAuxClick={(e) => e.button === 1 && closeTab(id)} title={project.sequences[id].name}>
          <span>{project.sequences[id].name}</span>
          <button className="tl-tab-x" title="Close" onClick={(e) => { e.stopPropagation(); closeTab(id); }}><X size={11} /></button>
        </div>
      ))}
    </div>
  );
}

function closeTab(id: ID): void {
  const open = tl().openSeqIds.filter((x) => x !== id);
  tl().set({ openSeqIds: open });
  if (editor().project.activeSequenceId === id) activateSequence(open[open.length - 1] ?? null);
}

// ---------------------------------------------------------------- empty state

function EmptyTimeline() {
  const drop = useTimeline((s) => s.drop);
  return (
    <div className={"tl-empty" + (drop ? " over" : "")} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
      <div>Drop media here to create a sequence.</div>
    </div>
  );
}

// ---------------------------------------------------------------- main

export default function TimelinePanel() {
  const active = useEditor((s) => (s.project.activeSequenceId ? s.project.sequences[s.project.activeSequenceId] ?? null : null));
  return (
    <div className="tl-root">
      <SequenceTabs />
      {active ? <TimelineBody key={active.id} active={active} /> : <EmptyTimeline />}
      <FloatingLayer />
    </div>
  );
}

function TimelineBody({ active }: { active: Sequence }) {
  const preview = useTimeline((s) => s.preview);
  const seq = preview && preview.id === active.id ? preview : active;
  const media = useEditor((s) => s.project.media);
  const sequences = useEditor((s) => s.project.sequences);
  const selection = useEditor((s) => s.selection);
  const tool = useEditor((s) => s.tool);
  const patchVideo = useEditor((s) => s.patchVideo);
  const patchAudio = useEditor((s) => s.patchAudio);
  const sourceAsset = useEditor((s) => (s.sourceAssetId ? s.project.media[s.sourceAssetId] : undefined));
  const display = useTimeline((s) => s.display);
  const showCaptions = useTimeline((s) => s.showCaptions);
  const rootRef = useRef<HTMLDivElement>(null);
  const rulerRef = useRef<HTMLDivElement>(null);
  const videoPaneRef = useRef<HTMLDivElement>(null);
  const [videoFrac, setVideoFrac] = useState(() => {
    const v = parseFloat(localStorage.getItem("editcut.timeline.split") ?? "");
    return v > 0.1 && v < 0.9 ? v : 0.55;
  });
  const fps = seq.settings.fps;

  useEffect(() => {
    setTimelineRoot(rootRef.current);
    return () => setTimelineRoot(null);
  }, []);

  // measure lane width
  useEffect(() => {
    const el = rulerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => tl().set({ viewWidth: el.clientWidth }));
    ro.observe(el);
    tl().set({ viewWidth: el.clientWidth });
    return () => ro.disconnect();
  }, []);

  // start scrolled so V1 sits at the divider
  useEffect(() => {
    const vp = videoPaneRef.current;
    if (vp) vp.scrollTop = vp.scrollHeight;
  }, [active.id]);

  // wheel: Shift/trackpad-x = horizontal scroll, Alt/Ctrl(pinch) = zoom, Alt over header = track height
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const st = editor();
      const target = e.target as HTMLElement;
      const header = target.closest(".tl-left-col") as HTMLElement | null;
      if (e.altKey && header?.dataset.trackId) {
        e.preventDefault();
        const id = header.dataset.trackId;
        const sid = st.project.activeSequenceId;
        if (sid) st.patch((d) => {
          const t = d.sequences[sid]?.tracks.find((x) => x.id === id);
          if (t) t.height = Math.max(22, Math.min(320, t.height - Math.sign(e.deltaY) * 8));
        });
        return;
      }
      if (target.closest(".tl-left-col, .tl-header")) return;
      if (e.altKey || e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0025));
        const anchorX = e.clientX - (rulerRef.current?.getBoundingClientRect().left ?? 0);
        const t = timeAt(e.clientX);
        const pps = Math.min(maxPps(), Math.max(MIN_PPS, st.pxPerSec * factor));
        st.setUI({ pxPerSec: pps, scrollTime: Math.max(0, t - anchorX / pps) });
        return;
      }
      const horiz = e.shiftKey ? e.deltaY || e.deltaX : Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : 0;
      if (horiz) {
        e.preventDefault();
        st.setUI({ scrollTime: Math.max(0, st.scrollTime + horiz / st.pxPerSec) });
      } else if (target.closest(".tl-ruler, .tl-zoombar")) {
        e.preventDefault();
        st.setUI({ scrollTime: Math.max(0, st.scrollTime + e.deltaY / st.pxPerSec) });
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // derived data (memoized per sequence identity)
  const byTrack = useMemo(() => {
    const m = new Map<ID, Clip[]>();
    for (const t of seq.tracks) m.set(t.id, []);
    for (const c of seq.clips) m.get(c.trackId)?.push(c);
    for (const list of m.values()) list.sort((a, b) => a.start - b.start);
    return m;
  }, [seq.clips, seq.tracks]);
  const trByTrack = useMemo(() => {
    const m = new Map<ID, Transition[]>();
    for (const t of seq.transitions) (m.get(t.trackId) ?? m.set(t.trackId, []).get(t.trackId)!).push(t);
    return m;
  }, [seq.transitions]);
  const offsets = useMemo(() => syncOffsets(seq), [seq]);
  const dups = useMemo(() => (display.duplicateFrames ? duplicateFrameClips(seq) : new Set<ID>()), [seq, display.duplicateFrames]);
  const throughs = useMemo(() => {
    const m = new Map<ID, number[]>();
    if (display.throughEdits) for (const x of throughEdits(seq)) (m.get(x.trackId) ?? m.set(x.trackId, []).get(x.trackId)!).push(x.t);
    return m;
  }, [seq, display.throughEdits]);
  const selected = useMemo(() => new Set(selection.clipIds), [selection.clipIds]);
  const seqIds = useMemo(() => new Set(Object.keys(sequences)), [sequences]);

  const onClipDoubleClick = (clip: Clip) => {
    if (clip.sequenceId && sequences[clip.sequenceId]) {
      activateSequence(clip.sequenceId);
      return;
    }
    if (clip.assetId && media[clip.assetId]) {
      const t = playback().time;
      const inside = t >= clip.start && t < clip.start + clip.duration;
      editor().setUI({ sourceAssetId: clip.assetId, focusedMonitor: "source" });
      playback().setSourceTime(inside ? sourceTimeAt(clip, t) : clip.sourceIn);
    }
  };

  const video = tracksOfKind(seq, "video");
  const audio = tracksOfKind(seq, "audio");
  const caps = showCaptions ? tracksOfKind(seq, "caption") : [];
  const srcHasV = !!sourceAsset?.hasVideo, srcHasA = !!sourceAsset?.hasAudio;

  const row = (t: Track, index: number) => (
    <div key={t.id} className="tl-row" style={{ height: Math.max(22, t.height) }}>
      <div className="tl-left-col" data-track-id={t.id}>
        <TrackHeader
          track={t}
          index={index}
          height={Math.max(22, t.height)}
          patchKind={t.kind === "video" ? (srcHasV ? "video" : null) : t.kind === "audio" ? (srcHasA ? "audio" : null) : null}
          patched={t.kind === "video" ? patchVideo === index : t.kind === "audio" ? patchAudio === index : false}
          patchLabel={t.kind === "video" && patchVideo === index ? "V1" : t.kind === "audio" && patchAudio === index ? "A1" : null}
        />
      </div>
      <TrackLane
        track={t}
        clips={byTrack.get(t.id) ?? []}
        transitions={trByTrack.get(t.id) ?? []}
        height={Math.max(22, t.height)}
        selected={selected}
        media={media}
        sequenceIds={seqIds}
        syncOffsets={offsets}
        duplicates={dups}
        throughEdits={throughs.get(t.id) ?? []}
        fps={fps}
        display={display}
        tool={tool}
        selectedTransitionId={selection.transitionId}
        onClipContextMenu={clipContextMenu}
        onClipDoubleClick={onClipDoubleClick}
      />
    </div>
  );

  return (
    <div className="tl-main" ref={rootRef} style={{ ["--hdr-w" as string]: `${HEADER_WIDTH}px` }}>
      <div className="tl-top">
        <div className="tl-top-left" style={{ width: HEADER_WIDTH }}>
          <PlayheadTimecode fps={fps} />
          <Toolbar />
        </div>
        <div className="tl-ruler-wrap" ref={rulerRef}>
          <Ruler seq={seq} />
        </div>
      </div>
      <div className="tl-body" onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
        <div className="tl-pane video" ref={videoPaneRef} style={{ flexBasis: `${videoFrac * 100}%` }}>
          <div className="tl-pane-inner">
            {caps.slice().reverse().map((t) => row(t, caps.indexOf(t)))}
            {video.slice().reverse().map((t) => row(t, video.indexOf(t)))}
          </div>
        </div>
        <div
          className="tl-divider"
          onPointerDown={(e) => {
            const body = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
            const move = (ev: PointerEvent) => {
              const f = Math.min(0.88, Math.max(0.12, (ev.clientY - body.top) / body.height));
              setVideoFrac(f);
              try {
                localStorage.setItem("editcut.timeline.split", String(f));
              } catch {
                /* ignore */
              }
            };
            const up = () => {
              window.removeEventListener("pointermove", move);
              window.removeEventListener("pointerup", up);
            };
            window.addEventListener("pointermove", move);
            window.addEventListener("pointerup", up);
          }}
        />
        <div className="tl-pane audio">
          {audio.map((t, i) => row(t, i))}
          <div className="tl-row tl-mixrow">
            <div className="tl-left-col"><MixHeader /></div>
            <div className="tl-lane mixlane" />
          </div>
        </div>
      </div>
      <div className="tl-bottom">
        <div style={{ width: HEADER_WIDTH, flex: "none" }} className="tl-bottom-left">
          <button className="tl-fit-btn" title="Zoom to Sequence (\)" onClick={() => zoomToFit(false)}>Fit</button>
        </div>
        <ZoomBar seq={seq} />
      </div>
      <div className="tl-overlay-host" style={{ left: HEADER_WIDTH, top: 0 }}>
        <Overlay inPoint={seq.inPoint} outPoint={seq.outPoint} rulerH={RULER_H} rootRef={rootRef} />
      </div>
    </div>
  );
}

export { clipsOnTrack };
