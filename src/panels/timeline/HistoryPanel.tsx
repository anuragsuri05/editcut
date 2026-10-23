// History panel: one state per undoable action. Click to jump; later states
// are greyed and discarded by the next action. "Delete History" clears it.
import { useEffect, useRef } from "react";
import { Trash2, Undo2, Redo2 } from "lucide-react";
import { useEditor } from "../../store/store";
import { IconButton } from "../../ui/kit";
import "./timeline.css";

const fmt = (t: number) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

export default function HistoryPanel() {
  const past = useEditor((s) => s.past);
  const future = useEditor((s) => s.future);
  const jump = useEditor((s) => s.jumpToHistory);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const listRef = useRef<HTMLDivElement>(null);
  const n = past.length;

  useEffect(() => {
    listRef.current?.querySelector(".hist-row.current")?.scrollIntoView({ block: "nearest" });
  }, [n]);

  // state i (0 = opened project) is reached by jumpToHistory(i); past[i].label produced state i+1
  return (
    <div className="hist-panel">
      <div className="hist-list" ref={listRef}>
        <div className={"hist-row" + (n === 0 ? " current" : "")} onClick={() => jump(0)}>
          <span>Open</span>
        </div>
        {past.map((h, i) => (
          <div key={`p${i}`} className={"hist-row" + (i + 1 === n ? " current" : "")} onClick={() => jump(i + 1)}>
            <span>{h.label}</span>
            <span className="time">{fmt(h.time)}</span>
          </div>
        ))}
        {future.map((h, j) => (
          <div key={`f${j}`} className="hist-row future" onClick={() => jump(n + j + 1)}>
            <span>{h.label}</span>
          </div>
        ))}
      </div>
      <div className="hist-footer">
        <IconButton size={22} title="Step Backward (Undo)" disabled={!n} onClick={() => undo()}><Undo2 size={14} /></IconButton>
        <IconButton size={22} title="Step Forward (Redo)" disabled={!future.length} onClick={() => redo()}><Redo2 size={14} /></IconButton>
        <span className="spacer" />
        <span className="muted" style={{ fontSize: 11 }}>{n} state{n === 1 ? "" : "s"}</span>
        <IconButton
          size={22}
          title="Delete History"
          disabled={!n && !future.length}
          onClick={() => {
            if (confirm("Delete all history states? This can't be undone.")) useEditor.setState({ past: [], future: [] });
          }}
        >
          <Trash2 size={14} />
        </IconButton>
      </div>
    </div>
  );
}
