// Audio Track Mixer + Audio Clip Mixer (Premiere).
import { useState } from "react";
import type { Clip, Sequence, Track } from "@shared/types";
import { EFFECTS } from "@shared/effects";
import { evalParam, isAnimated, setParamAt, toggleAnimation } from "@shared/params";
import { clipAt, getClip, tracksOfKind } from "@shared/ops";
import { useEditor, useActiveSequence } from "../../store/store";
import { usePlayback } from "../../store/playback";
import { Tabs } from "../../ui/kit";
import { commitSeq, liveSeq } from "./liveEdit";
import { formatDb, localTime } from "./model";
import { Knob, Meter, VFader } from "./widgets";
import "./effects.css";

type AutoMode = "Off" | "Read" | "Latch" | "Touch" | "Write";
const autoModes = new Map<string, AutoMode>();
const inserts = new Map<string, string[]>();
const armed = new Set<string>();
const AUDIO_FX = EFFECTS.filter((e) => e.kind === "audio" && e.type !== "essentialSound");

export default function AudioMixerPanel() {
  const seq = useActiveSequence();
  const [view, setView] = useState<"track" | "clip">("track");
  const [showFx, setShowFx] = useState(true);
  if (!seq) return <div className="panel-empty">(no sequence)</div>;
  return (
    <div className="mix">
      <div className="mix-top">
        <Tabs value={view} onChange={setView} tabs={[{ value: "track", label: "Audio Track Mixer" }, { value: "clip", label: "Audio Clip Mixer" }]} />
        <span className="spacer" />
        {view === "track" ? (
          <button className={"mix-tog" + (showFx ? " on" : "")} title="Show/Hide Effects and Sends" onClick={() => setShowFx(!showFx)}>fx ▾</button>
        ) : null}
        <span className="mix-seq muted">{seq.name}</span>
      </div>
      {view === "track" ? <TrackMixer seq={seq} showFx={showFx} /> : <ClipMixer seq={seq} />}
    </div>
  );
}

