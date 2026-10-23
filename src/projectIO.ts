// Project lifecycle and media import on the client:
// - startup (reopen last project or create a fresh one with "Sequence 01")
// - debounced autosave (1.5 s after any change) and explicit save / save as
// - server event subscription that keeps project.media in sync with the
//   server's import pipeline (status, metadata, thumbs, waveform, proxy)
// - import helpers used across the app: importFiles(), importPaths()
// - OS drag-and-drop of files/folders anywhere onto the window
import { create } from "zustand";
import type { ID, LabelColor, MediaAsset, Project, ProjectItem, Sequence, SequenceSettings } from "@shared/types";
import { makeProject, makeSequence, uid } from "@shared/factory";
import { normalizeTransitions, placeAsset } from "@shared/ops";
import { api, subscribeEvents, type ServerEvent } from "./api";
import { useEditor } from "./store/store";
import "./panels/project/project.css";

const ed = () => useEditor.getState();
const LAST_PROJECT_KEY = "editcut.lastProject";
const RECENT_PROJECTS_KEY = "editcut.recentProjects";
const AUTOSAVE_MS = 1500;

// ---------------------------------------------------------------- file types

const VIDEO_EXT = ["mp4", "m4v", "mov", "qt", "webm", "mkv", "avi", "mxf", "mts", "m2ts", "ts", "mpg", "mpeg", "wmv", "flv", "3gp", "ogv", "gif", "dv"];
const AUDIO_EXT = ["mp3", "wav", "aif", "aiff", "aifc", "m4a", "aac", "flac", "ogg", "oga", "opus", "wma", "caf", "w64", "ac3", "eac3", "amr"];
const IMAGE_EXT = ["png", "jpg", "jpeg", "webp", "bmp", "tif", "tiff", "heic", "heif", "avif", "psd", "exr", "dpx", "tga", "svg"];
export const MEDIA_EXTENSIONS = [...VIDEO_EXT, ...AUDIO_EXT, ...IMAGE_EXT];
/** `accept` attribute for file inputs. */
export const MEDIA_ACCEPT = MEDIA_EXTENSIONS.map((e) => "." + e).join(",");

export function fileExt(name: string): string {
  const i = name.lastIndexOf(".");
  return i < 0 ? "" : name.slice(i + 1).toLowerCase();
}

export function isMediaName(name: string): boolean {
  return MEDIA_EXTENSIONS.includes(fileExt(name));
}

export function mediaKindOfName(name: string): "video" | "audio" | "image" | null {
  const e = fileExt(name);
  if (IMAGE_EXT.includes(e)) return "image";
  if (AUDIO_EXT.includes(e)) return "audio";
  if (VIDEO_EXT.includes(e)) return "video";
  return null;
}

/** Premiere's default label colors per item type (Preferences > Labels). */
export function defaultLabel(type: "bin" | "sequence" | MediaAsset["kind"]): LabelColor {
  switch (type) {
    case "bin": return "mango";
    case "sequence": return "forest";
    case "audio": return "caribbean";
    case "image": return "lavender";
    default: return "iris";
  }
}

// ---------------------------------------------------------------- import progress

export interface MediaProgress {
  stage: string;
  progress: number;
}

/** Per-asset pipeline progress from media-progress events (Project panel spinners). */
export const useMediaProgress = create<{ byId: Record<ID, MediaProgress> }>()(() => ({ byId: {} }));

/** Latest server copy of every asset seen this session (reconciles undo/redo and late adds). */
const latest = new Map<ID, MediaAsset>();

/** Fields owned by the server pipeline. Name, label, marks, markers, transcript stay project-owned. */
function serverFields(a: MediaAsset): Partial<MediaAsset> {
  const { name: _n, label: _l, inPoint: _i, outPoint: _o, markers: _m, transcript: _t, ...rest } = a;
  return rest;
}

