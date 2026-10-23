// Media Browser (Premiere: Window > Media Browser, Shift+8). Browses the
// server machine's file system: favorites, back/forward/up, path bar, list or
// thumbnail view, type filter. Double-click imports by path (no copy) and opens
// the clip in the Source Monitor.
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUp, Folder, Film, AudioLines, Image as ImageIcon, LayoutGrid, List, RefreshCw, Star, HardDrive, Home, Monitor, Download, Clapperboard, FileText, Music } from "lucide-react";
import type { ReactNode } from "react";
import { api } from "../../api";
import { useEditor } from "../../store/store";
import { openPanel } from "../../dock";
import { IconButton, Select, Slider, showContextMenu } from "../../ui/kit";
import { findAssetByPath, importPaths, mediaKindOfName } from "../../projectIO";
import { fmtBytes } from "./common";

const ed = () => useEditor.getState();

export interface FsEntry {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
}

// ---------------------------------------------------------------- shared browsing state

const FAV_KEY = "editcut.mediaBrowser.favorites";
const RECENT_DIRS_KEY = "editcut.mediaBrowser.recentDirs";
const LAST_DIR_KEY = "editcut.mediaBrowser.dir";

let homeDir: string | null = null;
/** Resolve the server user's home directory once (api.browse() defaults to it). */
export function useHomeDir(): string | null {
  const [home, setHome] = useState(homeDir);
  useEffect(() => {
    if (homeDir) return;
    api.browse().then((r) => {
      homeDir = r.dir;
      setHome(r.dir);
    }).catch(() => {});
  }, []);
  return home;
}

export function standardLocations(home: string | null): { name: string; path: string; icon: ReactNode }[] {
  if (!home) return [];
  return [
    { name: "Home", path: home, icon: <Home size={13} /> },
    { name: "Desktop", path: `${home}/Desktop`, icon: <Monitor size={13} /> },
    { name: "Downloads", path: `${home}/Downloads`, icon: <Download size={13} /> },
    { name: "Movies", path: `${home}/Movies`, icon: <Clapperboard size={13} /> },
    { name: "Music", path: `${home}/Music`, icon: <Music size={13} /> },
    { name: "Pictures", path: `${home}/Pictures`, icon: <ImageIcon size={13} /> },
    { name: "Documents", path: `${home}/Documents`, icon: <FileText size={13} /> },
    { name: "Volumes", path: "/Volumes", icon: <HardDrive size={13} /> },
  ];
}

function readList(key: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "[]") as string[];
  } catch {
    return [];
  }
}

