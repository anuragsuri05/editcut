// Timeline dialogs (Speed/Duration, Audio Gain, Add/Delete Tracks, Marker,
// Rename, Nest, Frame Hold, Paste/Remove Attributes, …).
import { useMemo, useState, type ReactNode } from "react";
import { Link2, Link2Off } from "lucide-react";
import type { Clip, ID, LabelColor, Marker, MarkerColor, TrackKind, TransitionType } from "@shared/types";
import { LABEL_COLORS } from "@shared/types";
import {
  addTrack, clipEnd, clipsOnTrack, closeAllGaps, deleteTrack, getClip, getTrack, nestClips, renumberTracks, setClipSpeed,
  tracksOfKind, trimClip,
} from "@shared/ops";
import { formatTimecode, parseTimecode, snapToFrame } from "@shared/time";
import { TRANSITION_MAP } from "@shared/effects";
import { registerDialog } from "../../ui/dialogs";
import { Button, Checkbox, Dialog, Select, TextInput } from "../../ui/kit";
import { editor, getActiveSequence, useEditor } from "../../store/store";
import { plain, makeHold, pasteAttributes, removeAttributes, type AttrChoice } from "./ops-extra";
import { getClipboard, tl } from "./state";
import { getPeaks, loadPeaks, peakInRange } from "./waveform";
import { activateSequence } from "./editing";
import { uid } from "@shared/factory";
import { playback } from "../../store/playback";

type P = { onClose: () => void };

export const MARKER_COLORS: Record<MarkerColor, string> = {
  green: "#3fae4a", red: "#e5484d", purple: "#a35bd6", orange: "#e8962c", yellow: "#e2d43c", white: "#e8e8e8", blue: "#2d8ceb", cyan: "#1dbfd0",
};

function selectedClips(): Clip[] {
  const seq = getActiveSequence();
  if (!seq) return [];
  const ids = editor().selection.clipIds;
  return seq.clips.filter((c) => ids.includes(c.id));
}

/** Timecode text field: shows HH:MM:SS:FF, accepts timecode / frames / +/- offsets. */
export function TimecodeField(props: { value: number; fps: number; onChange: (v: number) => void; width?: number; autoFocus?: boolean }) {
  const [text, setText] = useState<string | null>(null);
  const commit = () => {
    if (text === null) return;
    const v = parseTimeInput(text, props.value, props.fps);
    if (v !== null) props.onChange(Math.max(0, v));
    setText(null);
  };
  return (
    <input
      className="text-input tl-tc-input"
      style={{ width: props.width ?? 110 }}
      autoFocus={props.autoFocus}
      value={text ?? formatTimecode(props.value, props.fps)}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") commit();
        if (e.key === "Escape") setText(null);
      }}
    />
  );
}

/** Parse timecode, plain frames/digits, or "+15" / "-1:00" offsets relative to `current`. */
export function parseTimeInput(s: string, current: number, fps: number): number | null {
  s = s.trim();
  const m = /^([+-])\s*(.+)$/.exec(s);
  if (m) {
    const body = m[2];
    let off: number | null;
    if (/^\d+$/.test(body)) off = parseInt(body, 10) / Math.round(fps); // "+15" = 15 frames
    else off = parseTimecode(body, fps);
    if (off === null) return null;
    return snapToFrame(current + (m[1] === "+" ? off : -off), fps);
  }
  const v = parseTimecode(s, fps);
  return v === null ? null : snapToFrame(v, fps);
}

function Footer(props: { onClose: () => void; onOk: () => void; okLabel?: string; extra?: ReactNode }) {
  return (
    <>
      {props.extra}
      <span className="spacer" />
      <Button onClick={props.onClose}>Cancel</Button>
      <Button primary onClick={props.onOk}>{props.okLabel ?? "OK"}</Button>
    </>
  );
}