function onServerEvent(e: ServerEvent): void {
  if (e.type === "media") {
    latest.set(e.asset.id, e.asset);
    const cur = ed().project.media[e.asset.id];
    // Make Offline is a project-level state; don't let late pipeline events revive it.
    if (cur && !(cur.status === "error" && cur.error === OFFLINE && e.asset.status !== "error")) ed().patchMedia(e.asset.id, serverFields(e.asset));
    if (e.asset.status !== "importing") {
      useMediaProgress.setState((s) => {
        const byId = { ...s.byId };
        delete byId[e.asset.id];
        return { byId };
      });
      ed().setJob(`media:${e.asset.id}`, null);
      if (e.asset.status === "error" && cur) ed().toast(`Import failed: ${cur.name} — ${e.asset.error ?? "unknown error"}`, "error");
    }
  } else if (e.type === "media-progress") {
    const a = ed().project.media[e.id];
    if (e.stage === "done") {
      ed().setJob(`media:${e.id}`, null);
      useMediaProgress.setState((s) => {
        const byId = { ...s.byId };
        delete byId[e.id];
        return { byId };
      });
      return;
    }
    useMediaProgress.setState((s) => ({ byId: { ...s.byId, [e.id]: { stage: e.stage, progress: e.progress } } }));
    if (a) ed().setJob(`media:${e.id}`, { label: `${STAGE_LABEL[e.stage] ?? e.stage} ${a.name}`, progress: e.progress });
  }
}

const STAGE_LABEL: Record<string, string> = {
  probe: "Reading",
  thumbnails: "Generating thumbnails for",
  waveform: "Conforming audio for",
  proxy: "Creating proxy for",
};

/** Bring any "importing" asset in the project up to date with what the server knows. */
async function refreshImporting(project: Project): Promise<void> {
  const pending = Object.values(project.media).filter((a) => a.status === "importing");
  await Promise.all(
    pending.map(async (a) => {
      try {
        const fresh = await api.getMedia(a.id);
        latest.set(fresh.id, fresh);
        ed().patchMedia(a.id, serverFields(fresh));
      } catch {
        ed().patchMedia(a.id, { status: "error", error: "Media not found on server" });
      }
    }),
  );
}

// ---------------------------------------------------------------- saving

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let lastSaved: Project | null = null;
let saving: Promise<void> | null = null;
let saveErrorShown = false;

function scheduleSave(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void saveNow(), AUTOSAVE_MS);
}

/** Save the current project immediately. Resolves when written. */
export async function saveNow(opts: { notify?: boolean } = {}): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (saving) await saving;
  const p = ed().project;
  saving = (async () => {
    try {
      await api.saveProject(p);
      lastSaved = p;
      saveErrorShown = false;
      if (ed().project === p) ed().markSaved();
      rememberRecent(p);
      if (opts.notify) ed().toast(`Saved "${p.name}"`, "success");
    } catch (e) {
      if (!saveErrorShown || opts.notify) ed().toast(`Could not save project: ${(e as Error).message}`, "error");
      saveErrorShown = true;
    }
  })();
  await saving;
  saving = null;
}

function rememberRecent(p: Project): void {
  try {
    localStorage.setItem(LAST_PROJECT_KEY, p.id);
    const list = recentProjectIds().filter((id) => id !== p.id);
    localStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify([p.id, ...list].slice(0, 10)));
  } catch {
    /* ignore */
  }
}

export function recentProjectIds(): ID[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_PROJECTS_KEY) ?? "[]") as ID[];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------- project lifecycle

/** A new project containing one default sequence ("Sequence 01", 1920x1080 30fps), set active. */
export function createBlankProject(name = "Untitled Project", settings: Partial<SequenceSettings> = {}): Project {
  const p = makeProject(name);
  const seq = makeSequence("Sequence 01", { width: 1920, height: 1080, fps: 30, ...settings });
  p.sequences[seq.id] = seq;
  p.items.push({ id: seq.id, type: "sequence", name: seq.name, parentId: null, label: defaultLabel("sequence") });
  p.activeSequenceId = seq.id;
  return p;
}

function adopt(p: Project): void {
  lastSaved = p;
  ed().loadProject(p);
  rememberRecent(p);
  void refreshImporting(p);
}