function writeList(key: string, list: string[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function recentDirs(): string[] {
  return readList(RECENT_DIRS_KEY);
}

export function pushRecentDir(dir: string): void {
  writeList(RECENT_DIRS_KEY, [dir, ...recentDirs().filter((d) => d !== dir)].slice(0, 8));
}

/** Directory listing with history (back/forward), shared by Media Browser and Import mode. */
export function useBrowser(initial?: string | null) {
  const [dir, setDir] = useState<string | null>(initial ?? null);
  const [listing, setListing] = useState<{ dir: string; parent: string | null; entries: FsEntry[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hist, setHist] = useState<{ back: string[]; fwd: string[] }>({ back: [], fwd: [] });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api
      .browse(dir ?? undefined)
      .then((r) => {
        if (!alive) return;
        setListing(r);
        setError(null);
        try {
          localStorage.setItem(LAST_DIR_KEY, r.dir);
        } catch {
          /* ignore */
        }
      })
      .catch((e: Error) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [dir, tick]);

  const go = useCallback(
    (d: string) => {
      if (listing && d === listing.dir) return;
      setHist((h) => ({ back: listing ? [...h.back, listing.dir] : h.back, fwd: [] }));
      setDir(d);
    },
    [listing],
  );
  const back = () => {
    const prev = hist.back[hist.back.length - 1];
    if (!prev) return;
    setHist((h) => ({ back: h.back.slice(0, -1), fwd: listing ? [listing.dir, ...h.fwd] : h.fwd }));
    setDir(prev);
  };
  const forward = () => {
    const next = hist.fwd[0];
    if (!next) return;
    setHist((h) => ({ back: listing ? [...h.back, listing.dir] : h.back, fwd: h.fwd.slice(1) }));
    setDir(next);
  };
  return {
    dir: listing?.dir ?? dir ?? "", listing, error, loading, go, back, forward,
    canBack: hist.back.length > 0, canForward: hist.fwd.length > 0,
    refresh: () => setTick((t) => t + 1),
  };
}

export function lastBrowsedDir(): string | null {
  try {
    return localStorage.getItem(LAST_DIR_KEY);
  } catch {
    return null;
  }
}

/** Poster frame of a server file (videos/images), lazily loaded. */
export function FsThumb(props: { entry: FsEntry; width?: number }) {
  const kind = props.entry.isDir ? null : mediaKindOfName(props.entry.name);
  const [failed, setFailed] = useState(false);
  let icon: ReactNode = <Film size={22} />;
  if (props.entry.isDir) icon = <Folder size={28} />;
  else if (kind === "audio") icon = <AudioLines size={22} style={{ color: "var(--clip-audio)" }} />;
  else if (kind === "image") icon = <ImageIcon size={22} />;
  const showImg = !props.entry.isDir && kind !== "audio" && !failed;
  return (
    <div className="mb-thumb">
      {showImg ? (
        <img loading="lazy" draggable={false} src={`/api/media/fs-thumb?path=${encodeURIComponent(props.entry.path)}&w=${props.width ?? 240}`} onError={() => setFailed(true)} alt="" />
      ) : (
        icon
      )}
    </div>
  );
}

/** Import (if needed) by path and load into the Source Monitor. */
export async function importAndPreview(path: string): Promise<void> {
  let asset = findAssetByPath(path);
  if (!asset) {
    pushRecentDir(path.slice(0, path.lastIndexOf("/")) || "/");
    [asset] = await importPaths([path]);
  }
  if (asset) {
    ed().setUI({ sourceAssetId: asset.id, focusedMonitor: "source" });
    openPanel("source");
  }
}

// ---------------------------------------------------------------- panel

type Filter = "all" | "video" | "audio" | "image";

export default function MediaBrowserPanel() {
  const home = useHomeDir();
  const b = useBrowser(lastBrowsedDir());
  const media = useEditor((s) => s.project.media);
  const [view, setView] = useState<"grid" | "list">(() => (localStorage.getItem("editcut.mediaBrowser.view") as "grid" | "list") ?? "grid");
  const [size, setSize] = useState(130);
  const [filter, setFilter] = useState<Filter>("all");
  const [sel, setSel] = useState<string[]>([]);
  const [pathText, setPathText] = useState("");
  const [favs, setFavs] = useState<string[]>(() => readList(FAV_KEY));
  useEffect(() => setPathText(b.dir), [b.dir]);
  useEffect(() => setSel([]), [b.dir]);
  useEffect(() => {
    try {
      localStorage.setItem("editcut.mediaBrowser.view", view);
    } catch {
      /* ignore */
    }
  }, [view]);

  const importedPaths = useMemo(() => new Set(Object.values(media).map((m) => m.path)), [media]);
  const entries = (b.listing?.entries ?? []).filter((e) => e.isDir || filter === "all" || mediaKindOfName(e.name) === filter);
  const files = entries.filter((e) => !e.isDir);

  const open = (e: FsEntry) => {
    if (e.isDir) b.go(e.path);
    else void importAndPreview(e.path);
  };
  const importSel = async (paths = sel) => {
    const fresh = paths.filter((p) => !importedPaths.has(p));
    if (!fresh.length) return ed().toast("Already imported");
    const assets = await importPaths(fresh, { folderBins: true });
    if (assets.length) ed().toast(`Imported ${assets.length} item${assets.length === 1 ? "" : "s"}`, "success");
  };
  const click = (e: React.MouseEvent, entry: FsEntry) => {
    if (e.metaKey || e.ctrlKey) setSel((s) => (s.includes(entry.path) ? s.filter((p) => p !== entry.path) : [...s, entry.path]));
    else if (e.shiftKey && sel.length) {
      const paths = entries.map((x) => x.path);
      const a = paths.indexOf(sel[sel.length - 1]);
      const z = paths.indexOf(entry.path);
      setSel(paths.slice(Math.min(a, z), Math.max(a, z) + 1));
    } else setSel([entry.path]);
  };
  const menu = (e: React.MouseEvent, entry: FsEntry) => {
    const paths = sel.includes(entry.path) ? sel : [entry.path];
    if (!sel.includes(entry.path)) setSel([entry.path]);
    showContextMenu(e, [
      { label: "Import", onClick: () => void importSel(paths) },
      { label: entry.isDir ? "Open Folder" : "Open in Source Monitor", onClick: () => open(entry) },
      { separator: true },
      { label: "Reveal in Finder", onClick: () => void api.revealFile(entry.path).catch((er: Error) => ed().toast(er.message, "error")) },
      {
        label: entry.isDir ? (favs.includes(entry.path) ? "Remove from Favorites" : "Add to Favorites") : "Add Folder to Favorites",
        onClick: () => {
          const d = entry.isDir ? entry.path : b.dir;
          const next = favs.includes(d) ? favs.filter((f) => f !== d) : [...favs, d];
          setFavs(next);
          writeList(FAV_KEY, next);
        },
      },
    ]);
  };

  const sideItem = (name: string, path: string, icon: ReactNode) => (
    <div key={path} className={"mb-side-item" + (b.dir === path ? " active" : "")} title={path} onClick={() => b.go(path)}>
      {icon} {name}
    </div>
  );

  return (
    <div className="media-browser">
      <div className="mb-bar">
        <IconButton title="Back" disabled={!b.canBack} onClick={b.back}><ArrowLeft size={14} /></IconButton>
        <IconButton title="Forward" disabled={!b.canForward} onClick={b.forward}><ArrowRight size={14} /></IconButton>
        <IconButton title="Up one level" disabled={!b.listing?.parent} onClick={() => b.listing?.parent && b.go(b.listing.parent)}><ArrowUp size={14} /></IconButton>
        <div className="mb-path">
          <input
            className="text-input"
            value={pathText}
            onChange={(e) => setPathText(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") b.go(pathText.trim());
            }}
          />
        </div>
        <IconButton title="Refresh" onClick={b.refresh}><RefreshCw size={13} className={b.loading ? "spin" : ""} /></IconButton>
      </div>
      <div className="mb-main">
        <div className="mb-side">
          {favs.length ? <div className="mb-side-title">Favorites</div> : null}
          {favs.map((f) => sideItem(f.split("/").pop() || f, f, <Star size={13} />))}
          <div className="mb-side-title">Local</div>
          {standardLocations(home).map((l) => sideItem(l.name, l.path, l.icon))}
          {recentDirs().length ? <div className="mb-side-title">Recent</div> : null}
          {recentDirs().slice(0, 5).map((d) => sideItem(d.split("/").pop() || d, d, <Folder size={13} />))}
        </div>
        <div className="mb-files" onMouseDown={(e) => e.target === e.currentTarget && setSel([])}>
          {b.error ? (
            <div className="panel-empty" style={{ color: "var(--danger)" }}>{b.error}</div>
          ) : !entries.length && !b.loading ? (
            <div className="panel-empty">No media files in this folder</div>
          ) : view === "grid" ? (
            <div className="mb-grid" style={{ ["--mb-w" as string]: `${size}px` }}>
              {entries.map((e) => (
                <div
                  key={e.path}
                  className={"mb-card" + (sel.includes(e.path) ? " selected" : "")}
                  onClick={(ev) => click(ev, e)}
                  onDoubleClick={() => open(e)}
                  onContextMenu={(ev) => menu(ev, e)}
                  title={e.path}
                >
                  <div style={{ position: "relative" }}>
                    <FsThumb entry={e} width={Math.max(160, size * 2)} />
                    {importedPaths.has(e.path) ? <span className="mb-imported">In project</span> : null}
                  </div>
                  <div className="mb-name">{e.name}</div>
                  <div className="mb-meta">{e.isDir ? "Folder" : fmtBytes(e.size)}</div>
                </div>
              ))}
            </div>
          ) : (
            <div>
              {entries.map((e) => {
                const kind = e.isDir ? null : mediaKindOfName(e.name);
                return (
                  <div
                    key={e.path}
                    className={"mb-list-row" + (sel.includes(e.path) ? " selected" : "")}
                    onClick={(ev) => click(ev, e)}
                    onDoubleClick={() => open(e)}
                    onContextMenu={(ev) => menu(ev, e)}
                    title={e.path}
                  >
                    {e.isDir ? <Folder size={13} className="pi-icon bin" /> : kind === "audio" ? <AudioLines size={13} className="pi-icon audio" /> : kind === "image" ? <ImageIcon size={13} className="pi-icon image" /> : <Film size={13} className="pi-icon video" />}
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {e.name} {importedPaths.has(e.path) ? <span className="muted small">· in project</span> : null}
                    </span>
                    <span className="muted">{e.isDir ? "Folder" : kind}</span>
                    <span className="muted" style={{ textAlign: "right" }}>{e.isDir ? "" : fmtBytes(e.size)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <div className="mb-status">
        <IconButton title="List View" active={view === "list"} onClick={() => setView("list")}><List size={14} /></IconButton>
        <IconButton title="Thumbnail View" active={view === "grid"} onClick={() => setView("grid")}><LayoutGrid size={14} /></IconButton>
        {view === "grid" ? <Slider value={size} min={90} max={260} step={1} onChange={setSize} style={{ maxWidth: 80 }} /> : null}
        <Select<Filter>
          value={filter}
          options={[{ value: "all", label: "All Supported Files" }, { value: "video", label: "Video Files" }, { value: "audio", label: "Audio Files" }, { value: "image", label: "Image Files" }]}
          onChange={setFilter}
        />
        <div className="spacer" />
        <span>{sel.length ? `${sel.length} selected` : `${files.length} file${files.length === 1 ? "" : "s"}`}</span>
        <button
          className="btn small primary"
          disabled={!sel.length}
          onClick={() => {
            pushRecentDir(b.dir);
            void importSel();
          }}
        >
          Import
        </button>
      </div>
    </div>
  );
}