// ---------------------------------------------------------------- Speed/Duration
function SpeedDurationDialog({ onClose }: P) {
  const seq = getActiveSequence();
  const clips = selectedClips();
  const first = clips[0];
  const fps = seq?.settings.fps ?? 30;
  const [speed, setSpeed] = useState(first ? +(first.speed * 100).toFixed(2) : 100);
  const [duration, setDuration] = useState(first?.duration ?? 0);
  const [linked, setLinked] = useState(true);
  const [reverse, setReverse] = useState(first?.reversed ?? false);
  const [pitch, setPitch] = useState(first?.maintainPitch ?? true);
  const [ripple, setRipple] = useState(false);
  const [interp, setInterp] = useState<NonNullable<Clip["timeInterpolation"]>>(first?.timeInterpolation ?? "frameSampling");
  if (!seq || !first) {
    return (
      <Dialog title="Clip Speed / Duration" onClose={onClose} footer={<Button onClick={onClose}>Close</Button>}>
        <p className="muted">Select one or more clips in the timeline first.</p>
      </Dialog>
    );
  }
  const srcDur = first.duration * first.speed;
  const onSpeed = (v: number) => {
    setSpeed(v);
    if (linked && v > 0) setDuration(snapToFrame(srcDur / (v / 100), fps));
  };
  const onDuration = (v: number) => {
    setDuration(v);
    if (linked && v > 0) setSpeed(+((srcDur / v) * 100).toFixed(2));
  };
  const ok = () => {
    const ids = clips.map((c) => c.id);
    useEditor.getState().applySeq("Speed/Duration", (s, project) => {
      const sorted = ids.map((id) => getClip(s, id)!).filter(Boolean).sort((a, b) => a.start - b.start);
      for (const c of sorted) {
        c.timeInterpolation = interp;
        if (linked || Math.abs(speed / 100 - c.speed) > 1e-9) {
          setClipSpeed(project, s, c.id, Math.max(0.0001, speed / 100), { ripple, reverse, maintainPitch: pitch });
        } else {
          c.reversed = reverse;
          c.maintainPitch = pitch;
        }
        if (!linked && c === sorted[0] && Math.abs(duration - c.duration) > 1e-6) trimClip(project, s, c.id, "out", duration - c.duration, ripple ? "ripple" : "normal");
      }
    });
    onClose();
  };
  return (
    <Dialog title="Clip Speed / Duration" onClose={onClose} width={420} footer={<Footer onClose={onClose} onOk={ok} />}>
      <div className="tl-speed-grid">
        <label>Speed:</label>
        <div className="row" style={{ gap: 6 }}>
          <input className="text-input" style={{ width: 80 }} type="number" step={1} min={0.01} max={10000} value={speed}
            onChange={(e) => onSpeed(parseFloat(e.target.value) || 0)} onKeyDown={(e) => e.stopPropagation()} />
          <span className="muted">%</span>
        </div>
        <button className={"icon-btn tl-chain" + (linked ? " active" : "")} title={linked ? "Speed and Duration are linked" : "Speed and Duration are unlinked"} onClick={() => setLinked(!linked)}>
          {linked ? <Link2 size={16} /> : <Link2Off size={16} />}
        </button>
        <label>Duration:</label>
        <TimecodeField value={duration} fps={fps} onChange={onDuration} />
        <span />
      </div>
      <div className="tl-dialog-checks">
        <Checkbox checked={reverse} onChange={setReverse} label="Reverse Speed" />
        <Checkbox checked={pitch} onChange={setPitch} label="Maintain Audio Pitch" />
        <Checkbox checked={ripple} onChange={setRipple} label="Ripple Edit, Shifting Trailing Clips" />
      </div>
      <div className="form-grid" style={{ marginTop: 10 }}>
        <label>Time Interpolation:</label>
        <Select value={interp} onChange={setInterp} options={[
          { value: "frameSampling", label: "Frame Sampling" }, { value: "frameBlending", label: "Frame Blending" }, { value: "opticalFlow", label: "Optical Flow" },
        ]} />
      </div>
      {clips.length > 1 ? <p className="muted" style={{ marginTop: 8 }}>Applies to {clips.length} selected clips.</p> : null}
    </Dialog>
  );
}

