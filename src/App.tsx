import { useEffect, useState } from "react";
import { Dock, setWorkspace, getCurrentWorkspace } from "./dock";
import { MenuBar } from "./ui/MenuBar";
import { DialogHost } from "./ui/dialogs";
import { ContextMenuHost, Progress } from "./ui/kit";
import { useEditor } from "./store/store";
import { WORKSPACES } from "./workspaces";
import { runCommand } from "./commands/registry";
import ImportMode from "./panels/project/ImportMode";
import ExportMode from "./panels/export/ExportMode";
import { Sparkles, Upload } from "lucide-react";

function Header() {
  const mode = useEditor((s) => s.mode);
  const setUI = useEditor((s) => s.setUI);
  const name = useEditor((s) => s.project.name);
  const dirty = useEditor((s) => s.dirty);
  const [ws, setWs] = useState(getCurrentWorkspace());
  useEffect(() => {
    const on = (e: Event) => setWs((e as CustomEvent<string>).detail);
    window.addEventListener("editcut:workspace", on);
    return () => window.removeEventListener("editcut:workspace", on);
  }, []);
  return (
    <div className="header">
      <div className="logo">
        <span className="logo-mark">Ec</span>
      </div>
      <div className="mode-tabs">
        {(["import", "edit", "export"] as const).map((m) => (
          <button key={m} className={"mode-tab" + (mode === m ? " active" : "")} onClick={() => setUI({ mode: m })}>
            {m[0].toUpperCase() + m.slice(1)}
          </button>
        ))}
      </div>
      <div className="project-title">
        {name}
        {dirty ? <span className="dirty-dot" title="Unsaved changes">●</span> : null}
      </div>
      <div className="workspace-tabs">
        {mode === "edit" &&
          WORKSPACES.map((w) => (
            <button key={w.id} className={"ws-tab" + (ws === w.id ? " active" : "")} onClick={() => setWorkspace(w.id)} onDoubleClick={() => setWorkspace(w.id, true)} title="Double-click to reset">
              {w.name}
            </button>
          ))}
      </div>
      <div className="header-actions">
        <button className="header-btn ai" onClick={() => runCommand("ai.openAssistant")} title="Ask Claude to edit (AI Assistant)">
          <Sparkles size={14} /> Ask Claude
        </button>
        <button className="header-btn" onClick={() => runCommand("file.export.quick")} title="Quick Export">
          <Upload size={14} />
        </button>
      </div>
    </div>
  );
}

function StatusBar() {
  const jobs = useEditor((s) => s.jobs);
  const toasts = useEditor((s) => s.toasts);
  const list = Object.entries(jobs);
  return (
    <>
      <div className="statusbar">
        {list.length ? (
          list.map(([id, j]) => (
            <div key={id} className="status-job">
              <span>{j.label}</span>
              <Progress value={j.progress} />
            </div>
          ))
        ) : (
          <span className="muted">Ready</span>
        )}
      </div>
      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={"toast " + t.kind}>
            {t.text}
          </div>
        ))}
      </div>
    </>
  );
}

export default function App() {
  const mode = useEditor((s) => s.mode);
  return (
    <div className="app">
      <MenuBar />
      <Header />
      <div className="main">
        <div className="dock-wrap" style={{ display: mode === "edit" ? "block" : "none" }}>
          <Dock />
        </div>
        {mode === "import" ? <ImportMode /> : null}
        {mode === "export" ? <ExportMode /> : null}
      </div>
      <StatusBar />
      <DialogHost />
      <ContextMenuHost />
    </div>
  );
}
