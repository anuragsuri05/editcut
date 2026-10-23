// Premiere Tools panel: grouped tool slots with flyouts (click-and-hold or
// right-click), tooltips with shortcuts, vertical or horizontal by panel shape.
import { useEffect, useRef, useState } from "react";
import { useEditor, type ToolId } from "../../store/store";
import { prettyKey } from "../../commands/registry";
import { showContextMenu } from "../../ui/kit";
import { TOOL_DEFS, TOOL_GROUPS } from "./tools";
import "./timeline.css";

function ToolSlot({ group }: { group: ToolId[] }) {
  const tool = useEditor((s) => s.tool);
  const setUI = useEditor((s) => s.setUI);
  const [last, setLast] = useState<ToolId>(group[0]);
  useEffect(() => {
    if (group.includes(tool)) setLast(tool);
  }, [tool, group]);
  const shown = group.includes(tool) ? tool : last;
  const def = TOOL_DEFS[shown];
  const hold = useRef<number | null>(null);
  const openFlyout = (e: { clientX: number; clientY: number; preventDefault: () => void }) => {
    if (group.length < 2) return;
    showContextMenu(e, group.map((id) => ({
      label: TOOL_DEFS[id].label,
      shortcut: TOOL_DEFS[id].key ? prettyKey(TOOL_DEFS[id].key!) : undefined,
      checked: tool === id,
      onClick: () => setUI({ tool: id }),
    })));
  };
  return (
    <div className="tool-slot">
      <button
        className={"tool-btn" + (group.includes(tool) ? " active" : "")}
        title={`${def.label}${def.key ? ` (${prettyKey(def.key)})` : ""}`}
        onPointerDown={(e) => {
          if (group.length < 2 || e.button !== 0) return;
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
          hold.current = window.setTimeout(() => {
            hold.current = null;
            openFlyout({ clientX: r.right, clientY: r.top, preventDefault: () => undefined });
          }, 350);
        }}
        onPointerUp={() => {
          if (hold.current !== null) {
            clearTimeout(hold.current);
            hold.current = null;
            setUI({ tool: shown });
          }
        }}
        onPointerLeave={() => {
          if (hold.current !== null) clearTimeout(hold.current);
          hold.current = null;
        }}
        onClick={() => group.length < 2 && setUI({ tool: shown })}
        onContextMenu={openFlyout}
      >
        {def.icon}
      </button>
      {group.length > 1 ? <span className="tool-flyout-mark" /> : null}
    </div>
  );
}

export default function ToolsPanel() {
  const ref = useRef<HTMLDivElement>(null);
  const [horizontal, setHorizontal] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHorizontal(el.clientWidth > el.clientHeight * 1.2));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className={"tools-panel" + (horizontal ? " horizontal" : "")}>
      {TOOL_GROUPS.map((g) => <ToolSlot key={g.join("|")} group={g} />)}
    </div>
  );
}