/** Save the current project, then start a new one. */
export async function newProject(name = "Untitled Project", opts: { empty?: boolean } = {}): Promise<Project> {
  if (ed().dirty) await saveNow();
  const p = opts.empty ? makeProject(name) : createBlankProject(name);
  adopt(p);
  await saveNow();
  return p;
}

export async function openProject(id: ID): Promise<void> {
  if (id === ed().project.id) return;
  if (ed().dirty) await saveNow();
  try {
    const p = await api.loadProject(id);
    adopt(p);
    ed().setUI({ mode: "edit" });
    ed().toast(`Opened "${p.name}"`);
  } catch (e) {
    ed().toast(`Could not open project: ${(e as Error).message}`, "error");
  }
}

/** File > Save As: the project continues under a new id and name; the old file is left as it was. */
export async function saveAs(name: string): Promise<void> {
  await saveNow();
  const cur = ed().project;
  const p: Project = { ...structuredClone(cur), id: uid("prj_"), name, createdAt: Date.now(), updatedAt: Date.now() };
  adopt(p);
  await saveNow({ notify: true });
}

/** File > Save a Copy: writes a copy under a new id; editing continues in the current project. */
export async function saveCopy(name: string): Promise<void> {
  const cur = ed().project;
  const copy: Project = { ...structuredClone(cur), id: uid("prj_"), name, updatedAt: Date.now() };
  try {
    await api.saveProject(copy);
    ed().toast(`Saved a copy as "${name}"`, "success");
  } catch (e) {
    ed().toast(`Could not save copy: ${(e as Error).message}`, "error");
  }
}

/** File > Revert: discard unsaved changes and reload the last saved version. */
export async function revertProject(): Promise<void> {
  const id = ed().project.id;
  if (saveTimer) clearTimeout(saveTimer);
  try {
    const p = await api.loadProject(id);
    adopt(p);
    ed().toast("Reverted to saved version");
  } catch (e) {
    ed().toast(`Nothing to revert to: ${(e as Error).message}`, "error");
  }
}

export function renameProject(name: string): void {
  if (!name.trim()) return;
  ed().apply("Rename Project", (d) => {
    d.name = name.trim();
  });
}

// ---------------------------------------------------------------- project items

/** Bin to import into: explicit, else the bin the Project panel is showing. */
let currentBin: ID | null = null;
export function setCurrentBin(id: ID | null): void {
  currentBin = id;
}
export function getCurrentBin(): ID | null {
  const id = currentBin;
  return id && ed().project.items.some((i) => i.id === id && i.type === "bin") ? id : null;
}

/** Find or create a nested bin path ("Footage/Day 1") under parent, inside a draft. */
function ensureBinPath(d: Project, parentId: ID | null, segments: string[]): ID | null {
  let parent = parentId;
  for (const name of segments) {
    if (!name) continue;
    let bin = d.items.find((i) => i.type === "bin" && i.parentId === parent && i.name === name);
    if (!bin) {
      bin = { id: uid("bin_"), type: "bin", name, parentId: parent, label: defaultLabel("bin") };
      d.items.push(bin);
    }
    parent = bin.id;
  }
  return parent;
}

/** Add server assets to project.media + items (one undoable "Import"). relDirs: per-asset sub-bin path. */
function addAssets(assets: MediaAsset[], binId: ID | null, relDirs?: (string | undefined)[], label = "Import"): void {
  if (!assets.length) return;
  ed().apply(label, (d) => {
    assets.forEach((a, i) => {
      const fresh = latest.get(a.id) ?? a;
      const asset: MediaAsset = { ...a, ...serverFields(fresh), label: a.label ?? defaultLabel(fresh.kind) };
      d.media[a.id] = asset;
      const rel = relDirs?.[i];
      const parentId = rel ? ensureBinPath(d, binId, rel.split("/")) : binId;
      d.items.push({ id: a.id, type: "media", name: a.name, parentId, label: asset.label });
    });
  });
  ed().select({ itemIds: assets.map((a) => a.id) });
}