// ---------------------------------------------------------------- track mixer
function TrackMixer({ seq, showFx }: { seq: Sequence; showFx: boolean }) {
  const tracks = tracksOfKind(seq, "audio");
  const meters = usePlayback((s) => s.trackMeters);
  const master = usePlayback((s) => s.meters);
  const [, force] = useState(0);
  const anySolo = tracks.some((t) => t.solo);

  const setTrack = (id: string, label: string, fn: (t: Track) => void, final = true) => {
    const f = (s: Sequence) => { const t = s.tracks.find((x) => x.id === id); if (t) fn(t); };
    if (final) commitSeq(label, f);
    else liveSeq(f);
  };

  return (
    <div className="mix-strips">
      {tracks.map((t) => {
        const mode = autoModes.get(t.id) ?? "Read";
        const slots = inserts.get(t.id) ?? ["", "", "", "", ""];
        const dimmed = anySolo && !t.solo;
        return (
          <div key={t.id} className={"mix-strip" + (dimmed || t.muted ? " dim" : "")}>
            {showFx ? (
              <div className="mix-inserts" title="Track effect inserts (display only — not rendered yet)">
                {slots.map((v, i) => (
                  <select
                    key={i}
                    className="mix-slot"
                    value={v}
                    onChange={(e) => { const n = [...slots]; n[i] = e.target.value; inserts.set(t.id, n); force((x) => x + 1); }}
                  >
                    <option value="">—</option>
                    {AUDIO_FX.map((f) => <option key={f.type} value={f.type}>{f.name}</option>)}
                  </select>
                ))}
                <div className="mix-send muted">Send: none</div>
              </div>
            ) : null}
            <select className="mix-auto" value={mode} title="Automation mode (Read plays clip keyframes; others are display-only)" onChange={(e) => { autoModes.set(t.id, e.target.value as AutoMode); force((x) => x + 1); }}>
              {(["Off", "Read", "Latch", "Touch", "Write"] as AutoMode[]).map((m) => <option key={m}>{m}</option>)}
            </select>
            <div className="mix-pan">
              <Knob value={t.pan} min={-100} max={100} title="Pan / Balance" defaultValue={0}
                onChange={(v) => setTrack(t.id, "Track Pan", (x) => { x.pan = v; }, false)}
                onCommit={(v) => setTrack(t.id, "Track Pan", (x) => { x.pan = v; })} />
              <span className="mix-panval">{t.pan === 0 ? "0" : t.pan < 0 ? `L${-Math.round(t.pan)}` : `R${Math.round(t.pan)}`}</span>
            </div>
            <div className="mix-msr">
              <button className={"msr m" + (t.muted ? " on" : "")} title="Mute Track" onClick={() => setTrack(t.id, t.muted ? "Unmute Track" : "Mute Track", (x) => { x.muted = !x.muted; })}>M</button>
              <button className={"msr s" + (t.solo ? " on" : "")} title="Solo Track" onClick={() => setTrack(t.id, t.solo ? "Unsolo Track" : "Solo Track", (x) => { x.solo = !x.solo; })}>S</button>
              <button className={"msr r" + (armed.has(t.id) ? " on" : "")} title="Enable track for recording (display only)" onClick={() => { if (armed.has(t.id)) armed.delete(t.id); else armed.add(t.id); force((x) => x + 1); }}>●</button>
            </div>
            <div className="mix-fader-wrap">
              <VFader db={t.volumeDb} onChange={(db) => setTrack(t.id, "Track Volume", (x) => { x.volumeDb = Number.isFinite(db) ? db : -96; }, false)} onCommit={(db) => setTrack(t.id, "Track Volume", (x) => { x.volumeDb = Number.isFinite(db) ? db : -96; })} />
              <Meter db={meters[t.id] ?? -Infinity} />
            </div>
            <div className="mix-db">{formatDb(t.volumeDb)}</div>
            <div className="mix-out muted">Master ▾</div>
            <div className="mix-name">{t.name}</div>
          </div>
        );
      })}
      <div className="mix-strip master">
        {showFx ? <div className="mix-inserts"><div className="mix-send muted">Master inserts</div></div> : null}
        <select className="mix-auto" defaultValue="Read"><option>Read</option></select>
        <div className="mix-pan"><span className="muted">Stereo</span></div>
        <div className="mix-msr" />
        <div className="mix-fader-wrap">
          <VFader db={seq.masterVolumeDb} onChange={(db) => liveSeq((s) => { s.masterVolumeDb = Number.isFinite(db) ? db : -96; })} onCommit={(db) => commitSeq("Master Volume", (s) => { s.masterVolumeDb = Number.isFinite(db) ? db : -96; })} />
          <Meter db={master.left} />
          <Meter db={master.right} />
        </div>
        <div className="mix-db">{formatDb(seq.masterVolumeDb)}</div>
        <div className="mix-out muted">&nbsp;</div>
        <div className="mix-name">Master</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- clip mixer
function ClipMixer({ seq }: { seq: Sequence }) {
  const time = usePlayback((s) => s.time);
  const meters = usePlayback((s) => s.trackMeters);
  const master = usePlayback((s) => s.meters);
  const [writeKf, setWriteKf] = useState<Record<string, boolean>>({});
  const tracks = tracksOfKind(seq, "audio");

  const edit = (clip: Clip, label: string, path: "volumeDb" | "pan", v: number, final: boolean, write: boolean) => {
    const f = (s: Sequence) => {
      const c = getClip(s, clip.id);
      if (!c?.audio) return;
      const p = c.audio[path];
      const lt = localTime(c, usePlayback.getState().time);
      if (write && !isAnimated(p)) toggleAnimation(p, lt);
      setParamAt(p, lt, v);
    };
    if (final) commitSeq(label, f);
    else liveSeq(f);
  };

  return (
    <div className="mix-strips">
      {tracks.map((t) => {
        const c = clipAt(seq, t.id, time);
        const a = c?.audio;
        const lt = c ? localTime(c, time) : 0;
        const vol = a ? evalParam(a.volumeDb, lt) : 0;
        const pan = a ? evalParam(a.pan, lt) : 0;
        const w = !!writeKf[t.id];
        return (
          <div key={t.id} className={"mix-strip" + (c ? "" : " dim")}>
            <div className="mix-clipname" title={c?.name}>{c ? c.name : "(no clip)"}</div>
            <div className="mix-pan">
              <Knob value={pan} min={-100} max={100} title="Clip Balance" defaultValue={0}
                onChange={(v) => c && edit(c, "Clip Balance", "pan", v, false, w)}
                onCommit={(v) => c && edit(c, "Clip Balance", "pan", v, true, w)} />
              <span className="mix-panval">{Math.round(pan)}</span>
            </div>
            <div className="mix-msr">
              <button className={"msr m" + (a?.muted ? " on" : "")} disabled={!c} title="Mute clip" onClick={() => c && useEditor.getState().applySeq("Mute Clip", (s) => { const x = getClip(s, c.id); if (x?.audio) x.audio.muted = !x.audio.muted; })}>M</button>
              <button className={"msr s" + (t.solo ? " on" : "")} title="Solo track" onClick={() => commitSeq("Solo Track", (s) => { const x = s.tracks.find((y) => y.id === t.id); if (x) x.solo = !x.solo; })}>S</button>
              <button className={"msr k" + (w ? " on" : "")} title="Write Keyframes" onClick={() => setWriteKf({ ...writeKf, [t.id]: !w })}>◆</button>
            </div>
            <div className="mix-fader-wrap">
              <VFader db={vol} maxDb={15}
                onChange={(db) => c && edit(c, "Clip Volume", "volumeDb", Number.isFinite(db) ? db : -96, false, w)}
                onCommit={(db) => c && edit(c, "Clip Volume", "volumeDb", Number.isFinite(db) ? db : -96, true, w)} />
              <Meter db={meters[t.id] ?? -Infinity} />
            </div>
            <div className="mix-db">{c ? formatDb(vol) : "—"}</div>
            <div className="mix-name">{t.name}</div>
          </div>
        );
      })}
      <div className="mix-strip master">
        <div className="mix-clipname muted">Master</div>
        <div className="mix-fader-wrap" style={{ marginTop: "auto" }}>
          <Meter db={master.left} />
          <Meter db={master.right} />
        </div>
        <div className="mix-name">Master</div>
      </div>
    </div>
  );
}
