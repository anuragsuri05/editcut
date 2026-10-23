// Project panel (Premiere: Window > Project, Shift+1).
// List view with sortable/resizable metadata columns and twirl-down bins,
// Icon view with hover-scrub thumbnails, Freeform view (storyboard canvas),
// bins with breadcrumb navigation, search, drag in/out, context menus and the
// bottom toolbar (views, zoom, sort, Automate to Sequence, Find, New Bin,
// New Item, Clear).
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  List, LayoutGrid, LayoutDashboard, ArrowUpDown, ListVideo, Search, FolderPlus, FilePlus2, Trash2, ChevronRight, X, Upload, AudioLines, Lock,
} from "lucide-react";
import type { ID, LabelColor, Project, ProjectItem } from "@shared/types";
import { LABEL_COLORS } from "@shared/types";
import { formatTimecode } from "@shared/time";
import { useEditor } from "../../store/store";
import { openPanel } from "../../dock";
import { api } from "../../api";
import { runCommand } from "../../commands/registry";
import { IconButton, Slider, showContextMenu, type ContextMenuItem } from "../../ui/kit";
import {
  collectItems, deleteItems, duplicateSequence, importDrop, isFileDrag, makeOffline, markDropHandled,
  newSequenceFromClips, openFilePicker, setCurrentBin, usageCounts, defaultLabel,
} from "../../projectIO";
import { ItemIcon, LabelChip, SpriteThumb, StatusBadge, itemInfo, mediaFps, MiniWave, type ItemInfo } from "./common";
import { uid } from "@shared/factory";

/** Drag payload for project items. The timeline accepts drops of this MIME type. */
export const ITEMS_MIME = "application/x-editcut-items";

const ed = () => useEditor.getState();

// ---------------------------------------------------------------- persisted view prefs

type ViewMode = "list" | "icon" | "freeform";
type SortKey = "user" | "name" | "label" | "type" | "fps" | "start" | "end" | "duration" | "videoInfo" | "audioInfo" | "usage";

interface Prefs {
  view: ViewMode;
  zoom: number; // icon width px
  sort: { key: SortKey; dir: 1 | -1 };
  iconSort: SortKey;
  cols: Record<string, number>;
  /** Freeform positions per bin: binKey -> itemId -> {x,y}. */
  freeform: Record<string, Record<ID, { x: number; y: number }>>;
}

const PREFS_KEY = "editcut.projectPanel";
const DEFAULT_PREFS: Prefs = {
  view: "list",
  zoom: 140,
  sort: { key: "name", dir: 1 },
  iconSort: "user",
  cols: { name: 240, fps: 80, start: 96, end: 96, duration: 96, videoInfo: 130, audioInfo: 130, usage: 60 },
  freeform: {},
};

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Prefs>;
      return { ...DEFAULT_PREFS, ...p, cols: { ...DEFAULT_PREFS.cols, ...p.cols } };
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_PREFS;
}

function savePrefs(p: Prefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

const COLUMNS: { key: SortKey; title: string; align?: "right" }[] = [
  { key: "name", title: "Name" },
  { key: "fps", title: "Frame Rate", align: "right" },
  { key: "start", title: "Media Start", align: "right" },
  { key: "end", title: "Media End", align: "right" },
  { key: "duration", title: "Media Duration", align: "right" },
  { key: "videoInfo", title: "Video Info" },
  { key: "audioInfo", title: "Audio Info" },
  { key: "usage", title: "Usage", align: "right" },
];

const SORT_LABELS: Partial<Record<SortKey, string>> = {
  user: "User Order", name: "Name", label: "Label", type: "Media Type", fps: "Frame Rate", duration: "Media Duration", videoInfo: "Video Info", audioInfo: "Audio Info", usage: "Usage",
};

// ---------------------------------------------------------------- panel API for commands

/** Live hooks into the mounted Project panel, used by project.* commands. */
export const projectPanelApi: {
  visibleIds: () => ID[];
  rename: (id: ID) => void;
  focusSearch: () => void;
  setView: (v: ViewMode) => void;
} = { visibleIds: () => [], rename: () => {}, focusSearch: () => {}, setView: () => {} };

// ---------------------------------------------------------------- helpers

function sortValue(info: ItemInfo, key: SortKey, usage: Map<ID, number>, order: Map<ID, number>): string | number {
  switch (key) {
    case "user": return order.get(info.item.id) ?? 0;
    case "name": return info.item.name.toLowerCase();
    case "label": return info.item.label ?? "";
    case "type": return info.mediaType;
    case "fps": return info.fps ?? 0;
    case "start": return 0;
    case "end":
    case "duration": return info.duration;
    case "videoInfo": return info.asset ? (info.asset.width ?? 0) * (info.asset.height ?? 0) : info.seq ? info.seq.settings.width * info.seq.settings.height : 0;
    case "audioInfo": return info.audioInfo;
    case "usage": return usage.get(info.item.id) ?? 0;
  }
}

function compare(a: string | number, b: string | number): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true });
}

