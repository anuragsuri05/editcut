// Project-area dialogs: New Sequence, Sequence Settings, Project Settings,
// New Project, Open Project, Save As / Save a Copy, Project Manager, Link Media,
// media Properties, Automate to Sequence, synthetic items (Color Matte, Bars
// and Tone, Black Video, Adjustment Layer, Transparent Video), Import from Path.
import { useEffect, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import type { Generator, ID, MediaAsset, SequenceSettings } from "@shared/types";
import { SEQUENCE_PRESETS, defaultSequenceSettings, makeGeneratorClip } from "@shared/factory";
import { addTransition, clipEnd, insertSpace, placeAsset, addTrack, tracksOfKind } from "@shared/ops";
import { EPS, formatTimecode, parseTimecode, snapToFrame } from "@shared/time";
import { registerDialog } from "../../ui/dialogs";
import { Button, Checkbox, ColorInput, Dialog, Select, Tabs, TextInput } from "../../ui/kit";
import { useEditor, getActiveSequence } from "../../store/store";
import { usePlayback } from "../../store/playback";
import { openPanel } from "../../dock";
import { api, type ProjectSummary } from "../../api";
import {
  createSequence, importPaths, newProject, nextSequenceName, openProject, recentProjectIds, relinkMedia, renameProject, saveAs, saveCopy, usageCounts, deleteItems, OFFLINE,
} from "../../projectIO";
import { audioInfo, fmtBytes, fmtFps, videoInfo } from "./common";

const ed = () => useEditor.getState();

const FPS_OPTIONS = [23.976, 24, 25, 29.97, 30, 48, 50, 59.94, 60, 120];
const PAR_OPTIONS: { value: string; label: string }[] = [
  { value: "1", label: "Square Pixels (1.0)" },
  { value: "0.9091", label: "D1/DV NTSC (0.9091)" },
  { value: "1.2121", label: "D1/DV NTSC Widescreen 16:9 (1.2121)" },
  { value: "1.094", label: "D1/DV PAL (1.0940)" },
  { value: "1.4587", label: "D1/DV PAL Widescreen 16:9 (1.4587)" },
  { value: "1.333", label: "HD Anamorphic 1080 (1.333)" },
  { value: "2", label: "Anamorphic 2:1 (2.0)" },
];
const SAMPLE_RATES = [32000, 44100, 48000, 88200, 96000];

function NumField(props: { value: number; onChange: (v: number) => void; min?: number; max?: number; width?: number; step?: number }) {
  const [text, setText] = useState(String(props.value));
  useEffect(() => setText(String(props.value)), [props.value]);
  return (
    <input
      className="text-input"
      style={{ width: props.width ?? 70 }}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => e.stopPropagation()}
      onBlur={() => {
        const n = parseFloat(text);
        if (Number.isFinite(n)) props.onChange(Math.min(props.max ?? Infinity, Math.max(props.min ?? -Infinity, n)));
        else setText(String(props.value));
      }}
    />
  );
}

function describeSettings(s: SequenceSettings, v: number, a: number): string {
  return [
    `Editing mode: Custom`,
    `Timebase: ${s.fps} frames/second`,
    ``,
    `Video Settings`,
    `Frame size: ${s.width}h ${s.height}v (${s.pixelAspect})`,
    `Frame rate: ${s.fps} frames/second`,
    `Pixel Aspect Ratio: ${PAR_OPTIONS.find((p) => +p.value === s.pixelAspect)?.label ?? s.pixelAspect}`,
    `Fields: No Fields (Progressive Scan)`,
    ``,
    `Default Sequence`,
    `Total video tracks: ${v}`,
    `Master track type: Stereo`,
    `Audio Tracks: ${a} (Standard)`,
    `Sample rate: ${s.sampleRate} samples/second`,
  ].join("\n");
}

// ---------------------------------------------------------------- sequence settings form