// ---------------------------------------------------------------- Audio Gain
function AudioGainDialog({ onClose }: P) {
  const seq = getActiveSequence();
  const project = useEditor((s) => s.project);
  const clips = selectedClips().filter((c) => seq && getTrack(seq, c.trackId)?.kind === "audio");
  const [mode, setMode] = useState<"set" | "adjust" | "normMax" | "normAll">("adjust");
  const [vals, setVals] = useState({ set: clips[0]?.audio?.volumeDb.value ?? 0, adjust: 0, normMax: 0, normAll: 0 });
  const [, force] = useState(0);
  // peak amplitude of the selection (from waveform peaks), in dBFS incl. current gain
  const peaks = clips.map((c) => {
    const a = c.assetId ? project.media[c.assetId] : undefined;
    if (!a?.waveformUrl) return null;
    const p = getPeaks(a.waveformUrl);
    if (p === undefined) loadPeaks(a.waveformUrl).then(() => force((n) => n + 1));
    if (!p) return null;
    const pk = peakInRange(p, c.sourceIn, c.sourceIn + c.duration * c.speed);
    return pk > 0 ? 20 * Math.log10(pk) : -Infinity;
  });
  const known = peaks.filter((x): x is number => x !== null);
  const peak = known.length ? Math.max(...known) : null;
  const ok = () => {
    const ids = clips.map((c) => c.id);
    useEditor.getState().applySeq("Audio Gain", (s) => {
      ids.forEach((id, i) => {
        const c = getClip(s, id);
        if (!c?.audio) return;
        const v = c.audio.volumeDb;
        const set = (db: number) => {
          const delta = db - v.value;
          v.value = db;
          if (v.keyframes) for (const k of v.keyframes) k.v += delta;
        };
        if (mode === "set") set(vals.set);
        else if (mode === "adjust") set(v.value + vals.adjust);
        else if (mode === "normMax" && peaks[i] !== null && isFinite(peaks[i]!)) set(vals.normMax - peaks[i]!);
        else if (mode === "normAll" && peak !== null && isFinite(peak)) set(v.value + (vals.normAll - (peak + v.value)));
      });
    });
    onClose();
  };
  const row = (m: typeof mode, label: string) => (
    <div className="tl-gain-row">
      <label className="checkbox">
        <input type="radio" checked={mode === m} onChange={() => setMode(m)} /> {label}
      </label>
      <input className="text-input" type="number" step={0.5} style={{ width: 70 }} value={vals[m]} disabled={mode !== m}
        onChange={(e) => setVals({ ...vals, [m]: parseFloat(e.target.value) || 0 })} onKeyDown={(e) => e.stopPropagation()} />
      <span className="muted">dB</span>
    </div>
  );
  return (
    <Dialog title="Audio Gain" onClose={onClose} width={400} footer={<Footer onClose={onClose} onOk={ok} />}>
      {!clips.length ? <p className="muted">Select audio clips in the timeline first.</p> : (
        <>
          {row("set", "Set Gain to:")}
          {row("adjust", "Adjust Gain by:")}
          {row("normMax", "Normalize Max Peak to:")}
          {row("normAll", "Normalize All Peaks to:")}
          <div className="muted" style={{ marginTop: 10 }}>Peak Amplitude: {peak === null ? "analyzing…" : isFinite(peak) ? `${peak.toFixed(1)} dB` : "silent"}</div>
        </>
      )}
    </Dialog>
  );
}

// ---------------------------------------------------------------- Add / Delete Tracks
type Placement = "before" | "afterTarget" | "after";
function AddTracksDialog({ onClose, kind }: P & { kind?: TrackKind }) {
  const [nv, setNv] = useState(kind === "audio" ? 0 : 1);
  const [na, setNa] = useState(kind === "video" ? 0 : kind === "audio" ? 1 : 1);
  const [pv, setPv] = useState<Placement>("after");
  const [pa, setPa] = useState<Placement>("after");
  const [atype, setAtype] = useState("standard");
  const [subs, setSubs] = useState(0);
  const ok = () => {
    useEditor.getState().applySeq("Add Tracks", (s) => {
      const place = (k: TrackKind, n: number, where: Placement) => {
        for (let i = 0; i < n; i++) {
          const tr = addTrack(s, k);
          if (where === "after") continue;
          const list = tracksOfKind(s, k);
          const target = where === "before" ? list[0] : list.filter((t) => t.targeted && t.id !== tr.id).pop() ?? list[0];
          s.tracks.splice(s.tracks.indexOf(tr), 1);
          const at = s.tracks.indexOf(target) + (where === "before" ? 0 : 1);
          s.tracks.splice(at, 0, tr);
          renumberTracks(s);
        }
      };
      place("video", nv, pv);
      place("audio", na, pa);
    });
    if (subs > 0) editor().toast("Audio submix tracks are not supported yet");
    void atype;
    onClose();
  };
  const placementOpts = [
    { value: "before" as Placement, label: "Before First Track" },
    { value: "afterTarget" as Placement, label: "After Target Track" },
    { value: "after" as Placement, label: "After Last Track" },
  ];
  return (
    <Dialog title="Add Tracks" onClose={onClose} width={420} footer={<Footer onClose={onClose} onOk={ok} />}>
      <div className="tl-dialog-group">Video Tracks</div>
      <div className="form-grid">
        <label>Add:</label>
        <input className="text-input" type="number" min={0} max={99} style={{ width: 60 }} value={nv} onChange={(e) => setNv(Math.max(0, parseInt(e.target.value) || 0))} onKeyDown={(e) => e.stopPropagation()} />
        <label>Placement:</label>
        <Select value={pv} onChange={setPv} options={placementOpts} />
      </div>
      <div className="tl-dialog-group">Audio Tracks</div>
      <div className="form-grid">
        <label>Add:</label>
        <input className="text-input" type="number" min={0} max={99} style={{ width: 60 }} value={na} onChange={(e) => setNa(Math.max(0, parseInt(e.target.value) || 0))} onKeyDown={(e) => e.stopPropagation()} />
        <label>Placement:</label>
        <Select value={pa} onChange={setPa} options={placementOpts} />
        <label>Track Type:</label>
        <Select value={atype} onChange={setAtype} options={[{ value: "standard", label: "Standard" }, { value: "mono", label: "Mono" }, { value: "5.1", label: "5.1" }, { value: "adaptive", label: "Adaptive" }]} />
      </div>
      <div className="tl-dialog-group">Audio Submix Tracks</div>
      <div className="form-grid">
        <label>Add:</label>
        <input className="text-input" type="number" min={0} max={9} style={{ width: 60 }} value={subs} onChange={(e) => setSubs(Math.max(0, parseInt(e.target.value) || 0))} onKeyDown={(e) => e.stopPropagation()} />
      </div>
    </Dialog>
  );
}