export interface ImportOptions {
  binId?: ID | null;
  /** Relative directory of each file (folder import creates bins). Defaults to File.webkitRelativePath. */
  relDirs?: (string | undefined)[];
}

/** Upload browser File objects (OS drop, file picker) and add them to the project. */
export async function importFiles(files: File[], binIdOrOpts?: ID | null | ImportOptions): Promise<MediaAsset[]> {
  const opts: ImportOptions = typeof binIdOrOpts === "object" && binIdOrOpts !== null ? binIdOrOpts : { binId: binIdOrOpts as ID | null | undefined };
  const binId = opts.binId === undefined ? getCurrentBin() : opts.binId;
  const all = files.map((f, i) => ({ f, rel: opts.relDirs?.[i] ?? dirOf((f as File & { webkitRelativePath?: string }).webkitRelativePath ?? "") }));
  const ok = all.filter((x) => isMediaName(x.f.name));
  const skipped = all.length - ok.length;
  if (skipped) ed().toast(`Skipped ${skipped} unsupported file${skipped > 1 ? "s" : ""}`);
  if (!ok.length) return [];
  const job = `upload:${uid()}`;
  const label = ok.length === 1 ? `Importing ${ok[0].f.name}` : `Importing ${ok.length} files`;
  ed().setJob(job, { label, progress: 0 });
  try {
    const assets = await api.uploadMedia(ok.map((x) => x.f), (fr) => ed().setJob(job, { label, progress: fr }));
    // Server returns supported files in request order; match by name to be safe.
    const rels = assets.map((a, i) => (ok[i]?.f.name === a.name ? ok[i].rel : ok.find((x) => x.f.name === a.name)?.rel));
    addAssets(assets, binId, rels);
    return assets;
  } catch (e) {
    ed().toast(`Import failed: ${(e as Error).message}`, "error");
    return [];
  } finally {
    ed().setJob(job, null);
  }
}

/**
 * Import files/folders by absolute path on the server machine (no copy unless
 * copy=true). A folder becomes a bin of the same name, preserving structure.
 */
export async function importPaths(paths: string[], opts: { binId?: ID | null; copy?: boolean; folderBins?: boolean } = {}): Promise<MediaAsset[]> {
  if (!paths.length) return [];
  const binId = opts.binId === undefined ? getCurrentBin() : opts.binId;
  const job = `paths:${uid()}`;
  ed().setJob(job, { label: opts.copy ? "Copying media" : "Importing media", progress: 0.5 });
  try {
    const res = await fetch("/api/media/import-paths", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paths, copy: !!opts.copy }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error ?? res.statusText);
    const assets = body as MediaAsset[];
    // For folder imports, bin path = folder name + subfolders relative to it.
    const roots = paths.map((p) => p.replace(/\/+$/, ""));
    const rels = assets.map((a) => {
      // Copied assets live in the media store, so their folder structure isn't recoverable.
      if (opts.folderBins === false || opts.copy) return undefined;
      const root = roots.find((r) => a.path.startsWith(r + "/"));
      if (!root) return undefined;
      const rel = a.path.slice(root.length + 1);
      return [basename(root), dirOf(rel)].filter(Boolean).join("/");
    });
    addAssets(assets, binId, rels);
    return assets;
  } catch (e) {
    ed().toast(`Import failed: ${(e as Error).message}`, "error");
    return [];
  } finally {
    ed().setJob(job, null);
  }
}

/** Already-imported asset for a server path (Media Browser double-click twice shouldn't duplicate). */
export function findAssetByPath(path: string): MediaAsset | undefined {
  return Object.values(ed().project.media).find((a) => a.path === path);
}

function dirOf(p: string): string {
  const i = p.lastIndexOf("/");
  return i < 0 ? "" : p.slice(0, i);
}

export function basename(p: string): string {
  return p.replace(/\/+$/, "").split("/").pop() ?? p;
}