function isDescendant(p: Project, id: ID, ancestor: ID): boolean {
  let cur = p.items.find((i) => i.id === id);
  while (cur?.parentId) {
    if (cur.parentId === ancestor) return true;
    cur = p.items.find((i) => i.id === cur!.parentId);
  }
  return false;
}

function readDraggedIds(e: React.DragEvent): ID[] | null {
  const raw = e.dataTransfer.getData(ITEMS_MIME);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ID[];
  } catch {
    return null;
  }
}

function hasItemsDrag(e: React.DragEvent): boolean {
  return [...e.dataTransfer.types].includes(ITEMS_MIME);
}

/** Move items into a bin (or root), ignoring moves of a bin into itself or its descendants. */
export function moveItemsToBin(ids: ID[], binId: ID | null): void {
  const p = ed().project;
  const ok = ids.filter((id) => id !== binId && !(binId && isDescendant(p, binId, id)) && p.items.find((i) => i.id === id)?.parentId !== binId);
  if (!ok.length) return;
  ed().apply("Move Items", (d) => {
    for (const it of d.items) if (ok.includes(it.id)) it.parentId = binId;
  });
}

/** Create a bin (optionally containing items) and return its id. */
export function newBin(parentId: ID | null, containing: ID[] = [], name?: string): ID {
  const id = uid("bin_");
  const p = ed().project;
  const siblings = new Set(p.items.filter((i) => i.parentId === parentId && i.type === "bin").map((i) => i.name));
  let n = name ?? "Bin";
  for (let i = 1; !name && siblings.has(n); i++) n = `Bin ${i}`;
  ed().apply(containing.length ? "New Bin from Selection" : "New Bin", (d) => {
    d.items.push({ id, type: "bin", name: n, parentId, label: defaultLabel("bin") });
    for (const it of d.items) if (containing.includes(it.id) && it.id !== id) it.parentId = id;
  });
  ed().select({ itemIds: [id] });
  return id;
}

export function renameItem(id: ID, name: string): void {
  const n = name.trim();
  const it = ed().project.items.find((i) => i.id === id);
  if (!n || !it || it.name === n) return;
  ed().apply("Rename", (d) => {
    const item = d.items.find((i) => i.id === id);
    if (item) item.name = n;
    if (d.media[id]) d.media[id].name = n;
    if (d.sequences[id]) d.sequences[id].name = n;
  });
}

export function setLabel(ids: ID[], label: LabelColor): void {
  ed().apply("Label", (d) => {
    for (const it of d.items) if (ids.includes(it.id)) it.label = label;
    for (const id of ids) if (d.media[id]) d.media[id].label = label;
  });
}

/** Open a project item: media -> Source Monitor, sequence -> active in Timeline. */
export function openItem(item: ProjectItem): void {
  if (item.type === "media") {
    ed().setUI({ sourceAssetId: item.id, focusedMonitor: "source" });
    openPanel("source");
  } else if (item.type === "sequence") {
    ed().patch((d) => {
      d.activeSequenceId = item.id;
    });
    openPanel("timeline");
  }
}

function labelSubmenu(ids: ID[]): ContextMenuItem[] {
  const p = ed().project;
  const current = p.items.find((i) => i.id === ids[0])?.label;
  return [
    {
      label: "Select Label Group",
      disabled: !current,
      onClick: () => ed().select({ itemIds: p.items.filter((i) => i.label && i.label === current).map((i) => i.id) }),
    },
    { separator: true },
    ...(Object.keys(LABEL_COLORS) as LabelColor[]).map((c) => ({
      label: c[0].toUpperCase() + c.slice(1),
      checked: ids.length === 1 && current === c,
      onClick: () => setLabel(ids, c),
    })),
  ];
}

/** New Item menu (bottom toolbar button and background context menu). */
export function newItemMenu(): ContextMenuItem[] {
  return [
    { label: "Sequence…", onClick: () => runCommand("file.newSequence") },
    { separator: true },
    { label: "Adjustment Layer…", onClick: () => runCommand("file.newAdjustmentLayer") },
    { label: "Bars and Tone…", onClick: () => runCommand("file.newBarsAndTone") },
    { label: "Black Video…", onClick: () => runCommand("file.newBlackVideo") },
    { label: "Color Matte…", onClick: () => runCommand("file.newColorMatte") },
    { label: "Transparent Video…", onClick: () => runCommand("project.newTransparentVideo") },
  ];
}

// ---------------------------------------------------------------- component