function DeleteTracksDialog({ onClose }: P) {
  const seq = getActiveSequence();
  const [dv, setDv] = useState(true);
  const [da, setDa] = useState(true);
  const [vSel, setVSel] = useState("empty");
  const [aSel, setASel] = useState("empty");
  if (!seq) return null;
  const opts = (k: TrackKind) => [{ value: "empty", label: "All Empty Tracks" }, ...tracksOfKind(seq, k).map((t) => ({ value: t.id, label: t.name }))];
  const ok = () => {
    useEditor.getState().applySeq("Delete Tracks", (s) => {
      const doKind = (k: TrackKind, sel: string) => {
        const list = tracksOfKind(s, k);
        const victims = sel === "empty" ? list.filter((t) => !s.clips.some((c) => c.trackId === t.id)) : list.filter((t) => t.id === sel);
        for (const t of victims) if (tracksOfKind(s, k).length > 1) deleteTrack(s, t.id);
      };
      if (dv) doKind("video", vSel);
      if (da) doKind("audio", aSel);
    });
    onClose();
  };
  return (
    <Dialog title="Delete Tracks" onClose={onClose} width={400} footer={<Footer onClose={onClose} onOk={ok} />}>
      <Checkbox checked={dv} onChange={setDv} label="Delete Video Tracks" />
      <div style={{ margin: "6px 0 12px 24px" }}><Select value={vSel} onChange={setVSel} options={opts("video")} disabled={!dv} /></div>
      <Checkbox checked={da} onChange={setDa} label="Delete Audio Tracks" />
      <div style={{ margin: "6px 0 0 24px" }}><Select value={aSel} onChange={setASel} options={opts("audio")} disabled={!da} /></div>
    </Dialog>
  );
}

