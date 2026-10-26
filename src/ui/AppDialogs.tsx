// App-level dialogs: Keyboard Shortcuts editor, About.
import { useMemo, useState } from "react";
import { registerDialog } from "./dialogs";
import { Button, Dialog, TextInput } from "./kit";
import { allCommands, eventToKey, keysFor, prettyKey, setUserKeys } from "../commands/registry";

function KeyboardShortcutsDialog({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  const [recording, setRecording] = useState<string | null>(null);
  const [, force] = useState(0);
  const cmds = useMemo(() => allCommands().sort((a, b) => a.id.localeCompare(b.id)), []);
  const list = cmds.filter((c) => !q || (c.label + " " + c.id).toLowerCase().includes(q.toLowerCase()) || keysFor(c.id).some((k) => k.toLowerCase().includes(q.toLowerCase())));
  return (
    <Dialog title="Keyboard Shortcuts" onClose={onClose} width={720} footer={<Button primary onClick={onClose}>OK</Button>}>
      <TextInput value={q} onChange={setQ} placeholder="Search commands or keys…" autoFocus style={{ width: "100%", marginBottom: 8 }} />
      <div className="shortcut-list">
        {list.map((c) => (
          <div key={c.id} className="shortcut-row">
            <span className="shortcut-label">{c.label}</span>
            <span className="muted shortcut-id">{c.id}{c.scope ? ` · ${c.scope}` : ""}</span>
            <span
              className={"shortcut-keys" + (recording === c.id ? " recording" : "")}
              tabIndex={0}
              onClick={() => setRecording(c.id)}
              onKeyDown={(e) => {
                if (recording !== c.id) return;
                e.preventDefault();
                e.stopPropagation();
                if (["Shift", "Alt", "Meta", "Control"].includes(e.key)) return;
                if (e.key === "Escape") return setRecording(null);
                if (e.key === "Backspace") setUserKeys(c.id, []);
                else setUserKeys(c.id, [eventToKey(e.nativeEvent)]);
                setRecording(null);
                force((n) => n + 1);
              }}
            >
              {recording === c.id ? "Press keys…" : keysFor(c.id).map(prettyKey).join(", ") || "—"}
            </span>
          </div>
        ))}
      </div>
    </Dialog>
  );
}

function AboutDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title="About EditCut" onClose={onClose} footer={<Button primary onClick={onClose}>Close</Button>}>
      <div style={{ display: "flex", justifyContent: "center", margin: "4px 0 12px" }}>
        <img src="/brand/logo-128.png" srcSet="/brand/logo-128.png 1x, /brand/logo-512.png 4x" width={96} height={96} alt="EditCut logo" style={{ filter: "drop-shadow(0 0 14px rgba(168, 85, 247, 0.45))" }} />
      </div>
      <p><b>EditCut</b> — an AI-powered non-linear video editor with Claude built in.</p>
      <p className="muted">Premiere-style editing, color, audio, graphics, captions and export, rendered with ffmpeg.</p>
    </Dialog>
  );
}

registerDialog("keyboardShortcuts", KeyboardShortcutsDialog as never);
registerDialog("about", AboutDialog as never);