export default function ProjectPanel() {
  const project = useEditor((s) => s.project);
  const selected = useEditor((s) => s.selection.itemIds);
  const sourceAssetId = useEditor((s) => s.sourceAssetId);
  const [prefs, setPrefsState] = useState<Prefs>(loadPrefs);
  const [binId, setBinId] = useState<ID | null>(null);
  const [expanded, setExpanded] = useState<Set<ID>>(() => new Set());
  const [search, setSearch] = useState("");
  const [renaming, setRenaming] = useState<ID | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const anchor = useRef<ID | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const setPrefs = (fn: (p: Prefs) => Prefs) =>
    setPrefsState((p) => {
      const n = fn(p);
      savePrefs(n);
      return n;
    });

  // Navigated bin may vanish (deleted/undone).
  const bin = binId ? project.items.find((i) => i.id === binId && i.type === "bin") : null;
  useEffect(() => {
    if (binId && !bin) setBinId(null);
  }, [binId, bin]);
  useEffect(() => setCurrentBin(bin ? bin.id : null), [bin]);

  const usage = useMemo(() => usageCounts(project), [project.sequences]);
  const order = useMemo(() => new Map(project.items.map((it, i) => [it.id, i])), [project.items]);
  const children = useMemo(() => {
    const m = new Map<ID | null, ProjectItem[]>();
    for (const it of project.items) {
      const arr = m.get(it.parentId) ?? [];
      arr.push(it);
      m.set(it.parentId, arr);
    }
    return m;
  }, [project.items]);

  const sortKey = prefs.view === "list" ? prefs.sort.key : prefs.iconSort;
  const sortDir = prefs.view === "list" ? prefs.sort.dir : 1;
  const sortItems = (items: ProjectItem[]): ItemInfo[] => {
    const infos = items.map((it) => itemInfo(project, it));
    return infos.sort((a, b) => {
      // Bins first in list view, like Finder; user order respects manual arrangement.
      if (sortKey !== "user" && (a.kind === "bin") !== (b.kind === "bin")) return a.kind === "bin" ? -1 : 1;
      return sortDir * compare(sortValue(a, sortKey, usage, order), sortValue(b, sortKey, usage, order)) || compare(a.item.name, b.item.name);
    });
  };

  // Rows: list view = tree with twirled bins; icon/freeform = current bin only. Search flattens.
  const q = search.trim().toLowerCase();
  const rows: { info: ItemInfo; depth: number }[] = useMemo(() => {
    const out: { info: ItemInfo; depth: number }[] = [];
    const root = bin ? bin.id : null;
    if (q) {
      const scope = root ? collectItems(project, [root]).filter((i) => i.id !== root) : project.items;
      const matches = scope.filter((it) => {
        const info = itemInfo(project, it);
        return [it.name, info.mediaType, it.label ?? "", info.videoInfo, info.audioInfo].some((s) => s.toLowerCase().includes(q));
      });
      for (const info of sortItems(matches)) out.push({ info, depth: 0 });
      return out;
    }
    const walk = (parent: ID | null, depth: number) => {
      for (const info of sortItems(children.get(parent) ?? [])) {
        out.push({ info, depth });
        if (prefs.view === "list" && info.kind === "bin" && expanded.has(info.item.id)) walk(info.item.id, depth + 1);
      }
    };
    walk(root, 0);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, bin, q, prefs.view, prefs.sort, prefs.iconSort, expanded, children, usage]);

  const visibleIds = rows.map((r) => r.info.item.id);
  projectPanelApi.visibleIds = () => visibleIds;
  projectPanelApi.rename = (id) => setRenaming(id);
  projectPanelApi.focusSearch = () => searchRef.current?.focus();
  projectPanelApi.setView = (v) => setPrefs((p) => ({ ...p, view: v }));

  // ---- selection
  const onItemMouseDown = (e: React.MouseEvent, id: ID) => {
    soleAtMouseDown = selected.length === 1 && selected[0] === id ? id : null;
    if (e.button === 2 && selected.includes(id)) return;
    const mod = e.metaKey || e.ctrlKey;
    if (e.shiftKey && anchor.current && visibleIds.includes(anchor.current)) {
      const a = visibleIds.indexOf(anchor.current);
      const b = visibleIds.indexOf(id);
      const range = visibleIds.slice(Math.min(a, b), Math.max(a, b) + 1);
      ed().select({ itemIds: mod ? [...new Set([...selected, ...range])] : range });
    } else if (mod) {
      // Selection order matters for Automate to Sequence.
      ed().select({ itemIds: selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id] });
      anchor.current = id;
    } else {
      if (!selected.includes(id) || selected.length > 1) ed().select({ itemIds: [id] });
      anchor.current = id;
    }
  };

  const onItemMouseUp = (e: React.MouseEvent, id: ID) => {
    // Plain click on an item inside a multi-selection narrows to it (unless a drag happened).
    if (!e.shiftKey && !e.metaKey && !e.ctrlKey && e.button === 0 && selected.length > 1 && selected.includes(id)) ed().select({ itemIds: [id] });
  };

  const onOpen = (info: ItemInfo) => {
    if (info.kind === "bin") {
      if (prefs.view === "list") toggleExpand(info.item.id);
      else enterBin(info.item.id);
    } else openItem(info.item);
  };

  const enterBin = (id: ID | null) => {
    setBinId(id);
    setSearch("");
    ed().select({ itemIds: [] });
  };

  const toggleExpand = (id: ID) =>
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  // ---- drag & drop
  const onDragStart = (e: React.DragEvent, id: ID) => {
    const ids = selected.includes(id) ? selected : [id];
    if (!selected.includes(id)) ed().select({ itemIds: [id] });
    e.dataTransfer.setData(ITEMS_MIME, JSON.stringify(ids));
    e.dataTransfer.setData("text/plain", ids.map((i) => project.items.find((x) => x.id === i)?.name ?? i).join("\n"));
    e.dataTransfer.effectAllowed = "copyMove";
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    dragOffset.current = { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const dragOffset = useRef({ x: 0, y: 0 });

  /** Props that make an element a drop target (bins, breadcrumb, background). */
  const dropZone = (key: string, onItems: (ids: ID[], e: React.DragEvent) => void, onFiles?: (e: React.DragEvent) => void) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!hasItemsDrag(e) && !(onFiles && isFileDrag(e))) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = isFileDrag(e) ? "copy" : "move";
      if (dropTarget !== key) setDropTarget(key);
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropTarget((t) => (t === key ? null : t));
    },
    onDrop: (e: React.DragEvent) => {
      setDropTarget(null);
      if (onFiles && isFileDrag(e)) {
        e.preventDefault();
        e.stopPropagation();
        markDropHandled(e);
        onFiles(e);
        return;
      }
      const ids = readDraggedIds(e);
      if (!ids) return;
      e.preventDefault();
      e.stopPropagation();
      onItems(ids, e);
    },
  });

  const binDrop = (target: ID | null, key = `bin:${target}`) =>
    dropZone(key, (ids) => moveItemsToBin(ids, target), (e) => void importDrop(e.dataTransfer, target));

  // ---- context menus
  const itemMenu = (e: React.MouseEvent, info: ItemInfo) => {
    e.stopPropagation();
    const ids = selected.includes(info.item.id) ? selected : [info.item.id];
    if (!selected.includes(info.item.id)) ed().select({ itemIds: ids });
    const media = ids.filter((id) => project.media[id]);
    const items: ContextMenuItem[] = [];
    if (info.kind === "bin") items.push({ label: "Open Bin", onClick: () => enterBin(info.item.id) });
    else if (info.kind === "sequence") items.push({ label: "Open in Timeline", onClick: () => openItem(info.item) });
    else items.push({ label: "Open in Source Monitor", shortcut: "↩", onClick: () => openItem(info.item) });
    items.push(
      { separator: true },
      { label: "Rename", disabled: ids.length !== 1, onClick: () => setRenaming(info.item.id) },
      { label: "Label", submenu: labelSubmenu(ids) },
      { label: "New Bin from Selection", onClick: () => newBin(bin ? bin.id : null, ids) },
    );
    if (media.length) {
      items.push(
        { label: "New Sequence From Clip", onClick: () => newSequenceFromClips(media) },
        { separator: true },
        { label: "Proxy ▸ Create Proxies", onClick: () => media.forEach((id) => void api.createProxy(id).catch((er: Error) => ed().toast(er.message, "error"))) },
        { label: "Link Media…", onClick: () => ed().openDialog("linkMedia", { ids: media }) },
        { label: "Make Offline…", onClick: () => makeOffline(media) },
        { separator: true },
        { label: "Reveal in Finder", disabled: media.length !== 1, onClick: () => void api.revealFile(project.media[media[0]].path).catch((er: Error) => ed().toast(er.message, "error")) },
        { label: "Properties", disabled: media.length !== 1, onClick: () => ed().openDialog("mediaProperties", { id: media[0] }) },
      );
    }
    if (info.kind === "sequence") {
      items.push(
        { label: "Duplicate", onClick: () => duplicateSequence(info.item.id) },
        { label: "Sequence Settings…", onClick: () => ed().openDialog("sequenceSettings", { id: info.item.id }) },
      );
    }
    items.push({ separator: true }, { label: "Clear", shortcut: "⌫", onClick: () => deleteItems(ids) });
    showContextMenu(e, items);
  };

  const backgroundMenu = (e: React.MouseEvent) => {
    showContextMenu(e, [
      { label: "New Bin", onClick: () => newBin(bin ? bin.id : null) },
      { label: "New Item", submenu: newItemMenu() },
      { separator: true },
      { label: "Import…", onClick: () => openFilePicker({ binId: bin ? bin.id : null }) },
      { label: "Import Folder…", onClick: () => openFilePicker({ binId: bin ? bin.id : null, folders: true }) },
      { separator: true },
      { label: "Find…", onClick: () => searchRef.current?.focus() },
      {
        label: "View",
        submenu: [
          { label: "List", checked: prefs.view === "list", onClick: () => setPrefs((p) => ({ ...p, view: "list" })) },
          { label: "Icon", checked: prefs.view === "icon", onClick: () => setPrefs((p) => ({ ...p, view: "icon" })) },
          { label: "Freeform", checked: prefs.view === "freeform", onClick: () => setPrefs((p) => ({ ...p, view: "freeform" })) },
        ],
      },
    ]);
  };

  // ---- breadcrumb
  const crumbs: ProjectItem[] = [];
  for (let b = bin; b; b = b.parentId ? project.items.find((i) => i.id === b!.parentId) : undefined) crumbs.unshift(b);

  const empty = !rows.length;
  const itemCount = (children.get(bin ? bin.id : null) ?? []).length;
  const selCount = selected.filter((id) => visibleIds.includes(id)).length;

  const common = {
    rows, selected, renaming, sourceAssetId, usage, dropTarget,
    onItemMouseDown, onItemMouseUp, onOpen, onDragStart, itemMenu, binDrop, setRenaming,
  };

  return (
    <div className="project-panel" onContextMenu={backgroundMenu}>
      <div className="pp-top">
        <div className="pp-crumbs">
          <span className={"pp-crumb" + (dropTarget === "crumb:root" ? " drop" : "")} onClick={() => enterBin(null)} {...binDrop(null, "crumb:root")} title="Project root">
            {project.name}.prproj
          </span>
          {crumbs.map((c) => (
            <span key={c.id} className="row">
              <ChevronRight size={12} className="muted" />
              <span className={"pp-crumb" + (dropTarget === `crumb:${c.id}` ? " drop" : "")} onClick={() => enterBin(c.id)} {...binDrop(c.id, `crumb:${c.id}`)}>
                {c.name}
              </span>
            </span>
          ))}
        </div>
        <div className="pp-search">
          <Search size={12} />
          <input
            ref={searchRef}
            value={search}
            placeholder="Search"
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Escape") {
                setSearch("");
                (e.target as HTMLInputElement).blur();
              }
            }}
          />
          {search ? <X size={12} className="pp-search-clear" onClick={() => setSearch("")} /> : null}
        </div>
        <span className="pp-count muted">
          {selCount ? `${selCount} of ${itemCount} items selected` : `${itemCount} item${itemCount === 1 ? "" : "s"}`}
        </span>
      </div>

      <div
        ref={bodyRef}
        className={"pp-body" + (dropTarget === "body" ? " drop" : "")}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains("pp-grid") || (e.target as HTMLElement).classList.contains("pp-list-rows")) ed().select({ itemIds: [] });
        }}
        onDoubleClick={(e) => {
          // Premiere: double-click empty Project panel space opens the Import dialog.
          const t = e.target as HTMLElement;
          if (t === e.currentTarget || t.classList.contains("pp-grid") || t.classList.contains("pp-list-rows") || t.classList.contains("pp-freeform")) openFilePicker({ binId: bin ? bin.id : null });
        }}
        {...dropZone("body", (ids, e) => {
          if (prefs.view === "freeform") placeFreeform(ids, e);
          else moveItemsToBin(ids, bin ? bin.id : null);
        }, (e) => void importDrop(e.dataTransfer, bin ? bin.id : null))}
      >
        {empty && !q ? (
          <div className="pp-empty">
            <Upload size={28} />
            <div className="pp-empty-title">Import media to start</div>
            <div className="muted">Drag files or folders here, or</div>
            <button className="btn primary" onClick={() => openFilePicker({ binId: bin ? bin.id : null })}>Import…</button>
            <div className="muted small">Double-click this area or press {navigator.platform.includes("Mac") ? "⌘I" : "Ctrl+I"}</div>
          </div>
        ) : empty ? (
          <div className="pp-empty muted">No items match “{search}”</div>
        ) : prefs.view === "list" ? (
          <ListView {...common} prefs={prefs} setPrefs={setPrefs} expanded={expanded} toggleExpand={toggleExpand} />
        ) : prefs.view === "icon" ? (
          <IconView {...common} zoom={prefs.zoom} reorder={prefs.iconSort === "user"} />
        ) : (
          <FreeformView {...common} zoom={prefs.zoom} positions={prefs.freeform[bin ? bin.id : "root"] ?? {}} />
        )}
      </div>

      <div className="pp-toolbar">
        <span className="pp-lock">
          <IconButton title="Project is writable" disabled>
            <Lock size={13} />
          </IconButton>
        </span>
        <IconButton title="List View (Ctrl+Page Up)" active={prefs.view === "list"} onClick={() => setPrefs((p) => ({ ...p, view: "list" }))}>
          <List size={15} />
        </IconButton>
        <IconButton title="Icon View (Ctrl+Page Down)" active={prefs.view === "icon"} onClick={() => setPrefs((p) => ({ ...p, view: "icon" }))}>
          <LayoutGrid size={15} />
        </IconButton>
        <IconButton title="Freeform View" active={prefs.view === "freeform"} onClick={() => setPrefs((p) => ({ ...p, view: "freeform" }))}>
          <LayoutDashboard size={15} />
        </IconButton>
        <span className="pp-zoom">
          <Slider value={prefs.zoom} min={80} max={320} step={1} onChange={(v) => setPrefs((p) => ({ ...p, zoom: v, view: p.view === "list" ? "icon" : p.view }))} />
        </span>
        <IconButton
          title="Sort Icons"
          disabled={prefs.view === "list"}
          onClick={(e) =>
            showContextMenu(
              { clientX: e.clientX, clientY: e.clientY - 4, preventDefault: () => {} },
              (["user", "name", "label", "type", "fps", "duration", "videoInfo", "audioInfo", "usage"] as SortKey[]).map((k) => ({
                label: SORT_LABELS[k],
                checked: prefs.iconSort === k,
                onClick: () => setPrefs((p) => ({ ...p, iconSort: k })),
              })),
            )
          }
        >
          <ArrowUpDown size={14} />
        </IconButton>
        <div className="spacer" />
        <IconButton
          title="Automate to Sequence"
          disabled={!selected.some((id) => project.media[id] || project.items.find((i) => i.id === id)?.type === "bin")}
          onClick={() => openAutomate(visibleIds)}
        >
          <ListVideo size={15} />
        </IconButton>
        <IconButton title="Find (Ctrl+F)" onClick={() => searchRef.current?.focus()}>
          <Search size={14} />
        </IconButton>
        <span className={"pp-drop-btn" + (dropTarget === "newbin" ? " drop" : "")} {...dropZone("newbin", (ids) => newBin(bin ? bin.id : null, ids))}>
          <IconButton title="New Bin (drop items here to create a bin from them)" onClick={() => newBin(bin ? bin.id : null)}>
            <FolderPlus size={15} />
          </IconButton>
        </span>
        <span
          className={"pp-drop-btn" + (dropTarget === "newitem" ? " drop" : "")}
          {...dropZone("newitem", (ids) => {
            // Premiere: dropping a clip on New Item makes a sequence matching it.
            const media = ids.filter((id) => project.media[id]);
            if (media.length) newSequenceFromClips(media);
          })}
        >
          <IconButton
            title="New Item (drop a clip here for a matching sequence)"
            onClick={(e) => {
              const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
              showContextMenu({ clientX: r.left, clientY: r.top - 190, preventDefault: () => {} }, newItemMenu());
            }}
          >
            <FilePlus2 size={15} />
          </IconButton>
        </span>
        <IconButton title="Clear (Backspace)" disabled={!selected.length} onClick={() => deleteItems(selected)}>
          <Trash2 size={14} />
        </IconButton>
      </div>
    </div>
  );

  function placeFreeform(ids: ID[], e: React.DragEvent) {
    const body = bodyRef.current;
    if (!body) return;
    const r = body.getBoundingClientRect();
    const key = bin ? bin.id : "root";
    const x0 = e.clientX - r.left + body.scrollLeft - dragOffset.current.x;
    const y0 = e.clientY - r.top + body.scrollTop - dragOffset.current.y;
    const inBin = ids.filter((id) => project.items.find((i) => i.id === id)?.parentId === (bin ? bin.id : null));
    if (inBin.length !== ids.length) moveItemsToBin(ids, bin ? bin.id : null);
    setPrefs((p) => {
      const cur = { ...(p.freeform[key] ?? {}) };
      const base = cur[ids[0]];
      ids.forEach((id, i) => {
        const old = cur[id];
        // Moving a group keeps relative offsets; new items cascade.
        cur[id] = base && old ? { x: Math.max(0, x0 + old.x - base.x), y: Math.max(0, y0 + old.y - base.y) } : { x: Math.max(0, x0 + i * 16), y: Math.max(0, y0 + i * 16) };
      });
      return { ...p, freeform: { ...p.freeform, [key]: cur } };
    });
  }
}