/** Open the OS file picker (File > Import). folders=true picks a directory (creates bins). */
export function openFilePicker(opts: { binId?: ID | null; folders?: boolean } = {}): void {
  const input = document.createElement("input");
  input.type = "file";
  input.multiple = true;
  if (opts.folders) (input as HTMLInputElement & { webkitdirectory: boolean }).webkitdirectory = true;
  else input.accept = MEDIA_ACCEPT;
  input.style.display = "none";
  input.onchange = () => {
    const files = [...(input.files ?? [])];
    input.remove();
    if (files.length) void importFiles(files, opts.binId);
  };
  document.body.appendChild(input);
  input.click();
}

// ---------------------------------------------------------------- sequences & items

/** Create a sequence, add it to the project (in a bin) and make it active. Returns its id. */
export function createSequence(name: string, settings: Partial<SequenceSettings> = {}, tracks: { video?: number; audio?: number } = {}, binId: ID | null = getCurrentBin()): ID {
  const seq = makeSequence(name, settings, tracks.video ?? 3, tracks.audio ?? 3);
  ed().apply("New Sequence", (d) => {
    d.sequences[seq.id] = seq;
    d.items.push({ id: seq.id, type: "sequence", name: seq.name, parentId: binId, label: defaultLabel("sequence") });
    d.activeSequenceId = seq.id;
  });
  ed().select({ itemIds: [seq.id] });
  return seq.id;
}

/** Next free "Sequence NN" name. */
export function nextSequenceName(project: Project = ed().project, base = "Sequence"): string {
  const names = new Set(Object.values(project.sequences).map((s) => s.name));
  for (let i = 1; ; i++) {
    const n = `${base} ${String(i).padStart(2, "0")}`;
    if (!names.has(n)) return n;
  }
}

/** Sequence settings that match a clip (New Sequence From Clip / drag onto New Item). */
export function settingsForAsset(a: MediaAsset): Partial<SequenceSettings> {
  const w = a.width ?? 1920;
  const h = a.height ?? 1080;
  return {
    width: Math.round(w / 2) * 2 || 1920,
    height: Math.round(h / 2) * 2 || 1080,
    fps: a.kind === "video" && a.fps ? a.fps : 30,
    sampleRate: a.sampleRate && [44100, 48000, 96000].includes(a.sampleRate) ? a.sampleRate : 48000,
  };
}

/** Premiere "New Sequence From Clip": sequence named after the clip with matching settings, clip edited in. */
export function newSequenceFromClips(assetIds: ID[]): void {
  const assets = assetIds.map((id) => ed().project.media[id]).filter(Boolean);
  if (!assets.length) return;
  const first = assets.find((a) => a.kind !== "audio") ?? assets[0];
  const seqId = createSequence(first.name.replace(/\.[^.]+$/, ""), settingsForAsset(first), {}, ed().project.items.find((i) => i.id === first.id)?.parentId ?? null);
  ed().apply("Insert Clips", (d) => {
    const seq = d.sequences[seqId];
    let at = 0;
    for (const a of assets) {
      const clips = placeAsset(seq, a, { at, mode: "overwrite" });
      at = Math.max(at, ...clips.map((c) => c.start + c.duration));
    }
  });
}

/** All descendants of the given item ids (bins expand recursively), including themselves. */
export function collectItems(project: Project, ids: ID[]): ProjectItem[] {
  const out = new Map<ID, ProjectItem>();
  const walk = (id: ID) => {
    const it = project.items.find((i) => i.id === id);
    if (!it || out.has(id)) return;
    out.set(id, it);
    if (it.type === "bin") for (const c of project.items) if (c.parentId === id) walk(c.id);
  };
  ids.forEach(walk);
  return [...out.values()];
}