// ---------------------------------------------------------------- Marker
function MarkerDialog({ onClose, markerId, clipId, preset }: P & { markerId?: ID; clipId?: ID; preset?: Partial<Marker> }) {
  const seq = getActiveSequence();
  const owner = clipId && seq ? getClip(seq, clipId) : null;
  const list = owner ? owner.markers : seq?.markers ?? [];
  const existing = list.find((m) => m.id === markerId);
  const fps = seq?.settings.fps ?? 30;
  const [m, setM] = useState<Marker>(() => existing ? plain(existing) : { id: uid("mk_"), time: snapToFrame(playback().time - (owner?.start ?? 0), fps), duration: 0, name: "", comment: "", color: "green", type: "comment", ...preset });
  if (!seq) return null;
  const ok = () => {
    useEditor.getState().applySeq(existing ? "Edit Marker" : "Add Marker", (s) => {
      const target = clipId ? getClip(s, clipId)?.markers : s.markers;
      if (!target) return;
      const i = target.findIndex((x) => x.id === m.id);
      if (i >= 0) target[i] = m;
      else target.push(m);
      target.sort((a, b) => a.time - b.time);
    });
    onClose();
  };
  const del = () => {
    useEditor.getState().applySeq("Delete Marker", (s) => {
      if (clipId) {
        const c = getClip(s, clipId);
        if (c) c.markers = c.markers.filter((x) => x.id !== m.id);
      } else s.markers = s.markers.filter((x) => x.id !== m.id);
    });
    onClose();
  };
  const offset = owner?.start ?? 0;
  return (
    <Dialog title={owner ? "Clip Marker" : "Marker"} onClose={onClose} width={460}
      footer={<Footer onClose={onClose} onOk={ok} extra={existing ? <Button onClick={del}>Delete</Button> : null} />}>
      <div className="form-grid">
        <label>Name:</label>
        <TextInput value={m.name} onChange={(name) => setM({ ...m, name })} autoFocus onEnter={ok} />
        <label>In:</label>
        <TimecodeField value={m.time + offset} fps={fps} onChange={(v) => setM({ ...m, time: v - offset })} />
        <label>Duration:</label>
        <TimecodeField value={m.duration} fps={fps} onChange={(duration) => setM({ ...m, duration })} />
        <label>Comments:</label>
        <textarea className="text-input" rows={3} value={m.comment} onChange={(e) => setM({ ...m, comment: e.target.value })} onKeyDown={(e) => e.stopPropagation()} />
        <label>Marker Color:</label>
        <div className="row" style={{ gap: 6 }}>
          {(Object.keys(MARKER_COLORS) as MarkerColor[]).map((c) => (
            <button key={c} title={c} className={"tl-swatch" + (m.color === c ? " active" : "")} style={{ background: MARKER_COLORS[c] }} onClick={() => setM({ ...m, color: c })} />
          ))}
        </div>
        <label>Marker Options:</label>
        <div className="tl-dialog-checks">
          {([["comment", "Comment Marker"], ["chapter", "Chapter Marker"], ["segmentation", "Segmentation Marker"], ["webLink", "Web Link"]] as const).map(([v, l]) => (
            <label key={v} className="checkbox"><input type="radio" checked={m.type === v} onChange={() => setM({ ...m, type: v })} /> {l}</label>
          ))}
        </div>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------- Rename / Nest / Find
function RenameClipDialog({ onClose, clipId }: P & { clipId?: ID }) {
  const seq = getActiveSequence();
  const clip = seq && (clipId ? getClip(seq, clipId) : selectedClips()[0]);
  const [name, setName] = useState(clip?.name ?? "");
  if (!clip) return null;
  const ok = () => {
    useEditor.getState().applySeq("Rename", (s) => {
      const c = getClip(s, clip.id);
      if (c) c.name = name;
    });
    onClose();
  };
  return (
    <Dialog title="Rename Clip" onClose={onClose} width={380} footer={<Footer onClose={onClose} onOk={ok} />}>
      <div className="form-grid"><label>Clip Name:</label><TextInput value={name} onChange={setName} autoFocus onEnter={ok} /></div>
    </Dialog>
  );
}

function NestDialog({ onClose }: P) {
  const project = useEditor((s) => s.project);
  const n = Object.values(project.sequences).filter((s) => /^Nested Sequence/.test(s.name)).length + 1;
  const [name, setName] = useState(`Nested Sequence ${String(n).padStart(2, "0")}`);
  const ok = () => {
    const ids = editor().selection.clipIds;
    const seqId = project.activeSequenceId;
    if (!seqId || !ids.length) return onClose();
    editor().apply("Nest", (d) => {
      nestClips(d, seqId, ids, name);
    });
    editor().select({ clipIds: [] });
    onClose();
  };
  return (
    <Dialog title="Nested Sequence Name" onClose={onClose} width={380} footer={<Footer onClose={onClose} onOk={ok} />}>
      <div className="form-grid"><label>Name:</label><TextInput value={name} onChange={setName} autoFocus onEnter={ok} /></div>
    </Dialog>
  );
}

function FindDialog({ onClose }: P) {
  const [q, setQ] = useState("");
  const ok = () => {
    const seq = getActiveSequence();
    if (!seq || !q.trim()) return onClose();
    const hits = seq.clips.filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase()));
    editor().select({ clipIds: hits.map((c) => c.id) });
    if (hits[0]) playback().setTime(hits[0].start);
    editor().toast(hits.length ? `Found ${hits.length} clip${hits.length > 1 ? "s" : ""}` : "No matching clips", hits.length ? "info" : "error");
    onClose();
  };
  return (
    <Dialog title="Find in Timeline" onClose={onClose} width={380} footer={<Footer onClose={onClose} onOk={ok} okLabel="Find" />}>
      <div className="form-grid"><label>Clip name contains:</label><TextInput value={q} onChange={setQ} autoFocus onEnter={ok} /></div>
    </Dialog>
  );
}

