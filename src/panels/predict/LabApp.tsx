// Standalone Content Lab (?app=lab or /lab): the lab without the editor shell.
import { ArrowUpRight } from "lucide-react";
import { DialogHost } from "../../ui/dialogs";
import { ContextMenuHost } from "../../ui/kit";
import { useEditor } from "../../store/store";
import ContentLab from "./ContentLab";

export function isLabApp(): boolean {
  if (typeof location === "undefined") return false;
  return new URLSearchParams(location.search).get("app") === "lab" || /^\/lab\/?$/.test(location.pathname);
}

export default function LabApp() {
  const toasts = useEditor((s) => s.toasts);
  return (
    <div className="app lab-app">
      <div className="header lab-app-header">
        <div className="logo"><img className="logo-mark" src="/brand/logo-64.png" srcSet="/brand/logo-64.png 1x, /brand/logo-128.png 2x" alt="EditCut" /></div>
        <div className="lab-app-name">EditCut <span>Content Lab</span></div>
        <span className="spacer" />
        <a className="header-btn lab-app-link" href="/">
          Open the editor <ArrowUpRight size={13} />
        </a>
      </div>
      <div className="main">
        <ContentLab standalone />
      </div>
      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={"toast " + t.kind}>{t.text}</div>
        ))}
      </div>
      <DialogHost />
      <ContextMenuHost />
    </div>
  );
}