/** Number of placements of an asset (linked V+A count once) or nested sequence across all sequences. */
export function usageCounts(project: Project): Map<ID, number> {
  const counts = new Map<ID, number>();
  for (const seq of Object.values(project.sequences)) {
    const seen = new Set<string>();
    for (const c of seq.clips) {
      const src = c.assetId ?? c.sequenceId;
      if (!src) continue;
      const key = `${src}|${c.linkId ?? c.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      counts.set(src, (counts.get(src) ?? 0) + 1);
    }
  }
  return counts;
}

/** Delete project items (bins recursively). Clips using deleted media/sequences are removed from sequences. */
export function deleteItems(ids: ID[], opts: { confirm?: boolean } = {}): void {
  const p = ed().project;
  const victims = collectItems(p, ids);
  if (!victims.length) return;
  const gone = new Set(victims.map((v) => v.id));
  const used = victims.filter((v) => v.type !== "bin" && Object.values(p.sequences).some((s) => !gone.has(s.id) && s.clips.some((c) => c.assetId === v.id || c.sequenceId === v.id)));
  if (opts.confirm !== false && used.length) {
    const ok = window.confirm(
      `${used.length === 1 ? `"${used[0].name}" is` : `${used.length} items are`} used in sequences. Deleting will remove the clips from those sequences. Continue?`,
    );
    if (!ok) return;
  }
  ed().apply(victims.length === 1 ? `Delete ${victims[0].name}` : `Delete ${victims.length} Items`, (d) => {
    d.items = d.items.filter((i) => !gone.has(i.id));
    for (const v of victims) {
      if (v.type === "media") delete d.media[v.id];
      if (v.type === "sequence") delete d.sequences[v.id];
    }
    for (const seq of Object.values(d.sequences)) {
      const ids = seq.clips.filter((c) => (c.assetId && gone.has(c.assetId)) || (c.sequenceId && gone.has(c.sequenceId))).map((c) => c.id);
      if (ids.length) {
        // Locked tracks don't protect against the media disappearing.
        seq.clips = seq.clips.filter((c) => !ids.includes(c.id));
        normalizeTransitions(seq);
      }
    }
    if (d.activeSequenceId && !d.sequences[d.activeSequenceId]) d.activeSequenceId = Object.keys(d.sequences)[0] ?? null;
  });
  const s = ed();
  if (s.sourceAssetId && gone.has(s.sourceAssetId)) s.setUI({ sourceAssetId: null });
  s.select({ itemIds: s.selection.itemIds.filter((i) => !gone.has(i)) });
}

/** Duplicate a sequence (deep copy with fresh clip/transition ids). */
export function duplicateSequence(id: ID): ID | null {
  const src = ed().project.sequences[id];
  if (!src) return null;
  const copy: Sequence = structuredClone(src);
  copy.id = uid("seq_");
  copy.name = `${src.name} Copy`;
  copy.createdAt = Date.now();
  const clipIds = new Map<ID, ID>();
  const links = new Map<ID, ID>();
  for (const c of copy.clips) {
    const nid = uid("clp_");
    clipIds.set(c.id, nid);
    c.id = nid;
    if (c.linkId) {
      if (!links.has(c.linkId)) links.set(c.linkId, uid("lnk_"));
      c.linkId = links.get(c.linkId);
    }
  }
  for (const t of copy.transitions) {
    t.id = uid("tr_");
    if (t.clipAId) t.clipAId = clipIds.get(t.clipAId);
    if (t.clipBId) t.clipBId = clipIds.get(t.clipBId);
  }
  const parentId = ed().project.items.find((i) => i.id === id)?.parentId ?? null;
  ed().apply("Duplicate Sequence", (d) => {
    d.sequences[copy.id] = copy;
    const idx = d.items.findIndex((i) => i.id === id);
    d.items.splice(idx + 1, 0, { id: copy.id, type: "sequence", name: copy.name, parentId, label: d.items[idx]?.label ?? defaultLabel("sequence") });
  });
  return copy.id;
}

export const OFFLINE = "Media offline";

/** File > Make Offline: media stays in the project but is unlinked from its file. */
export function makeOffline(ids: ID[]): void {
  const media = ids.filter((id) => ed().project.media[id]);
  if (!media.length) return;
  ed().apply("Make Offline", (d) => {
    for (const id of media) Object.assign(d.media[id], { status: "error", error: OFFLINE });
  });
}

/**
 * Link Media: point an asset at a new file. The server imports the new path
 * under a fresh id; the asset (keeping its name, label, marks and markers) is
 * re-keyed to that id everywhere — items, clips, selection, Source Monitor.
 */
export async function relinkMedia(assetId: ID, path: string): Promise<boolean> {
  try {
    const [fresh] = await api.importPaths([path]);
    if (!fresh) throw new Error("No media at that path");
    ed().apply("Link Media", (d) => {
      const old = d.media[assetId];
      if (!old) return;
      // The new server id becomes the asset's id everywhere (urls point at it).
      const merged: MediaAsset = { ...old, ...serverFields(latest.get(fresh.id) ?? fresh), id: fresh.id, error: undefined };
      delete d.media[assetId];
      d.media[fresh.id] = merged;
      for (const it of d.items) if (it.id === assetId) it.id = fresh.id;
      for (const seq of Object.values(d.sequences)) for (const c of seq.clips) if (c.assetId === assetId) c.assetId = fresh.id;
    });
    const s = ed();
    if (s.sourceAssetId === assetId) s.setUI({ sourceAssetId: fresh.id });
    s.select({ itemIds: s.selection.itemIds.map((i) => (i === assetId ? fresh.id : i)) });
    s.toast(`Linked to ${basename(path)}`, "success");
    return true;
  } catch (e) {
    ed().toast(`Link Media failed: ${(e as Error).message}`, "error");
    return false;
  }
}

// ---------------------------------------------------------------- OS drag & drop

interface DroppedFile {
  file: File;
  rel?: string;
}

/** Read files out of a drop, walking dropped folders (each folder becomes a bin). */
export async function filesFromDataTransfer(dt: DataTransfer): Promise<DroppedFile[]> {
  const items = [...dt.items].filter((i) => i.kind === "file");
  const entries = items.map((i) => (i as DataTransferItem & { webkitGetAsEntry?: () => FileSystemEntry | null }).webkitGetAsEntry?.() ?? null);
  if (!entries.some((e) => e?.isDirectory)) return [...dt.files].map((file) => ({ file }));
  const out: DroppedFile[] = [];
  const walk = async (entry: FileSystemEntry, rel: string): Promise<void> => {
    if (entry.isFile) {
      const file = await new Promise<File>((res, rej) => (entry as FileSystemFileEntry).file(res, rej));
      out.push({ file, rel: rel || undefined });
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      const children: FileSystemEntry[] = [];
      // readEntries returns batches (max 100 in Chromium) until empty
      for (;;) {
        const batch = await new Promise<FileSystemEntry[]>((res, rej) => reader.readEntries(res, rej));
        if (!batch.length) break;
        children.push(...batch);
      }
      const sub = rel ? `${rel}/${entry.name}` : entry.name;
      for (const c of children.sort((a, b) => a.name.localeCompare(b.name))) if (!c.name.startsWith(".")) await walk(c, sub);
    }
  };
  for (const e of entries) if (e) await walk(e, "");
  return out;
}

/** Handle an OS file drop (used by the window and by the Project panel with a bin target). */
export async function importDrop(dt: DataTransfer, binId?: ID | null): Promise<void> {
  const files = await filesFromDataTransfer(dt);
  if (!files.length) return;
  await importFiles(files.map((f) => f.file), { binId, relDirs: files.map((f) => f.rel) });
}

export function isFileDrag(e: DragEvent | React.DragEvent): boolean {
  return !!e.dataTransfer && [...e.dataTransfer.types].includes("Files");
}

function installWindowDrop(): void {
  const overlay = document.createElement("div");
  overlay.className = "os-drop-overlay";
  overlay.innerHTML = `<div class="os-drop-card"><div class="os-drop-icon">⤓</div><div>Drop to import media</div><div class="os-drop-sub">Folders become bins</div></div>`;
  let depth = 0;
  const show = (on: boolean) => {
    if (on && !overlay.isConnected) document.body.appendChild(overlay);
    overlay.classList.toggle("visible", on);
  };
  window.addEventListener("dragenter", (e) => {
    if (!isFileDrag(e)) return;
    depth++;
    show(true);
  });
  window.addEventListener("dragleave", (e) => {
    if (!isFileDrag(e)) return;
    depth = Math.max(0, depth - 1);
    if (!depth) show(false);
  });
  window.addEventListener("dragover", (e) => {
    if (!isFileDrag(e)) return;
    e.preventDefault(); // allow dropping files anywhere
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
  });
  window.addEventListener("drop", (e) => {
    if (!isFileDrag(e)) return;
    depth = 0;
    show(false);
    // Panels with their own drop targets (Project panel bins, timeline) handle the drop
    // themselves and call preventDefault (and/or markDropHandled) first.
    const handled = e.defaultPrevented || (e as DragEvent & { editcutHandled?: boolean }).editcutHandled;
    e.preventDefault(); // never let the browser navigate to the dropped file
    if (!handled && e.dataTransfer) void importDrop(e.dataTransfer);
  });
}

/** Mark a native drop event as consumed so the window-level importer ignores it. */
export function markDropHandled(e: React.DragEvent | DragEvent): void {
  const native = ("nativeEvent" in e ? e.nativeEvent : e) as DragEvent & { editcutHandled?: boolean };
  native.editcutHandled = true;
}

// ---------------------------------------------------------------- init

let initialized = false;

/** Call once at startup (src/main.tsx). */
export function initProjectIO(): void {
  if (initialized) return;
  initialized = true;

  subscribeEvents(onServerEvent);

  // Autosave on every project change (undoable edits and pipeline patches alike).
  useEditor.subscribe((s, prev) => {
    if (s.project === prev.project || s.project === lastSaved) return;
    scheduleSave();
    if (s.project.media !== prev.project.media) reconcileMedia(s.project);
  });

  window.addEventListener("beforeunload", (e) => {
    if (ed().dirty) {
      void saveNow();
      e.preventDefault();
    }
  });

  installWindowDrop();
  void startup();
}

/**
 * Undo/redo restores project snapshots taken while an asset was still importing;
 * bring those back up to date from the latest server state.
 */
function reconcileMedia(p: Project): void {
  for (const a of Object.values(p.media)) {
    const fresh = latest.get(a.id);
    if (a.status === "importing" && fresh && fresh.status !== "importing") queueMicrotask(() => ed().patchMedia(a.id, serverFields(fresh)));
  }
}

async function startup(): Promise<void> {
  let lastId: string | null = null;
  try {
    lastId = localStorage.getItem(LAST_PROJECT_KEY);
  } catch {
    /* ignore */
  }
  if (lastId) {
    try {
      adopt(await api.loadProject(lastId));
      return;
    } catch {
      /* deleted or server unreachable: fall through */
    }
  }
  // Fall back to the most recently updated project on the server, else a fresh one.
  try {
    const list = await api.listProjects();
    if (list.length) {
      adopt(await api.loadProject(list[0].id));
      return;
    }
  } catch {
    /* server may be down; still give the user a working blank project */
  }
  adopt(createBlankProject());
  await saveNow();
}

/**
 * Resolve once every asset has been probed (duration/dimensions known) or
 * failed — e.g. before building a sequence from freshly imported media.
 */
export function waitForProbe(ids: ID[], timeoutMs = 120_000): Promise<MediaAsset[]> {
  const done = () => {
    const media = ed().project.media;
    return ids.every((id) => !media[id] || media[id].status !== "importing" || media[id].duration > 0);
  };
  const result = () => ids.map((id) => ed().project.media[id]).filter((a): a is MediaAsset => !!a && a.status !== "error");
  if (done()) return Promise.resolve(result());
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      unsub();
      resolve(result());
    }, timeoutMs);
    const unsub = useEditor.subscribe(() => {
      if (!done()) return;
      clearTimeout(timer);
      unsub();
      resolve(result());
    });
  });
}
