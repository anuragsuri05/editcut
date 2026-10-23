// Import mode (Premiere 22+ header "Import" tab): a full-screen media picker.
// Left: locations (Recent, home folders, Downloads, Volumes...). Center: media
// cards with checkboxes, browsed on the server machine. Right: import settings
// (copy media, new bin, new sequence) and the project name. Bottom: selection
// tray with the Import/Create button. Afterwards the app switches to Edit mode.
import { useMemo, useState } from "react";
import { Check, ChevronRight, Clock, Folder, Upload, X, Star } from "lucide-react";
import { useEditor } from "../../store/store";
import { openPanel } from "../../dock";
import { placeAsset } from "@shared/ops";
import { Button, Checkbox, TextInput } from "../../ui/kit";
import {
  createSequence, getCurrentBin, importPaths, mediaKindOfName, newProject, nextSequenceName, openFilePicker, renameProject, settingsForAsset, waitForProbe,
} from "../../projectIO";
import { FsThumb, lastBrowsedDir, pushRecentDir, recentDirs, standardLocations, useBrowser, useHomeDir, type FsEntry } from "./MediaBrowserPanel";
import { newBin } from "./ProjectPanel";
import { fmtBytes } from "./common";

const ed = () => useEditor.getState();

export default function ImportMode() {
  const project = useEditor((s) => s.project);
  const home = useHomeDir();
  const b = useBrowser(lastBrowsedDir());
  const [selected, setSelected] = useState<Map<string, FsEntry>>(new Map());
  const [copy, setCopy] = useState(false);
  const [makeBin, setMakeBin] = useState(false);
  const [binName, setBinName] = useState("Imported Media");
  const [makeSeq, setMakeSeq] = useState(true);
  const [seqName, setSeqName] = useState("");
  const [asNewProject, setAsNewProject] = useState(false);
  const [projectName, setProjectName] = useState(project.name);
  const [busy, setBusy] = useState(false);
  const favs = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("editcut.mediaBrowser.favorites") ?? "[]") as string[];
    } catch {
      return [];
    }
  }, []);

  const entries = b.listing?.entries ?? [];
  const files = entries.filter((e) => !e.isDir);
  const allChecked = files.length > 0 && files.every((f) => selected.has(f.path));
  const toggle = (e: FsEntry) =>
    setSelected((s) => {
      const n = new Map(s);
      if (n.has(e.path)) n.delete(e.path);
      else n.set(e.path, e);
      return n;
    });
  const selectAll = () =>
    setSelected((s) => {
      const n = new Map(s);
      for (const f of files) {
        if (allChecked) n.delete(f.path);
        else n.set(f.path, f);
      }
      return n;
    });

  const crumbs = useMemo(() => {
    const parts = b.dir.split("/").filter(Boolean);
    return parts.map((name, i) => ({ name, path: "/" + parts.slice(0, i + 1).join("/") }));
  }, [b.dir]);

  const doImport = async () => {
    const list = [...selected.values()];
    if (!list.length || busy) return;
    setBusy(true);
    try {
      pushRecentDir(b.dir);
      if (asNewProject) await newProject(projectName.trim() || "Untitled Project", { empty: makeSeq });
      else if (projectName.trim() && projectName.trim() !== project.name) renameProject(projectName);
      const binId = makeBin ? newBin(getCurrentBin(), [], binName.trim() || "Imported Media") : asNewProject ? null : getCurrentBin();
      const assets = await importPaths(list.map((e) => e.path), { binId, copy, folderBins: true });
      if (makeSeq && assets.length) {
        ed().setJob("importmode", { label: "Building sequence", progress: 0.5 });
        const ready = await waitForProbe(assets.map((a) => a.id));
        ed().setJob("importmode", null);
        // Order follows the selection order of the cards; the first visual clip sets the sequence format.
        const ordered = list.map((e) => ready.find((a) => a.path === e.path || a.name === e.name)).filter((a): a is NonNullable<typeof a> => !!a);
        const first = ordered.find((a) => a.kind === "video") ?? ordered.find((a) => a.kind === "image") ?? ordered[0];
        if (first) {
          const seqId = createSequence(seqName.trim() || nextSequenceName(), settingsForAsset(first), {}, binId);
          ed().apply("Insert Clips", (d) => {
            const seq = d.sequences[seqId];
            let at = 0;
            for (const a of ordered) {
              const clips = placeAsset(seq, a, { at, mode: "overwrite" });
              at = Math.max(at, ...clips.map((c) => c.start + c.duration));
            }
          });
        }
      }
      ed().toast(`Imported ${assets.length} item${assets.length === 1 ? "" : "s"}`, "success");
      setSelected(new Map());
      ed().setUI({ mode: "edit" });
      setTimeout(() => openPanel(makeSeq ? "timeline" : "project"), 0);
    } finally {
      setBusy(false);
    }
  };

  const side = (name: string, path: string, icon: React.ReactNode) => (
    <div key={path} className={"mb-side-item" + (b.dir === path ? " active" : "")} title={path} onClick={() => b.go(path)}>
      {icon} {name}
    </div>
  );
  const sel = [...selected.values()];

  return (
    <div className="import-mode">
      <div className="im-top">
        <span className="im-title">Import</span>
        <span className="muted">Choose media to bring into {asNewProject ? "a new project" : `“${project.name}”`}</span>
        <div className="spacer" />
        <Button onClick={() => openFilePicker({ binId: getCurrentBin() })} title="Upload files from this computer">
          <span className="row" style={{ gap: 6 }}><Upload size={13} /> Browse Computer…</span>
        </Button>
        <Button onClick={() => ed().setUI({ mode: "edit" })}>Cancel</Button>
      </div>
      <div className="im-main">
        <div className="im-side">
          {recentDirs().length ? <div className="mb-side-title">Recent</div> : null}
          {recentDirs().map((d) => side(d.split("/").pop() || d, d, <Clock size={14} />))}
          {favs.length ? <div className="mb-side-title">Favorites</div> : null}
          {favs.map((d) => side(d.split("/").pop() || d, d, <Star size={14} />))}
          <div className="mb-side-title">Locations</div>
          {standardLocations(home).map((l) => side(l.name, l.path, l.icon))}
        </div>

        <div className="im-content">
          <div className="im-pathbar">
            <span className="im-crumb" onClick={() => b.go("/")}>/</span>
            {crumbs.map((c) => (
              <span key={c.path} className="row" style={{ gap: 4 }}>
                <ChevronRight size={12} className="muted" />
                <span className="im-crumb" onClick={() => b.go(c.path)}>{c.name}</span>
              </span>
            ))}
            <div className="spacer" />
            {files.length ? <Checkbox checked={allChecked} onChange={selectAll} label={`Select all (${files.length})`} /> : null}
          </div>
          <div className="im-grid">
            {b.error ? <div className="muted" style={{ color: "var(--danger)" }}>{b.error}</div> : null}
            {!b.error && !entries.length && !b.loading ? <div className="muted">No media in this folder.</div> : null}
            {entries.map((e) =>
              e.isDir ? (
                <div key={e.path} className="im-card folder" onClick={() => b.go(e.path)} title={e.path}>
                  <FsThumb entry={e} />
                  <div className="im-card-info">
                    <div className="im-card-name">{e.name}</div>
                    <div className="im-card-meta">Folder</div>
                  </div>
                </div>
              ) : (
                <div key={e.path} className={"im-card" + (selected.has(e.path) ? " checked" : "")} onClick={() => toggle(e)} onDoubleClick={() => { setSelected(new Map([[e.path, e]])); }} title={e.path}>
                  <FsThumb entry={e} width={360} />
                  <span className="im-card-check">{selected.has(e.path) ? <Check size={12} /> : null}</span>
                  <div className="im-card-info">
                    <div className="im-card-name">{e.name}</div>
                    <div className="im-card-meta">{mediaKindOfName(e.name)} · {fmtBytes(e.size)}</div>
                  </div>
                </div>
              ),
            )}
          </div>
        </div>

        <div className="im-settings">
          <h3>Project</h3>
          <div className="im-toggle">
            <Checkbox checked={asNewProject} onChange={(v) => { setAsNewProject(v); setProjectName(v ? "Untitled Project" : project.name); }} label="Create a new project" />
            <label className="muted small">Project name</label>
            <TextInput value={projectName} onChange={setProjectName} />
          </div>
          <h3>Import settings</h3>
          <div className="im-toggle">
            <Checkbox checked={copy} onChange={setCopy} label="Copy media" />
            <span className="muted small">Copy files into the EditCut media folder instead of linking to them where they are.</span>
          </div>
          <div className="im-toggle">
            <Checkbox checked={makeBin} onChange={setMakeBin} label="Create new bin" />
            {makeBin ? <TextInput value={binName} onChange={setBinName} /> : null}
          </div>
          <div className="im-toggle">
            <Checkbox checked={makeSeq} onChange={setMakeSeq} label="Create new sequence" />
            {makeSeq ? <TextInput value={seqName} onChange={setSeqName} placeholder={nextSequenceName()} /> : null}
            <span className="muted small">Clips are placed in selection order; the sequence matches the first clip’s frame size and rate.</span>
          </div>
        </div>
      </div>

      <div className="im-tray">
        <div className="im-tray-thumbs">
          {sel.slice(0, 24).map((e) => (
            <div key={e.path} title={e.name} style={{ position: "relative" }}>
              <FsThumb entry={e} width={160} />
              <X size={11} style={{ position: "absolute", top: 2, right: 2, cursor: "pointer", background: "rgba(0,0,0,.6)", borderRadius: 6 }} onClick={() => toggle(e)} />
            </div>
          ))}
          {!sel.length ? <span className="muted"><Folder size={13} style={{ verticalAlign: -2 }} /> Select media to import</span> : null}
        </div>
        <span className="muted">{sel.length} selected</span>
        {sel.length ? <Button onClick={() => setSelected(new Map())}>Clear</Button> : null}
        <Button primary disabled={!sel.length || busy} onClick={() => void doImport()}>
          {busy ? "Importing…" : asNewProject ? "Create" : "Import"}
        </Button>
      </div>
    </div>
  );
}