function SettingsForm(props: { s: SequenceSettings; set: (p: Partial<SequenceSettings>) => void; tracks?: { v: number; a: number; set: (v: number, a: number) => void } }) {
  const { s, set } = props;
  const dims: [number, number][] = [[1920, 1080], [1280, 720], [3840, 2160], [4096, 2160], [2560, 1440], [1080, 1920], [1080, 1080], [1080, 1350], [720, 480]];
  return (
    <>
      <fieldset className="fieldset">
        <legend>Video</legend>
        <div className="form-grid">
          <label>Frame Size</label>
          <div className="row" style={{ gap: 6 }}>
            <NumField value={s.width} min={16} max={8192} onChange={(w) => set({ width: Math.round(w / 2) * 2 })} />
            <span className="muted">horizontal</span>
            <NumField value={s.height} min={16} max={8192} onChange={(h) => set({ height: Math.round(h / 2) * 2 })} />
            <span className="muted">vertical</span>
            <Select
              value=""
              options={[{ value: "", label: "Presets…" }, ...dims.map(([w, h]) => ({ value: `${w}x${h}`, label: `${w} × ${h}` }))]}
              onChange={(v) => {
                const [w, h] = v.split("x").map(Number);
                if (w) set({ width: w, height: h });
              }}
            />
          </div>
          <label>Timebase</label>
          <Select value={String(s.fps)} options={FPS_OPTIONS.map((f) => ({ value: String(f), label: `${f} frames/second` }))} onChange={(v) => set({ fps: +v })} />
          <label>Pixel Aspect Ratio</label>
          <Select value={String(s.pixelAspect)} options={PAR_OPTIONS.some((p) => +p.value === s.pixelAspect) ? PAR_OPTIONS : [{ value: String(s.pixelAspect), label: String(s.pixelAspect) }, ...PAR_OPTIONS]} onChange={(v) => set({ pixelAspect: +v })} />
          <label>Fields</label>
          <Select value="progressive" options={[{ value: "progressive", label: "No Fields (Progressive Scan)" }]} onChange={() => {}} />
          <label>Display Format</label>
          <Select value="tc" options={[{ value: "tc", label: s.fps === 29.97 || s.fps === 59.94 ? `${s.fps} fps Drop-Frame Timecode` : `${s.fps} fps Timecode` }]} onChange={() => {}} />
          <label>Background</label>
          <ColorInput value={s.backgroundColor} onChange={(c) => set({ backgroundColor: c })} />
        </div>
      </fieldset>
      <fieldset className="fieldset">
        <legend>Audio</legend>
        <div className="form-grid">
          <label>Sample Rate</label>
          <Select value={String(s.sampleRate)} options={SAMPLE_RATES.map((r) => ({ value: String(r), label: `${r} Hz` }))} onChange={(v) => set({ sampleRate: +v })} />
          <label>Display Format</label>
          <Select value="samples" options={[{ value: "samples", label: "Audio Samples" }]} onChange={() => {}} />
        </div>
      </fieldset>
      {props.tracks ? (
        <fieldset className="fieldset">
          <legend>Tracks</legend>
          <div className="form-grid">
            <label>Video</label>
            <div className="row">
              <NumField value={props.tracks.v} min={1} max={99} width={50} onChange={(v) => props.tracks!.set(Math.round(v), props.tracks!.a)} /> <span className="muted">tracks</span>
            </div>
            <label>Audio</label>
            <div className="row">
              <NumField value={props.tracks.a} min={0} max={99} width={50} onChange={(a) => props.tracks!.set(props.tracks!.v, Math.round(a))} /> <span className="muted">tracks (Standard)</span>
            </div>
            <label>Mix</label>
            <span>Stereo</span>
          </div>
        </fieldset>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------- New Sequence

const LAST_PRESET_KEY = "editcut.lastSequencePreset";

function NewSequenceDialog(props: { onClose: () => void; binId?: ID | null }) {
  const [tab, setTab] = useState<"presets" | "settings" | "tracks">("presets");
  const [presetId, setPresetId] = useState<string>(() => localStorage.getItem(LAST_PRESET_KEY) ?? "hd1080p30");
  const preset = SEQUENCE_PRESETS.find((p) => p.id === presetId);
  const [settings, setSettings] = useState<SequenceSettings>(() => defaultSequenceSettings(preset?.settings));
  const [tracks, setTracks] = useState({ v: 3, a: 3 });
  const [name, setName] = useState(() => nextSequenceName());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const groups = useMemo(() => [...new Set(SEQUENCE_PRESETS.map((p) => p.group))], []);

  const choose = (id: string) => {
    setPresetId(id);
    const p = SEQUENCE_PRESETS.find((x) => x.id === id);
    if (p) setSettings(defaultSequenceSettings(p.settings));
  };
  const ok = () => {
    try {
      localStorage.setItem(LAST_PRESET_KEY, presetId);
    } catch {
      /* ignore */
    }
    createSequence(name.trim() || nextSequenceName(), settings, { video: tracks.v, audio: tracks.a }, props.binId);
    openPanel("timeline");
    props.onClose();
  };
  const custom = preset && (settings.width !== (preset.settings.width ?? 1920) || settings.height !== (preset.settings.height ?? 1080) || settings.fps !== (preset.settings.fps ?? 30));

  return (
    <Dialog
      title="New Sequence"
      onClose={props.onClose}
      width={720}
      footer={
        <>
          <Button onClick={props.onClose}>Cancel</Button>
          <Button primary onClick={ok}>OK</Button>
        </>
      }
    >
      <Tabs
        value={tab}
        tabs={[
          { value: "presets", label: "Sequence Presets" },
          { value: "settings", label: "Settings" },
          { value: "tracks", label: "Tracks" },
        ]}
        onChange={setTab}
      />
      <div style={{ paddingTop: 10 }}>
        {tab === "presets" ? (
          <div className="ns-layout">
            <div className="ns-presets">
              {groups.map((g) => (
                <div key={g}>
                  <div className="ns-group" onClick={() => setCollapsed((c) => { const n = new Set(c); if (n.has(g)) n.delete(g); else n.add(g); return n; })}>
                    <ChevronRight size={12} style={{ transform: collapsed.has(g) ? "none" : "rotate(90deg)" }} /> {g}
                  </div>
                  {collapsed.has(g)
                    ? null
                    : SEQUENCE_PRESETS.filter((p) => p.group === g).map((p) => (
                        <div key={p.id} className={"ns-preset" + (p.id === presetId ? " active" : "")} onClick={() => choose(p.id)} onDoubleClick={() => { choose(p.id); }}>
                          {p.name}
                        </div>
                      ))}
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Description</div>
              <div className="ns-desc">
                {preset ? `${preset.name}${custom ? " (modified)" : ""}\n\n` : ""}
                {describeSettings(settings, tracks.v, tracks.a)}
              </div>
            </div>
          </div>
        ) : tab === "settings" ? (
          <SettingsForm s={settings} set={(p) => setSettings((s) => ({ ...s, ...p }))} />
        ) : (
          <SettingsForm s={settings} set={(p) => setSettings((s) => ({ ...s, ...p }))} tracks={{ ...tracks, set: (v, a) => setTracks({ v, a }) }} />
        )}
      </div>
      <div className="form-grid" style={{ marginTop: 12 }}>
        <label>Sequence Name</label>
        <TextInput value={name} onChange={setName} onEnter={ok} autoFocus />
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------- Sequence Settings

function SequenceSettingsDialog(props: { onClose: () => void; id?: ID }) {
  const seqId = props.id ?? ed().project.activeSequenceId;
  const seq = useEditor((s) => (seqId ? s.project.sequences[seqId] : undefined));
  const [settings, setSettings] = useState<SequenceSettings | null>(seq ? { ...seq.settings } : null);
  const [name, setName] = useState(seq?.name ?? "");
  if (!seq || !settings) {
    return (
      <Dialog title="Sequence Settings" onClose={props.onClose} footer={<Button onClick={props.onClose}>Close</Button>}>
        <p className="muted">No sequence is open. Create one with File › New › Sequence.</p>
      </Dialog>
    );
  }
  const ok = () => {
    const changedFps = settings.fps !== seq.settings.fps;
    ed().apply("Sequence Settings", (d) => {
      const s = d.sequences[seq.id];
      if (!s) return;
      Object.assign(s.settings, settings);
      if (name.trim()) {
        s.name = name.trim();
        const it = d.items.find((i) => i.id === seq.id);
        if (it) it.name = s.name;
      }
      if (changedFps) {
        // Keep edits on the new frame grid.
        for (const c of s.clips) {
          const end = snapToFrame(c.start + c.duration, settings.fps);
          c.start = snapToFrame(c.start, settings.fps);
          c.duration = Math.max(1 / settings.fps, end - c.start);
        }
      }
    });
    props.onClose();
  };
  return (
    <Dialog
      title="Sequence Settings"
      onClose={props.onClose}
      width={600}
      footer={
        <>
          <Button onClick={props.onClose}>Cancel</Button>
          <Button primary onClick={ok}>OK</Button>
        </>
      }
    >
      <div className="form-grid" style={{ marginBottom: 10 }}>
        <label>Sequence Name</label>
        <TextInput value={name} onChange={setName} onEnter={ok} />
        <label>Editing Mode</label>
        <span>Custom</span>
      </div>
      <SettingsForm s={settings} set={(p) => setSettings((s) => ({ ...s!, ...p }))} />
      <p className="muted small">
        {tracksOfKind(seq, "video").length} video tracks, {tracksOfKind(seq, "audio").length} audio tracks. Add or delete tracks from the Timeline (Sequence › Add Tracks).
      </p>
    </Dialog>
  );
}

// ---------------------------------------------------------------- Project Settings

function ProjectSettingsDialog(props: { onClose: () => void }) {
  const project = useEditor((s) => s.project);
  const proxies = useEditor((s) => s.proxiesEnabled);
  const [name, setName] = useState(project.name);
  const [dataDir, setDataDir] = useState("");
  const [tab, setTab] = useState<"general" | "scratch" | "ingest">("general");
  useEffect(() => {
    api.getSettings().then((s) => setDataDir(s.dataDirectory)).catch(() => setDataDir("(server unavailable)"));
  }, []);
  const media = Object.values(project.media);
  const ok = () => {
    if (name.trim() && name.trim() !== project.name) renameProject(name);
    props.onClose();
  };
  return (
    <Dialog
      title="Project Settings"
      onClose={props.onClose}
      width={560}
      footer={
        <>
          <Button onClick={props.onClose}>Cancel</Button>
          <Button primary onClick={ok}>OK</Button>
        </>
      }
    >
      <Tabs value={tab} tabs={[{ value: "general", label: "General" }, { value: "scratch", label: "Scratch Disks" }, { value: "ingest", label: "Ingest Settings" }]} onChange={setTab} />
      <div style={{ paddingTop: 12 }}>
        {tab === "general" ? (
          <div className="form-grid">
            <label>Project Name</label>
            <TextInput value={name} onChange={setName} onEnter={ok} autoFocus />
            <label>Renderer</label>
            <span>Browser GPU (WebGL) preview · ffmpeg export</span>
            <label>Video Display Format</label>
            <span>Timecode</span>
            <label>Audio Display Format</label>
            <span>Audio Samples</span>
            <label>Proxies</label>
            <Checkbox checked={proxies} onChange={(v) => ed().setUI({ proxiesEnabled: v })} label="Enable proxies for playback" />
            <label>Contents</label>
            <span>
              {media.length} media, {Object.keys(project.sequences).length} sequences, {project.items.filter((i) => i.type === "bin").length} bins
            </span>
            <label>Created</label>
            <span>{new Date(project.createdAt).toLocaleString()}</span>
          </div>
        ) : tab === "scratch" ? (
          <div className="form-grid">
            <label>Data Directory</label>
            <span className="mono">{dataDir}</span>
            <label>Project File</label>
            <span className="mono">{dataDir ? `${dataDir}/projects/${project.id}.json` : ""}</span>
            <label>Media Cache</label>
            <span className="mono">{dataDir ? `${dataDir}/media` : ""}</span>
            <label>Proxies / Thumbnails</label>
            <span className="muted">Stored per asset in the media cache</span>
          </div>
        ) : (
          <div>
            <p className="muted">Uploaded media is always copied into the media cache. Media imported by path (Media Browser, Import mode) is referenced in place unless “Copy media” is enabled in Import mode.</p>
            <p className="muted">Proxies (H.264, 960px, GOP 15) are created automatically for media the browser can’t play and for anything above 1080p.</p>
            <Button
              onClick={() => {
                const vids = media.filter((m) => m.kind === "video" && !m.proxyUrl);
                vids.forEach((m) => void api.createProxy(m.id).catch(() => {}));
                ed().toast(vids.length ? `Creating ${vids.length} prox${vids.length === 1 ? "y" : "ies"}` : "All video media already has proxies");
              }}
            >
              Create Proxies for All Video
            </Button>
          </div>
        )}
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------- New / Open / Save As

function NewProjectDialog(props: { onClose: () => void }) {
  const [name, setName] = useState("Untitled Project");
  const ok = () => {
    void newProject(name.trim() || "Untitled Project");
    props.onClose();
  };
  return (
    <Dialog title="New Project" onClose={props.onClose} footer={<><Button onClick={props.onClose}>Cancel</Button><Button primary onClick={ok}>OK</Button></>}>
      <div className="form-grid">
        <label>Name</label>
        <TextInput value={name} onChange={setName} onEnter={ok} autoFocus />
      </div>
      <p className="muted small">The current project is saved first. The new project starts with an empty “Sequence 01” (1920×1080, 30 fps).</p>
    </Dialog>
  );
}

function OpenProjectDialog(props: { onClose: () => void; recent?: boolean }) {
  const [list, setList] = useState<ProjectSummary[] | null>(null);
  const [sel, setSel] = useState<ID | null>(null);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"recent" | "all">(props.recent ? "recent" : "all");
  const currentId = useEditor((s) => s.project.id);
  const load = () => api.listProjects().then(setList).catch((e: Error) => { ed().toast(e.message, "error"); setList([]); });
  useEffect(() => void load(), []);
  const recent = recentProjectIds();
  let shown = list ?? [];
  if (tab === "recent") shown = recent.map((id) => shown.find((p) => p.id === id)).filter((p): p is ProjectSummary => !!p);
  if (q) shown = shown.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));
  const open = (id: ID) => {
    void openProject(id);
    props.onClose();
  };
  const del = async (id: ID) => {
    const p = list?.find((x) => x.id === id);
    if (!p || !window.confirm(`Delete project "${p.name}"? Media files are not deleted.`)) return;
    await api.deleteProject(id);
    setSel(null);
    void load();
  };
  return (
    <Dialog
      title={props.recent ? "Open Recent Project" : "Open Project"}
      onClose={props.onClose}
      width={680}
      footer={
        <>
          <Button onClick={() => { props.onClose(); ed().openDialog("newProject"); }}>New Project…</Button>
          <div className="spacer" />
          <Button disabled={!sel || sel === currentId} onClick={() => sel && void del(sel)}>Delete</Button>
          <Button onClick={props.onClose}>Cancel</Button>
          <Button primary disabled={!sel} onClick={() => sel && open(sel)}>Open</Button>
        </>
      }
    >
      <div className="row" style={{ marginBottom: 8, gap: 10 }}>
        <Tabs value={tab} tabs={[{ value: "recent", label: "Recent" }, { value: "all", label: "All Projects" }]} onChange={setTab} />
        <div className="spacer" />
        <TextInput value={q} onChange={setQ} placeholder="Search projects" />
      </div>
      <div className="dlg-scroll">
        <table className="dlg-table">
          <thead>
            <tr><th>Name</th><th>Modified</th><th>Location</th></tr>
          </thead>
          <tbody>
            {list === null ? (
              <tr><td colSpan={3} className="muted">Loading…</td></tr>
            ) : !shown.length ? (
              <tr><td colSpan={3} className="muted">No projects</td></tr>
            ) : (
              shown.map((p) => (
                <tr key={p.id} className={sel === p.id ? "active" : ""} onClick={() => setSel(p.id)} onDoubleClick={() => open(p.id)}>
                  <td>{p.name}{p.id === currentId ? <span className="muted"> (open)</span> : null}</td>
                  <td>{new Date(p.updatedAt).toLocaleString()}</td>
                  <td className="mono muted" title={p.path}>{p.path}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Dialog>
  );
}

function SaveAsDialog(props: { onClose: () => void; copy?: boolean }) {
  const cur = useEditor((s) => s.project.name);
  const [name, setName] = useState(props.copy ? `${cur} Copy` : cur);
  const ok = () => {
    const n = name.trim() || cur;
    void (props.copy ? saveCopy(n) : saveAs(n));
    props.onClose();
  };
  return (
    <Dialog title={props.copy ? "Save a Copy" : "Save Project As"} onClose={props.onClose} footer={<><Button onClick={props.onClose}>Cancel</Button><Button primary onClick={ok}>Save</Button></>}>
      <div className="form-grid">
        <label>Name</label>
        <TextInput value={name} onChange={setName} onEnter={ok} autoFocus />
      </div>
      <p className="muted small">{props.copy ? "A copy is written; you keep working in the current project." : "The project continues under the new name; the previous version stays saved as it was."}</p>
    </Dialog>
  );
}

// ---------------------------------------------------------------- Project Manager

function ProjectManagerDialog(props: { onClose: () => void }) {
  const project = useEditor((s) => s.project);
  const [excludeUnused, setExcludeUnused] = useState(true);
  const usage = useMemo(() => usageCounts(project), [project]);
  const media = Object.values(project.media).sort((a, b) => a.name.localeCompare(b.name));
  const unused = media.filter((m) => !usage.get(m.id));
  const included = excludeUnused ? media.filter((m) => usage.get(m.id)) : media;
  const total = included.reduce((n, m) => n + (m.sizeBytes ?? 0), 0);
  return (
    <Dialog
      title="Project Manager"
      onClose={props.onClose}
      width={760}
      footer={
        <>
          <Button disabled={!unused.length} onClick={() => deleteItems(unused.map((m) => m.id), { confirm: false })}>Remove Unused ({unused.length})</Button>
          <div className="spacer" />
          <Button onClick={props.onClose}>Close</Button>
          <Button primary onClick={() => ed().toast("Collect Files and Copy to New Location is not available yet", "info")}>Collect Files…</Button>
        </>
      }
    >
      <div className="row" style={{ gap: 16, marginBottom: 8 }}>
        <Checkbox checked={excludeUnused} onChange={setExcludeUnused} label="Exclude Unused Clips" />
        <span className="muted">Resulting project size: <b>{fmtBytes(total)}</b> ({included.length} files)</span>
      </div>
      <div className="dlg-scroll">
        <table className="dlg-table">
          <thead>
            <tr><th>Name</th><th>Type</th><th>Size</th><th>Used</th><th>Status</th><th>Path</th></tr>
          </thead>
          <tbody>
            {media.map((m) => (
              <tr key={m.id} style={{ opacity: excludeUnused && !usage.get(m.id) ? 0.45 : 1 }}>
                <td>{m.name}</td>
                <td>{m.kind}</td>
                <td>{fmtBytes(m.sizeBytes)}</td>
                <td>{usage.get(m.id) ?? 0}</td>
                <td style={{ color: m.status === "error" ? "var(--danger)" : undefined }}>{m.status === "error" ? m.error ?? "error" : m.status}</td>
                <td className="mono muted" title={m.path}>{m.path}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------- Link Media / Properties

function LinkMediaDialog(props: { onClose: () => void; ids?: ID[] }) {
  const project = useEditor((s) => s.project);
  const targets = (props.ids?.length ? props.ids : Object.values(project.media).filter((m) => m.status === "error").map((m) => m.id))
    .map((id) => project.media[id])
    .filter((m): m is MediaAsset => !!m);
  const [paths, setPaths] = useState<Record<ID, string>>(() => Object.fromEntries(targets.map((t) => [t.id, t.path])));
  const [busy, setBusy] = useState(false);
  const linkAll = async () => {
    setBusy(true);
    for (const t of targets) if (paths[t.id]) await relinkMedia(t.id, paths[t.id]);
    setBusy(false);
    props.onClose();
  };
  return (
    <Dialog
      title="Link Media"
      onClose={props.onClose}
      width={720}
      footer={<><Button onClick={props.onClose}>Cancel</Button><Button primary disabled={busy || !targets.length} onClick={() => void linkAll()}>{busy ? "Linking…" : "Locate & Link"}</Button></>}
    >
      {!targets.length ? (
        <p className="muted">No offline media. Select clips and use Link Media to point them at different files.</p>
      ) : (
        <div className="dlg-scroll">
          <table className="dlg-table">
            <thead><tr><th>Clip Name</th><th>Status</th><th>File Path (server)</th></tr></thead>
            <tbody>
              {targets.map((t) => (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  <td style={{ color: t.status === "error" ? "var(--danger)" : undefined }}>{t.status === "error" ? t.error === OFFLINE ? "Offline" : "Missing" : "Online"}</td>
                  <td style={{ maxWidth: 420 }}>
                    <TextInput value={paths[t.id] ?? ""} onChange={(v) => setPaths((p) => ({ ...p, [t.id]: v }))} style={{ width: "100%" }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted small">Enter the absolute path of the replacement file on the machine running the EditCut server.</p>
    </Dialog>
  );
}

function MediaPropertiesDialog(props: { onClose: () => void; id: ID }) {
  const a = useEditor((s) => s.project.media[props.id]);
  if (!a) return null;
  const fps = a.fps ?? 30;
  const rows: [string, string][] = [
    ["File Path", a.path],
    ["Type", a.kind === "image" ? "Still Image" : a.kind === "audio" ? "Audio" : a.hasAudio ? "Movie" : "Video"],
    ["File Size", fmtBytes(a.sizeBytes)],
    ["Duration", `${formatTimecode(a.duration, fps)} (${a.duration.toFixed(3)} s)`],
    ["Image Size", videoInfo(a) || "—"],
    ["Frame Rate", fmtFps(a.fps) || "—"],
    ["Video Codec", a.videoCodec ?? "—"],
    ["Audio", audioInfo(a) || "—"],
    ["Audio Codec", a.audioCodec ?? "—"],
    ["Proxy", a.proxyUrl ? "Attached" : "Not attached"],
    ["Playback URL", a.url],
    ["Status", a.status + (a.error ? ` — ${a.error}` : "")],
    ["Imported", new Date(a.importedAt).toLocaleString()],
    ["Markers", String(a.markers.length)],
    ["In / Out", a.inPoint !== undefined || a.outPoint !== undefined ? `${formatTimecode(a.inPoint ?? 0, fps)} – ${formatTimecode(a.outPoint ?? a.duration, fps)}` : "Not set"],
    ["Transcript", a.transcript ? `${a.transcript.segments.length} segments` : "None"],
  ];
  return (
    <Dialog title={`Properties: ${a.name}`} onClose={props.onClose} width={600} footer={<Button primary onClick={props.onClose}>Close</Button>}>
      <div className="info-grid" style={{ fontSize: 12, gap: "4px 16px" }}>
        {rows.map(([k, v]) => [<span key={k}>{k}</span>, <span key={k + "v"} title={v} style={{ userSelect: "text" }}>{v}</span>])}
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------- Automate to Sequence

function AutomateDialog(props: { onClose: () => void; sortOrder: ID[]; selectionOrder: ID[] }) {
  const seq = useEditor((s) => (s.project.activeSequenceId ? s.project.sequences[s.project.activeSequenceId] : undefined));
  const fps = seq?.settings.fps ?? 30;
  const [ordering, setOrdering] = useState<"sort" | "selection">("sort");
  const [placement, setPlacement] = useState<"sequential" | "markers">("sequential");
  const [method, setMethod] = useState<"insert" | "overwrite">("overwrite");
  const [overlap, setOverlap] = useState(30);
  const [overlapUnit, setOverlapUnit] = useState<"frames" | "seconds">("frames");
  const [stillMode, setStillMode] = useState<"inout" | "frames">("frames");
  const [stillFrames, setStillFrames] = useState(Math.round(5 * fps));
  const [videoTr, setVideoTr] = useState(true);
  const [audioTr, setAudioTr] = useState(true);
  const [ignoreAudio, setIgnoreAudio] = useState(false);
  const [ignoreVideo, setIgnoreVideo] = useState(false);

  const ok = () => {
    if (!seq) return;
    const ids = ordering === "sort" ? props.sortOrder : props.selectionOrder;
    const assets = ids.map((id) => ed().project.media[id]).filter((a): a is MediaAsset => !!a && a.status !== "error");
    if (!assets.length) return props.onClose();
    const s0 = ed();
    const playhead = snapToFrame(usePlayback.getState().time, fps);
    const vIdx = s0.patchVideo ?? 0;
    const aIdx = s0.patchAudio ?? 0;
    const withTransitions = videoTr || audioTr;
    const ov = withTransitions ? (overlapUnit === "frames" ? overlap / fps : overlap) : 0;
    const transDur = ov > 0 ? ov : 1;
    const stillDur = stillFrames / fps;
    const durOf = (a: MediaAsset) => {
      const sIn = a.inPoint ?? 0;
      if (a.kind === "image") return stillMode === "frames" ? stillDur : (a.outPoint ?? sIn + 5) - sIn;
      return Math.max(1 / fps, (a.outPoint ?? a.duration) - sIn);
    };
    let placed = 0;
    ed().applySeq("Automate to Sequence", (sq) => {
      // Placement times: sequential from the playhead, or at unnumbered (unnamed) sequence markers after it.
      let times: number[] = [];
      if (placement === "markers") {
        times = sq.markers.filter((m) => !m.name && m.time >= playhead - EPS).map((m) => m.time).sort((a, b) => a - b).slice(0, assets.length);
      } else {
        let t = playhead;
        assets.forEach((a, i) => {
          times.push(snapToFrame(t, fps));
          t += durOf(a) - (i < assets.length - 1 ? Math.min(ov, durOf(a) / 2) : 0);
        });
        // Insert edit: open up the whole span once, then lay clips in with overwrite.
        if (method === "insert") {
          const end = times[times.length - 1] + durOf(assets[assets.length - 1]);
          insertSpace(sq, playhead, end - playhead, sq.tracks.filter((tr) => !tr.locked && tr.syncLock).map((tr) => tr.id));
        }
      }
      const cuts: { trackId: ID; at: number; kind: "video" | "audio" }[] = [];
      assets.slice(0, times.length).forEach((a, i) => {
        const at = times[i];
        const sIn = a.inPoint ?? 0;
        const clips = placeAsset(sq, a, {
          at, sourceIn: sIn, sourceOut: sIn + durOf(a), videoTrackIndex: vIdx, audioTrackIndex: aIdx,
          includeVideo: !ignoreVideo, includeAudio: !ignoreAudio, mode: placement === "markers" && method === "insert" ? "insert" : "overwrite", stillDuration: stillDur,
        });
        placed++;
        if (i > 0 && placement === "sequential") for (const c of clips) cuts.push({ trackId: c.trackId, at: c.start, kind: c.motion ? "video" : "audio" });
      });
      for (const c of cuts) {
        if (c.kind === "video" && videoTr) addTransition(sq, c.trackId, c.at, "crossDissolve", transDur);
        if (c.kind === "audio" && audioTr) addTransition(sq, c.trackId, c.at, "constantPower", transDur);
      }
    });
    ed().toast(`Placed ${placed} clip${placed === 1 ? "" : "s"} in ${seq.name}`, "success");
    openPanel("timeline");
    props.onClose();
  };

  const radio = <T extends string>(value: T, cur: T, set: (v: T) => void, label: string) => (
    <label>
      <input type="radio" checked={cur === value} onChange={() => set(value)} /> {label}
    </label>
  );

  return (
    <Dialog
      title={`Automate To ${seq?.name ?? "Sequence"}`}
      onClose={props.onClose}
      width={460}
      footer={<><Button onClick={props.onClose}>Cancel</Button><Button primary disabled={!seq} onClick={ok}>OK</Button></>}
    >
      {!seq ? <p style={{ color: "var(--danger)" }}>Open a sequence first.</p> : null}
      <fieldset className="fieldset">
        <legend>From Bin ({props.selectionOrder.length} clip{props.selectionOrder.length === 1 ? "" : "s"})</legend>
        <div className="form-grid">
          <label>Ordering</label>
          <Select value={ordering} options={[{ value: "sort", label: "Sort Order" }, { value: "selection", label: "Selection Order" }]} onChange={setOrdering} />
        </div>
      </fieldset>
      <fieldset className="fieldset">
        <legend>To {seq?.name ?? "Sequence"}</legend>
        <div className="form-grid">
          <label>Placement</label>
          <Select value={placement} options={[{ value: "sequential", label: "Sequentially" }, { value: "markers", label: "At Unnumbered Markers" }]} onChange={setPlacement} />
          <label>Method</label>
          <Select value={method} options={[{ value: "insert", label: "Insert Edit" }, { value: "overwrite", label: "Overwrite Edit" }]} onChange={setMethod} />
          <label>Clip Overlap</label>
          <div className="row">
            <NumField value={overlap} min={0} width={60} onChange={setOverlap} />
            <Select value={overlapUnit} options={[{ value: "frames", label: "Frames" }, { value: "seconds", label: "Seconds" }]} onChange={setOverlapUnit} />
          </div>
        </div>
      </fieldset>
      <fieldset className="fieldset">
        <legend>Still Clip Duration</legend>
        <div className="radio-row" style={{ flexDirection: "column", gap: 6 }}>
          {radio("inout", stillMode, setStillMode, "Use In Point / Out Point")}
          <div className="row" style={{ gap: 6 }}>
            {radio("frames", stillMode, setStillMode, "")}
            <NumField value={stillFrames} min={1} width={60} onChange={(v) => setStillFrames(Math.round(v))} /> <span className="muted">frames per still</span>
          </div>
        </div>
      </fieldset>
      <fieldset className="fieldset">
        <legend>Transitions</legend>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Checkbox checked={audioTr} onChange={setAudioTr} label="Apply Default Audio Transition" />
          <Checkbox checked={videoTr} onChange={setVideoTr} label="Apply Default Video Transition" />
        </div>
      </fieldset>
      <fieldset className="fieldset">
        <legend>Ignore Options</legend>
        <div className="radio-row">
          <Checkbox checked={ignoreAudio} onChange={(v) => { setIgnoreAudio(v); if (v) setIgnoreVideo(false); }} label="Ignore Audio" />
          <Checkbox checked={ignoreVideo} onChange={(v) => { setIgnoreVideo(v); if (v) setIgnoreAudio(false); }} label="Ignore Video" />
        </div>
      </fieldset>
    </Dialog>
  );
}

// ---------------------------------------------------------------- synthetic items

export type SyntheticKind = "colorMatte" | "blackVideo" | "adjustmentLayer" | "bars" | "transparent";

const SYNTH_NAMES: Record<SyntheticKind, string> = {
  colorMatte: "Color Matte", blackVideo: "Black Video", adjustmentLayer: "Adjustment Layer", bars: "Bars and Tone", transparent: "Transparent Video",
};

/**
 * Place a synthetic clip at the playhead: on the first unlocked video track
 * (targeted tracks first) that is free for its duration, adding a track if
 * every one is occupied — so it never overwrites existing material.
 */
export function addSyntheticClip(kind: SyntheticKind, opts: { name?: string; color?: string; duration?: number } = {}): void {
  const seq = getActiveSequence();
  if (!seq) {
    ed().toast("Open or create a sequence first (File › New › Sequence)", "error");
    return;
  }
  const fps = seq.settings.fps;
  const t = snapToFrame(usePlayback.getState().time, fps);
  const dur = Math.max(1 / fps, snapToFrame(opts.duration ?? 5, fps));
  const gen: Generator =
    kind === "colorMatte" ? { kind: "colorMatte", color: opts.color ?? "#ffffff" }
    : kind === "transparent" ? { kind: "colorMatte", color: "#00000000" }
    : kind === "blackVideo" ? { kind: "blackVideo" }
    : kind === "adjustmentLayer" ? { kind: "adjustmentLayer" }
    : { kind: "bars" };
  const name = opts.name || SYNTH_NAMES[kind];
  let clipId: ID | null = null;
  ed().applySeq(`New ${SYNTH_NAMES[kind]}`, (s) => {
    const vids = tracksOfKind(s, "video").filter((v) => !v.locked);
    const ordered = [...vids.filter((v) => v.targeted), ...vids.filter((v) => !v.targeted)];
    const free = (id: ID) => !s.clips.some((c) => c.trackId === id && c.start < t + dur - EPS && clipEnd(c) > t + EPS);
    const track = ordered.find((v) => free(v.id)) ?? addTrack(s, "video");
    const clip = makeGeneratorClip(gen, s.settings, track.id, t, dur, name);
    s.clips.push(clip);
    clipId = clip.id;
  });
  if (clipId) ed().select({ clipIds: [clipId] });
}

function SyntheticDialog(props: { onClose: () => void; kind: SyntheticKind }) {
  const seq = getActiveSequence();
  const fps = seq?.settings.fps ?? 30;
  const [name, setName] = useState(SYNTH_NAMES[props.kind]);
  const [color, setColor] = useState(props.kind === "colorMatte" ? "#ffffff" : "#000000");
  const [dur, setDur] = useState(formatTimecode(5, fps));
  const ok = () => {
    addSyntheticClip(props.kind, { name, color, duration: parseTimecode(dur, fps) ?? 5 });
    props.onClose();
  };
  return (
    <Dialog title={`New ${SYNTH_NAMES[props.kind]}`} onClose={props.onClose} width={420} footer={<><Button onClick={props.onClose}>Cancel</Button><Button primary onClick={ok}>OK</Button></>}>
      <div className="form-grid">
        <label>Video Settings</label>
        <span className="muted">{seq ? `${seq.settings.width} × ${seq.settings.height}, ${seq.settings.fps} fps (matches ${seq.name})` : "No sequence open"}</span>
        {props.kind === "colorMatte" ? (
          <>
            <label>Color</label>
            <ColorInput value={color} onChange={setColor} />
          </>
        ) : null}
        <label>Duration</label>
        <TextInput value={dur} onChange={setDur} onEnter={ok} />
        <label>Name</label>
        <TextInput value={name} onChange={setName} onEnter={ok} autoFocus />
      </div>
      <p className="muted small">Placed at the playhead on the first free video track{props.kind === "adjustmentLayer" ? "; effects applied to it affect all tracks below" : ""}.</p>
    </Dialog>
  );
}

// ---------------------------------------------------------------- Import from Path

function ImportFromPathDialog(props: { onClose: () => void }) {
  const [text, setText] = useState("");
  const [copy, setCopy] = useState(false);
  const ok = async () => {
    const paths = text.split("\n").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
    if (!paths.length) return;
    props.onClose();
    const assets = await importPaths(paths, { copy });
    if (assets.length) ed().toast(`Imported ${assets.length} file${assets.length === 1 ? "" : "s"}`, "success");
  };
  return (
    <Dialog title="Import from Path" onClose={props.onClose} width={560} footer={<><Button onClick={props.onClose}>Cancel</Button><Button primary onClick={() => void ok()}>Import</Button></>}>
      <p className="muted small" style={{ marginTop: 0 }}>Absolute file or folder paths on the server machine, one per line. Folders become bins. Media is referenced in place (no copy) unless “Copy media” is checked.</p>
      <textarea
        className="text-input"
        rows={6}
        style={{ width: "100%", fontFamily: "var(--mono)" }}
        autoFocus
        value={text}
        placeholder="/Users/me/Movies/clip.mov"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void ok();
        }}
      />
      <div style={{ marginTop: 8 }}>
        <Checkbox checked={copy} onChange={setCopy} label="Copy media to project folder" />
      </div>
    </Dialog>
  );
}

registerDialog("newSequence", NewSequenceDialog as never);
registerDialog("sequenceSettings", SequenceSettingsDialog as never);
registerDialog("projectSettings", ProjectSettingsDialog as never);
registerDialog("newProject", NewProjectDialog as never);
registerDialog("openProject", OpenProjectDialog as never);
registerDialog("saveAs", SaveAsDialog as never);
registerDialog("projectManager", ProjectManagerDialog as never);
registerDialog("linkMedia", LinkMediaDialog as never);
registerDialog("mediaProperties", MediaPropertiesDialog as never);
registerDialog("automateToSequence", AutomateDialog as never);
registerDialog("synthetic", SyntheticDialog as never);
registerDialog("importFromPath", ImportFromPathDialog as never);
