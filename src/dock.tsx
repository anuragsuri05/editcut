// Dockable panel layout (dockview) + workspace management.
import { useEffect, useMemo } from "react";
import { DockviewReact, type DockviewApi, type DockviewReadyEvent, type IDockviewPanelProps } from "dockview-react";
import { PANELS } from "./panels/registry";
import { WORKSPACES } from "./workspaces";
import { useEditor } from "./store/store";

let dockApi: DockviewApi | null = null;
let currentWorkspace = "editing";
const LAYOUT_KEY = (ws: string) => `editcut.layout.v2.${ws}`;

export function getDockApi(): DockviewApi | null {
  return dockApi;
}

export function getCurrentWorkspace(): string {
  return currentWorkspace;
}

function saveLayout() {
  if (!dockApi) return;
  try {
    localStorage.setItem(LAYOUT_KEY(currentWorkspace), JSON.stringify(dockApi.toJSON()));
    localStorage.setItem("editcut.workspace", currentWorkspace);
  } catch {
    /* ignore */
  }
}

/** Switch workspace, restoring the user's modified arrangement if any. */
export function setWorkspace(id: string, reset = false): void {
  if (!dockApi) return;
  saveLayout();
  currentWorkspace = id;
  dockApi.clear();
  const saved = reset ? null : localStorage.getItem(LAYOUT_KEY(id));
  if (saved) {
    try {
      dockApi.fromJSON(JSON.parse(saved));
      window.dispatchEvent(new CustomEvent("editcut:workspace", { detail: id }));
      return;
    } catch {
      /* fall through to default */
    }
  }
  WORKSPACES.find((w) => w.id === id)?.build(dockApi);
  saveLayout();
  window.dispatchEvent(new CustomEvent("editcut:workspace", { detail: id }));
}

/** Open (or focus) a panel by id. */
export function openPanel(id: string): void {
  if (!dockApi || !PANELS[id]) return;
  const existing = dockApi.getPanel(id);
  if (existing) {
    existing.api.setActive();
    return;
  }
  // dock as a tab next to related panels (like Premiere); float only if none are open
  const ref = (DOCK_NEAR[id] ?? []).find((r) => dockApi!.getPanel(r));
  if (ref) dockApi.addPanel({ id, component: id, title: PANELS[id].title, position: { referencePanel: ref, direction: "within" } });
  else dockApi.addPanel({ id, component: id, title: PANELS[id].title, floating: { width: 420, height: 480 } });
}

/** Where a panel docks when opened: the first of these panels that is present. */
const INSPECTORS = ["properties", "essentialSound", "lumetri", "effectControls", "ai", "program"];
const BINS = ["project", "mediaBrowser", "effects", "markers", "history", "info"];
const DOCK_NEAR: Record<string, string[]> = {
  lumetri: INSPECTORS, essentialSound: INSPECTORS, properties: INSPECTORS, ai: INSPECTORS, audioMixer: ["effectControls", "source", ...INSPECTORS],
  effectControls: ["source", "lumetriScopes", ...INSPECTORS], lumetriScopes: ["source", "effectControls", ...INSPECTORS],
  effects: BINS, markers: BINS, history: BINS, info: BINS, mediaBrowser: BINS, project: BINS, exportQueue: BINS,
  text: ["timeline", ...BINS], timeline: ["text"], tools: [], audioMeters: [], source: ["effectControls", "program"], program: ["source"],
};

function PanelFrame(props: IDockviewPanelProps) {
  const id = props.api.id;
  const active = useEditor((s) => s.activePanel === id);
  const Comp = PANELS[id]?.component;
  return (
    <div
      className={"panel-frame" + (active ? " focused" : "")}
      onPointerDownCapture={() => {
        if (useEditor.getState().activePanel !== id) useEditor.getState().setUI({ activePanel: id });
      }}
    >
      {Comp ? <Comp /> : null}
    </div>
  );
}

export function Dock() {
  const components = useMemo(() => Object.fromEntries(Object.keys(PANELS).map((id) => [id, PanelFrame])), []);
  useEffect(() => () => saveLayout(), []);
  const onReady = (e: DockviewReadyEvent) => {
    dockApi = e.api;
    const ws = localStorage.getItem("editcut.workspace") ?? "editing";
    currentWorkspace = ws;
    const saved = localStorage.getItem(LAYOUT_KEY(ws));
    let ok = false;
    if (saved) {
      try {
        e.api.fromJSON(JSON.parse(saved));
        ok = true;
      } catch {
        ok = false;
      }
    }
    if (!ok) WORKSPACES.find((w) => w.id === ws)?.build(e.api);
    e.api.onDidLayoutChange(() => saveLayout());
  };
  return <DockviewReact className="dockview-theme-abyss editcut-dock" components={components} onReady={onReady} />;
}