// ---------------------------------------------------------------- Frame Hold Options
function FrameHoldDialog({ onClose }: P) {
  const seq = getActiveSequence();
  const clip = selectedClips().find((c) => seq && getTrack(seq, c.trackId)?.kind === "video");
  const [on, setOn] = useState(true);
  const [where, setWhere] = useState<"in" | "out" | "playhead" | "marker">("in");
  const [filters, setFilters] = useState(false);
  if (!seq || !clip) {
    return (
      <Dialog title="Frame Hold Options" onClose={onClose} footer={<Button onClick={onClose}>Close</Button>}>
        <p className="muted">Select a video clip first.</p>
      </Dialog>
    );
  }
  const ok = () => {
    if (on) {
      const fps = seq.settings.fps;
      const t = playback().time;
      useEditor.getState().applySeq("Frame Hold Options", (s) => {
        const c = getClip(s, clip.id);
        if (!c) return;
        const srcEnd = c.sourceIn + c.duration * c.speed;
        let src = c.sourceIn;
        if (where === "out") src = Math.max(c.sourceIn, srcEnd - 1 / fps);
        else if (where === "playhead") src = c.sourceIn + Math.min(Math.max(t - c.start, 0), c.duration) * c.speed;
        else if (where === "marker" && c.markers[0]) src = c.sourceIn + c.markers[0].time * c.speed;
        makeHold(c, src, fps);
        if (filters) for (const e of c.effects) for (const p of Object.values(e.params)) if (p.keyframes?.length) p.keyframes = undefined;
      });
    }
    onClose();
  };
  return (
    <Dialog title="Frame Hold Options" onClose={onClose} width={400} footer={<Footer onClose={onClose} onOk={ok} />}>
      <div className="row" style={{ gap: 10 }}>
        <Checkbox checked={on} onChange={setOn} label="Hold On" />
        <Select value={where} onChange={setWhere} disabled={!on} options={[
          { value: "in", label: "In Point" }, { value: "out", label: "Out Point" }, { value: "playhead", label: "Sequence Timecode (Playhead)" }, { value: "marker", label: "Marker 0" },
        ]} />
      </div>
      <div className="tl-dialog-checks" style={{ marginTop: 10 }}>
        <Checkbox checked={filters} onChange={setFilters} label="Hold Filters" />
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------- Paste / Remove Attributes
function AttributesDialog({ onClose, remove }: P & { remove?: boolean }) {
  const [c, setC] = useState<AttrChoice>({ motion: true, opacity: true, timeRemap: false, volume: true, effects: true });
  const src = getClipboard()?.clips[0];
  const ok = () => {
    const ids = editor().selection.clipIds;
    if (!ids.length) return onClose();
    useEditor.getState().applySeq(remove ? "Remove Attributes" : "Paste Attributes", (s, project) => {
      if (remove) removeAttributes(s, ids, c);
      else if (src) pasteAttributes(s, src, ids, c, project);
    });
    onClose();
  };
  const cb = (k: keyof AttrChoice, label: string) => <Checkbox checked={c[k]} onChange={(v) => setC({ ...c, [k]: v })} label={label} />;
  return (
    <Dialog title={remove ? "Remove Attributes" : `Paste Attributes${src ? ` from "${src.name}"` : ""}`} onClose={onClose} width={360} footer={<Footer onClose={onClose} onOk={ok} />}>
      {!remove && !src ? <p className="muted">Copy a clip first (Edit &gt; Copy).</p> : null}
      <div className="tl-dialog-group">Video Attributes</div>
      <div className="tl-dialog-checks">{cb("motion", "Motion")}{cb("opacity", "Opacity")}{cb("timeRemap", "Time Remapping / Speed")}</div>
      <div className="tl-dialog-group">Audio Attributes</div>
      <div className="tl-dialog-checks">{cb("volume", "Volume / Panner")}</div>
      <div className="tl-dialog-group">Effects</div>
      <div className="tl-dialog-checks">{cb("effects", remove ? "All applied effects" : "Effects")}</div>
    </Dialog>
  );
}

// ---------------------------------------------------------------- Transition Duration
function TransitionDurationDialog({ onClose, transitionId }: P & { transitionId?: ID }) {
  const seq = getActiveSequence();
  const tr = seq?.transitions.find((t) => t.id === (transitionId ?? editor().selection.transitionId));
  const fps = seq?.settings.fps ?? 30;
  const [dur, setDur] = useState(tr?.duration ?? 1);
  const [align, setAlign] = useState(tr?.alignment ?? "center");
  if (!tr) return null;
  const ok = () => {
    useEditor.getState().applySeq("Transition Duration", (s) => {
      const t = s.transitions.find((x) => x.id === tr.id);
      if (t) {
        t.duration = Math.max(1 / fps, dur);
        if (t.clipAId && t.clipBId) t.alignment = align;
      }
    });
    onClose();
  };
  return (
    <Dialog title={`${TRANSITION_MAP[tr.type]?.name ?? "Transition"} Duration`} onClose={onClose} width={380} footer={<Footer onClose={onClose} onOk={ok} />}>
      <div className="form-grid">
        <label>Duration:</label>
        <TimecodeField value={dur} fps={fps} onChange={setDur} autoFocus />
        <label>Alignment:</label>
        <Select value={align} onChange={setAlign} disabled={!(tr.clipAId && tr.clipBId)} options={[
          { value: "center", label: "Center at Cut" }, { value: "start", label: "Start at Cut" }, { value: "end", label: "End at Cut" },
        ]} />
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------- Audio Channels / Label / Simplify / Properties
function AudioChannelsDialog({ onClose }: P) {
  const seq = getActiveSequence();
  const clips = selectedClips().filter((c) => seq && getTrack(seq, c.trackId)?.kind === "audio");
  const [ch, setCh] = useState(String(clips[0]?.audioChannel ?? "stereo"));
  const ok = () => {
    const ids = clips.map((c) => c.id);
    useEditor.getState().applySeq("Modify Audio Channels", (s) => {
      for (const id of ids) {
        const c = getClip(s, id);
        if (c) c.audioChannel = ch === "stereo" ? undefined : parseInt(ch, 10);
      }
    });
    onClose();
  };
  return (
    <Dialog title="Modify Clip — Audio Channels" onClose={onClose} width={400} footer={<Footer onClose={onClose} onOk={ok} />}>
      {!clips.length ? <p className="muted">Select audio clips first.</p> : (
        <div className="form-grid">
          <label>Clip Channel Format:</label>
          <Select value={ch} onChange={setCh} options={[{ value: "stereo", label: "Stereo (all channels)" }, { value: "0", label: "Mono — Channel 1 (Left)" }, { value: "1", label: "Mono — Channel 2 (Right)" }]} />
        </div>
      )}
    </Dialog>
  );
}

function LabelDialog({ onClose }: P) {
  const pick = (l: LabelColor) => {
    const ids = editor().selection.clipIds;
    useEditor.getState().applySeq("Label", (s) => {
      for (const c of s.clips) if (ids.includes(c.id)) c.label = l;
    });
    onClose();
  };
  return (
    <Dialog title="Label" onClose={onClose} width={340} footer={<Button onClick={onClose}>Cancel</Button>}>
      <div className="tl-label-grid">
        {(Object.keys(LABEL_COLORS) as LabelColor[]).map((l) => (
          <button key={l} className="tl-label-btn" onClick={() => pick(l)}>
            <span className="tl-swatch" style={{ background: LABEL_COLORS[l] }} /> {l[0].toUpperCase() + l.slice(1)}
          </button>
        ))}
      </div>
    </Dialog>
  );
}

function SimplifyDialog({ onClose }: P) {
  const seq = getActiveSequence();
  const [o, setO] = useState({ disabled: true, emptyTracks: true, gaps: false, markers: true });
  if (!seq) return null;
  const ok = () => {
    let newId: ID | null = null;
    editor().apply("Simplify Sequence", (d) => {
      const src = d.sequences[seq.id];
      const copy = plain(src);
      copy.id = uid("seq_");
      copy.name = `${src.name} (Simplified)`;
      copy.createdAt = Date.now();
      if (o.disabled) copy.clips = copy.clips.filter((c) => c.enabled);
      if (!o.markers) copy.markers = [];
      if (o.emptyTracks) {
        for (const t of [...copy.tracks]) {
          const same = copy.tracks.filter((x) => x.kind === t.kind);
          if (same.length > 1 && !copy.clips.some((c) => c.trackId === t.id)) deleteTrack(copy, t.id);
        }
      }
      if (o.gaps) closeAllGaps(copy);
      d.sequences[copy.id] = copy;
      d.items.push({ id: copy.id, type: "sequence", name: copy.name, parentId: null });
      newId = copy.id;
    });
    if (newId) activateSequence(newId);
    onClose();
  };
  return (
    <Dialog title="Simplify Sequence" onClose={onClose} width={400} footer={<Footer onClose={onClose} onOk={ok} okLabel="Simplify" />}>
      <p className="muted">Creates a simplified copy of “{seq.name}”.</p>
      <div className="tl-dialog-checks">
        <Checkbox checked={o.disabled} onChange={(v) => setO({ ...o, disabled: v })} label="Remove inactive (disabled) clips" />
        <Checkbox checked={o.emptyTracks} onChange={(v) => setO({ ...o, emptyTracks: v })} label="Remove empty tracks" />
        <Checkbox checked={o.gaps} onChange={(v) => setO({ ...o, gaps: v })} label="Close gaps" />
        <Checkbox checked={o.markers} onChange={(v) => setO({ ...o, markers: v })} label="Keep sequence markers" />
      </div>
    </Dialog>
  );
}

function ClipPropertiesDialog({ onClose, clipId }: P & { clipId?: ID }) {
  const seq = getActiveSequence();
  const project = useEditor((s) => s.project);
  const clip = seq && (clipId ? getClip(seq, clipId) : selectedClips()[0]);
  const rows = useMemo(() => {
    if (!seq || !clip) return [];
    const fps = seq.settings.fps;
    const a = clip.assetId ? project.media[clip.assetId] : undefined;
    const r: [string, string][] = [
      ["Name", clip.name], ["Track", getTrack(seq, clip.trackId)?.name ?? ""],
      ["Start", formatTimecode(clip.start, fps)], ["End", formatTimecode(clipEnd(clip), fps)], ["Duration", formatTimecode(clip.duration, fps)],
      ["Source In", formatTimecode(clip.sourceIn, fps)], ["Speed", `${(clip.speed * 100).toFixed(2)}%${clip.reversed ? " (reversed)" : ""}`],
      ["Effects", clip.effects.map((e) => e.type).join(", ") || "None"], ["Enabled", clip.enabled ? "Yes" : "No"],
    ];
    if (a) r.push(["File", a.path], ["Media", `${a.width ?? "?"}x${a.height ?? "?"} ${a.fps ? a.fps + " fps" : ""} ${a.videoCodec ?? ""} ${a.audioCodec ?? ""}`], ["Media Duration", formatTimecode(a.duration, fps)]);
    if (clip.sequenceId) r.push(["Nested Sequence", project.sequences[clip.sequenceId]?.name ?? "(missing)"]);
    if (clip.generator) r.push(["Generator", clip.generator.kind]);
    return r;
  }, [seq, clip, project]);
  if (!clip) return null;
  return (
    <Dialog title="Properties" onClose={onClose} width={520} footer={<Button primary onClick={onClose}>Close</Button>}>
      <div className="form-grid">{rows.map(([k, v]) => [<label key={k}>{k}</label>, <span key={k + "v"} style={{ userSelect: "text", wordBreak: "break-all" }}>{v}</span>])}</div>
    </Dialog>
  );
}

function RenameTrackDialog({ onClose, trackId }: P & { trackId?: ID }) {
  const seq = getActiveSequence();
  const tr = seq && trackId ? getTrack(seq, trackId) : undefined;
  const [name, setName] = useState(tr?.name ?? "");
  if (!tr) return null;
  const ok = () => {
    useEditor.getState().applySeq("Rename Track", (s) => {
      const t = getTrack(s, tr.id);
      if (t && name.trim()) t.name = name.trim();
    });
    onClose();
  };
  return (
    <Dialog title="Rename Track" onClose={onClose} width={340} footer={<Footer onClose={onClose} onOk={ok} />}>
      <div className="form-grid"><label>Track Name:</label><TextInput value={name} onChange={setName} autoFocus onEnter={ok} /></div>
    </Dialog>
  );
}

function SetDefaultTransitionNote(type: TransitionType): void {
  const def = TRANSITION_MAP[type];
  if (!def) return;
  if (def.kind === "audio") tl().set({ defaultAudioTransition: type });
  else tl().set({ defaultVideoTransition: type });
  editor().toast(`Default ${def.kind} transition: ${def.name}`, "success");
}
export const setDefaultTransition = SetDefaultTransitionNote;

/** Clip-level gap check helper used by some dialogs. */
export function hasGapAfter(seqClips: Clip[], c: Clip): boolean {
  const next = seqClips.filter((x) => x.trackId === c.trackId && x.start >= clipEnd(c) - 1e-6).sort((a, b) => a.start - b.start)[0];
  return !next || next.start - clipEnd(c) > 1e-6;
}
void clipsOnTrack;

registerDialog("timeline.speedDuration", SpeedDurationDialog as never);
registerDialog("timeline.audioGain", AudioGainDialog as never);
registerDialog("timeline.addTracks", AddTracksDialog as never);
registerDialog("timeline.deleteTracks", DeleteTracksDialog as never);
registerDialog("timeline.marker", MarkerDialog as never);
registerDialog("timeline.renameClip", RenameClipDialog as never);
registerDialog("timeline.nest", NestDialog as never);
registerDialog("timeline.find", FindDialog as never);
registerDialog("timeline.frameHold", FrameHoldDialog as never);
registerDialog("timeline.pasteAttributes", AttributesDialog as never);
registerDialog("timeline.removeAttributes", ((p: P) => <AttributesDialog {...p} remove />) as never);
registerDialog("timeline.transitionDuration", TransitionDurationDialog as never);
registerDialog("timeline.audioChannels", AudioChannelsDialog as never);
registerDialog("timeline.label", LabelDialog as never);
registerDialog("timeline.simplify", SimplifyDialog as never);
registerDialog("timeline.clipProperties", ClipPropertiesDialog as never);
registerDialog("timeline.renameTrack", RenameTrackDialog as never);