/** Automate to Sequence for the selection (bins expand), with both orderings available to the dialog. */
export function openAutomate(visibleOrder: ID[]): void {
  const p = ed().project;
  const sel = ed().selection.itemIds;
  const expand = (ids: ID[]) => ids.flatMap((id) => collectItems(p, [id]).filter((i) => i.type === "media").map((i) => i.id));
  const sortOrder = expand(visibleOrder.filter((id) => sel.includes(id)));
  const selectionOrder = expand(sel);
  if (!selectionOrder.length) return ed().toast("Select clips or bins to automate to sequence");
  ed().openDialog("automateToSequence", { sortOrder, selectionOrder });
}

// ---------------------------------------------------------------- views

interface ViewProps {
  rows: { info: ItemInfo; depth: number }[];
  selected: ID[];
  renaming: ID | null;
  sourceAssetId: ID | null;
  usage: Map<ID, number>;
  dropTarget: string | null;
  onItemMouseDown: (e: React.MouseEvent, id: ID) => void;
  onItemMouseUp: (e: React.MouseEvent, id: ID) => void;
  onOpen: (info: ItemInfo) => void;
  onDragStart: (e: React.DragEvent, id: ID) => void;
  itemMenu: (e: React.MouseEvent, info: ItemInfo) => void;
  binDrop: (target: ID | null, key?: string) => Record<string, unknown>;
  setRenaming: (id: ID | null) => void;
}

/**
 * Premiere/Finder rename gesture: click the name of the item that is already
 * the sole selection, then wait (no double-click) -> inline rename.
 */
let renameTimer: ReturnType<typeof setTimeout> | null = null;
/** Item that was the sole selection when the current mouse press began. */
let soleAtMouseDown: ID | null = null;
function slowClickRename(id: ID, start: (id: ID) => void) {
  return {
    onClick: (e: React.MouseEvent) => {
      if (soleAtMouseDown !== id || e.metaKey || e.ctrlKey || e.shiftKey || e.detail > 1) return;
      if (renameTimer) clearTimeout(renameTimer);
      renameTimer = setTimeout(() => start(id), 550);
    },
    onDoubleClick: () => {
      if (renameTimer) clearTimeout(renameTimer);
      renameTimer = null;
    },
  };
}

function NameEditor(props: { item: ProjectItem; onDone: () => void }) {
  const [v, setV] = useState(props.item.name);
  return (
    <input
      className="pp-rename"
      autoFocus
      value={v}
      onFocus={(e) => e.target.select()}
      onChange={(e) => setV(e.target.value)}
      onMouseDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onBlur={() => {
        renameItem(props.item.id, v);
        props.onDone();
      }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") props.onDone();
      }}
    />
  );
}

function ListView(props: ViewProps & { prefs: Prefs; setPrefs: (fn: (p: Prefs) => Prefs) => void; expanded: Set<ID>; toggleExpand: (id: ID) => void }) {
  const { prefs, setPrefs } = props;
  const seqFps = useEditor((s) => (s.project.activeSequenceId ? s.project.sequences[s.project.activeSequenceId]?.settings.fps : undefined)) ?? 30;
  const template = COLUMNS.map((c) => `${prefs.cols[c.key] ?? 100}px`).join(" ");
  const startResize = (e: React.PointerEvent, key: string) => {
    e.preventDefault();
    e.stopPropagation();
    const x0 = e.clientX;
    const w0 = prefs.cols[key] ?? 100;
    const move = (ev: PointerEvent) => setPrefs((p) => ({ ...p, cols: { ...p.cols, [key]: Math.max(40, w0 + ev.clientX - x0) } }));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  return (
    <div className="pp-list" style={{ ["--pp-cols" as string]: template }}>
      <div className="pp-list-head">
        {COLUMNS.map((c) => (
          <div
            key={c.key}
            className={"pp-th" + (c.align === "right" ? " right" : "") + (prefs.sort.key === c.key ? " sorted" : "")}
            onClick={() => setPrefs((p) => ({ ...p, sort: { key: c.key, dir: p.sort.key === c.key ? (p.sort.dir === 1 ? -1 : 1) : 1 } }))}
          >
            <span>{c.title}</span>
            {prefs.sort.key === c.key ? <span className="pp-sort-arrow">{prefs.sort.dir === 1 ? "▲" : "▼"}</span> : null}
            <span className="pp-col-resize" onPointerDown={(e) => startResize(e, c.key)} onClick={(e) => e.stopPropagation()} />
          </div>
        ))}
      </div>
      <div className="pp-list-rows">
        {props.rows.map(({ info, depth }) => {
          const id = info.item.id;
          const a = info.asset;
          const fps = a ? mediaFps(a, seqFps) : info.fps ?? seqFps;
          const sel = props.selected.includes(id);
          const isBin = info.kind === "bin";
          const binDrop = isBin ? props.binDrop(id) : {};
          const usage = props.usage.get(id);
          return (
            <div
              key={id}
              className={"pp-row" + (sel ? " selected" : "") + (props.dropTarget === `bin:${id}` ? " drop" : "") + (a?.status === "error" ? " offline" : "")}
              draggable={props.renaming !== id}
              onDragStart={(e) => props.onDragStart(e, id)}
              onMouseDown={(e) => props.onItemMouseDown(e, id)}
              onMouseUp={(e) => props.onItemMouseUp(e, id)}
              onDoubleClick={() => props.onOpen(info)}
              onContextMenu={(e) => props.itemMenu(e, info)}
              {...binDrop}
            >
              <div className="pp-td name" style={{ paddingLeft: 6 + depth * 16 }}>
                <span
                  className={"twirl" + (props.expanded.has(id) ? " open" : "")}
                  style={{ visibility: isBin ? "visible" : "hidden" }}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={() => props.toggleExpand(id)}
                >
                  ▸
                </span>
                <LabelChip label={info.item.label} />
                <ItemIcon info={info} open={props.expanded.has(id)} />
                {props.renaming === id ? (
                  <NameEditor item={info.item} onDone={() => props.setRenaming(null)} />
                ) : (
                  <span className={"pp-name" + (props.sourceAssetId === id ? " in-source" : "")} {...slowClickRename(id, props.setRenaming)}>
                    {info.item.name}
                  </span>
                )}
                <StatusBadge asset={a} />
              </div>
              <div className="pp-td right">{info.fps ? `${info.fps} fps` : ""}</div>
              <div className="pp-td right mono">{isBin ? "" : formatTimecode(0, fps)}</div>
              <div className="pp-td right mono">{isBin || !info.duration ? "" : formatTimecode(Math.max(0, info.duration - 1 / fps), fps)}</div>
              <div className="pp-td right mono">{isBin || !info.duration ? "" : formatTimecode(info.duration, fps)}</div>
              <div className="pp-td">{info.videoInfo}</div>
              <div className="pp-td">{info.audioInfo}</div>
              <div className="pp-td right">{usage ?? ""}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Card(props: ViewProps & { info: ItemInfo; zoom: number; reorder?: boolean; style?: React.CSSProperties; extraDrop?: Record<string, unknown> }) {
  const { info, zoom } = props;
  const id = info.item.id;
  const a = info.asset;
  const [scrubT, setScrubT] = useState<number | null>(null);
  const sel = props.selected.includes(id);
  const isBin = info.kind === "bin";
  const usage = props.usage.get(id);
  const fps = info.fps ?? 30;
  const thumbH = Math.round((zoom * 9) / 16);
  const children = useEditor((s) => (isBin ? s.project.items.filter((i) => i.parentId === id).length : 0));
  let thumb: ReactNode;
  if (a) {
    thumb =
      a.kind === "audio" ? (
        <div className="pp-thumb-audio" style={{ width: zoom, height: thumbH }}>
          <MiniWave asset={a} width={zoom - 12} height={thumbH - 16} />
        </div>
      ) : (
        <div className="pp-thumb-box" style={{ width: zoom, height: thumbH }}>
          <SpriteThumb asset={a} width={zoom} scrub={a.kind === "video"} onScrub={setScrubT} />
        </div>
      );
  } else if (info.kind === "sequence" && info.seq) {
    thumb = (
      <div className="pp-thumb-seq" style={{ width: zoom, height: thumbH }}>
        <ItemIcon info={info} size={Math.max(20, zoom / 5)} />
        <span className="muted">{info.seq.settings.width}×{info.seq.settings.height}</span>
      </div>
    );
  } else {
    thumb = (
      <div className="pp-thumb-bin" style={{ width: zoom, height: thumbH }}>
        <ItemIcon info={info} size={Math.max(24, zoom / 4)} />
        <span className="muted">{children} item{children === 1 ? "" : "s"}</span>
      </div>
    );
  }
  return (
    <div
      className={"pp-card" + (sel ? " selected" : "") + (props.dropTarget === `bin:${id}` || props.dropTarget === `before:${id}` ? " drop" : "") + (a?.status === "error" ? " offline" : "")}
      style={{ width: zoom + 8, ...props.style }}
      draggable={props.renaming !== id}
      onDragStart={(e) => props.onDragStart(e, id)}
      onMouseDown={(e) => props.onItemMouseDown(e, id)}
      onMouseUp={(e) => props.onItemMouseUp(e, id)}
      onDoubleClick={() => props.onOpen(info)}
      onContextMenu={(e) => props.itemMenu(e, info)}
      {...(isBin ? props.binDrop(id) : props.extraDrop ?? {})}
    >
      <div className="pp-card-thumb">
        {thumb}
        <div className="pp-card-badges">
          {a?.hasAudio && a.kind === "video" ? <AudioLines size={11} /> : null}
          {usage ? <span className="pp-usage" title={`Used ${usage}×`}>{usage}</span> : null}
        </div>
        {!isBin && info.duration ? <span className="pp-card-dur">{formatTimecode(scrubT ?? info.duration, fps)}</span> : null}
        <div className="pp-card-status">
          <StatusBadge asset={a} compact={zoom < 120} />
        </div>
      </div>
      <div className="pp-card-name">
        <ItemIcon info={info} size={12} />
        <LabelChip label={info.item.label} />
        {props.renaming === id ? (
          <NameEditor item={info.item} onDone={() => props.setRenaming(null)} />
        ) : (
          <span className="pp-name" title={info.item.name} {...slowClickRename(id, props.setRenaming)}>
            {info.item.name}
          </span>
        )}
      </div>
    </div>
  );
}

function IconView(props: ViewProps & { zoom: number; reorder: boolean }) {
  return (
    <div className="pp-grid">
      {props.rows.map(({ info }) => (
        <Card
          key={info.item.id}
          {...props}
          info={info}
          extraDrop={props.reorder ? reorderDrop(info.item.id) : undefined}
        />
      ))}
    </div>
  );
}

/** In User Order icon view, dropping onto a clip moves the dragged items before it. */
function reorderDrop(targetId: ID) {
  return {
    onDragOver: (e: React.DragEvent) => {
      if (!hasItemsDrag(e)) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "move";
    },
    onDrop: (e: React.DragEvent) => {
      const ids = readDraggedIds(e);
      if (!ids || ids.includes(targetId)) return;
      e.preventDefault();
      e.stopPropagation();
      ed().apply("Reorder Items", (d) => {
        const target = d.items.find((i) => i.id === targetId);
        if (!target) return;
        const moving = d.items.filter((i) => ids.includes(i.id));
        d.items = d.items.filter((i) => !ids.includes(i.id));
        for (const m of moving) m.parentId = target.parentId;
        d.items.splice(d.items.findIndex((i) => i.id === targetId), 0, ...moving);
      });
    },
  };
}

function FreeformView(props: ViewProps & { zoom: number; positions: Record<ID, { x: number; y: number }> }) {
  const cols = 4;
  const w = props.zoom + 24;
  const h = Math.round((props.zoom * 9) / 16) + 48;
  let maxX = 0;
  let maxY = 0;
  const placed = props.rows.map(({ info }, i) => {
    const pos = props.positions[info.item.id] ?? { x: 12 + (i % cols) * w, y: 12 + Math.floor(i / cols) * h };
    maxX = Math.max(maxX, pos.x + w);
    maxY = Math.max(maxY, pos.y + h);
    return { info, pos };
  });
  return (
    <div className="pp-freeform" style={{ width: maxX + 40, height: maxY + 40 }}>
      {placed.map(({ info, pos }) => (
        <Card key={info.item.id} {...props} info={info} style={{ position: "absolute", left: pos.x, top: pos.y }} />
      ))}
    </div>
  );
}
